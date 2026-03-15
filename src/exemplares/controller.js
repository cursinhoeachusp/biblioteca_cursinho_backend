const queries = require('./queries');
const pool = require('../config/db');

const removeExemplar = async (req, res) => {
    const { codigo } = req.params;

    try {
        const result = await pool.query(queries.remove, [codigo]);

        if (result.rowCount === 0) {
            return res.status(404).send("Exemplar não encontrado");
        }

        res.status(200).send("Exemplar removido com sucesso");
    } catch (err) {
        console.error("Erro ao remover exemplar:", err);
        res.status(500).send("Erro ao remover exemplar");
    }
};


const addExemplar = async (req, res) => {
  const { livro_id } = req.body; // Pega o livro_id do corpo da requisição

  if (!livro_id) {
    return res.status(400).send("livro_id é obrigatório"); // Retorna erro se não houver livro_id
  }

  const client = await pool.connect(); // Conecta ao banco de dados

  try {
    await client.query('BEGIN'); // Inicia a transação

    // 1. Busca o ISBN do livro usando o ID
    const livroResult = await client.query(queries.getIsbnByLivroId, [livro_id]);
    if (livroResult.rowCount === 0) {
        throw new Error("Livro não encontrado no banco de dados");
    }
    const isbn = livroResult.rows[0].isbn;

    // 2. Conta os exemplares existentes
    const { rows } = await client.query(queries.countByLivroId, [livro_id]); // Conta usando queries.countByLivroId
    const count = parseInt(rows[0].count, 10); // Transforma em inteiro

    // 3. Gera o código com a regra correta: ISBN-i
    const codigo = `${isbn}-${count + 1}`;

    // 4. Insere no banco
    const result = await client.query(queries.insert, [codigo, livro_id]); // Insere o exemplar gerado

    await client.query('COMMIT'); // Finaliza a transação
    res.status(201).json(result.rows[0]); // Retorna o resultado
  } catch (err) {
    await client.query('ROLLBACK'); // Desfaz em caso de erro
    console.error("Erro ao adicionar exemplar:", err); // Log do erro
    res.status(500).send("Erro ao adicionar exemplar"); // Retorna status 500
  } finally {
    client.release(); // Libera o client
  }
};

module.exports = {
    removeExemplar,
    addExemplar
}