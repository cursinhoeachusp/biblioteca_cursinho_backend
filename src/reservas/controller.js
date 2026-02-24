const pool = require('../config/db');
const queries = require('./queries');

const getAllReservas = async (req, res) => {
    try {
        const { rows } = await pool.query(queries.getAllReservas);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Erro ao buscar reservas:', error);
        res.status(500).json({ message: 'Erro ao buscar reservas.' });
    }
};

const createReserva = async (req, res) => {
    const { usuario_id, exemplar_codigo, data_efetuacao } = req.body;

    if (!usuario_id || !exemplar_codigo || !data_efetuacao) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }

    const client = await pool.connect();
    try {
        const exemplarResult = await client.query(
            "SELECT status_disponibilidade FROM exemplar WHERE codigo = $1",
            [exemplar_codigo]
        );

        if (exemplarResult.rows.length === 0) {
            return res.status(404).json({ message: "Exemplar não encontrado." });
        }

        const isDisponivel = exemplarResult.rows[0].status_disponibilidade;

        if (isDisponivel) {
            return res.status(400).json({ message: "Este exemplar está disponível e não pode ser reservado." });
        }

        await client.query('BEGIN');

        const result = await client.query(queries.createReserva, [usuario_id, exemplar_codigo, data_efetuacao]);

        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Este usuário já possui uma reserva para este exemplar.' });
        }
        res.status(500).json({ message: 'Erro ao criar reserva.' });
    } finally {
        client.release();
    }
};

const createReservaPelaCarteirinha = async (req, res) => {
    const { email, isbn } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Encontra o ID do usuário através do e-mail
        const userRes = await client.query('SELECT id FROM usuario WHERE gmail = $1', [email]);
        if (userRes.rowCount === 0) {
            throw new Error('Usuário não encontrado no sistema da biblioteca.');
        }
        const usuario_id = userRes.rows[0].id;

        // 2. Procura UM exemplar desse ISBN que esteja indisponível e puxa a data de devolução prevista
        const exemplarRes = await client.query(`
            SELECT e.codigo, emp.data_fim_previsto
            FROM exemplar e
            JOIN livro l ON e.livro_id = l.id
            LEFT JOIN emprestimo emp ON emp.exemplar_codigo = e.codigo AND emp.data_devolucao IS NULL
            WHERE l.isbn = $1 AND e.status_disponibilidade = false
            LIMIT 1
        `, [isbn]);

        if (exemplarRes.rowCount === 0) {
            throw new Error('Não há exemplares indisponíveis para este livro. Se ele estiver disponível, basta ir à biblioteca retirá-lo!');
        }

        const { codigo: exemplar_codigo, data_fim_previsto } = exemplarRes.rows[0];

        // 3. Cria a reserva
        const data_efetuacao = new Date().toISOString().split('T')[0];
        await client.query(queries.createReserva, [usuario_id, exemplar_codigo, data_efetuacao]);

        await client.query('COMMIT');
        
        // Retorna a data em que o livro deve ser devolvido pelo aluno atual
        res.status(201).json({
            message: "Reserva efetuada com sucesso!",
            previsao_devolucao: data_fim_previsto
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Você já possui uma reserva para este livro.' });
        }
        res.status(400).json({ message: error.message || 'Erro ao processar reserva.' });
    } finally {
        client.release();
    }
};

module.exports = {
    createReserva,
    getAllReservas,
    createReservaPelaCarteirinha,
};
