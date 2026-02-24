const pool = require('../config/db');
const queries = require('./queries');

const getAll = async (req, res) => {
  try {
    const { rows } = await pool.query(queries.getAllEmprestimos);
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao buscar empréstimos:", err);
    res.status(500).send("Erro ao buscar empréstimos");
  }
};

const deleteEmprestimo = async (req, res) => {
  const { usuario_id, exemplar_codigo, data_inicio } = req.params;
  const dataFormatada = data_inicio.split('T')[0];

  const client = await pool.connect(); 

  try {
    await client.query('BEGIN'); // Inicia a transação segura

    const result = await client.query(queries.deleteEmprestimo, [
      usuario_id,
      exemplar_codigo,
      dataFormatada
    ]);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).send("Empréstimo não encontrado");
    }

    await client.query(`
      UPDATE exemplar
      SET status_disponibilidade = TRUE
      WHERE codigo = $1
    `, [exemplar_codigo]);

    await client.query('COMMIT');

    res.status(200).send("Empréstimo deletado e exemplar disponibilizado com sucesso");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erro ao deletar empréstimo e liberar exemplar:", err);
    res.status(500).send("Erro ao processar a exclusão do empréstimo");
  } finally {
    client.release();
  }
};

const renovarEmprestimo = async (req, res) => {
  const { usuario_id, exemplar_codigo, data_inicio } = req.params;
  const dataFormatada = data_inicio.split('T')[0];

  try {
    const result = await pool.query(queries.renovarEmprestimo, [
      usuario_id,
      exemplar_codigo,
      dataFormatada
    ]);

    if (result.rowCount === 0) {
      return res.status(404).send("Empréstimo não encontrado para renovação");
    }

    res.status(200).send("Empréstimo renovado com sucesso");
  } catch (err) {
    console.error("Erro ao renovar empréstimo:", err);
    res.status(500).send("Erro ao renovar empréstimo");
  }
};

const adicionarEmprestimo = async (req, res) => {
  const { usuario_id, exemplar_codigo, data_inicio, data_fim_previsto } = req.body;

  const client = await pool.connect(); 

  try {
    await client.query('BEGIN');

    const emprestimo = await client.query(queries.adicionarEmprestimo, [
      usuario_id,
      exemplar_codigo,
      data_inicio,
      data_fim_previsto
    ]);

    await client.query(queries.atualizarStatusExemplar, [exemplar_codigo]);
    await client.query(
      `DELETE FROM reserva WHERE usuario_id = $1 AND exemplar_codigo = $2`,
      [usuario_id, exemplar_codigo]
    );

    await client.query('COMMIT');

    res.status(201).json(emprestimo.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erro ao adicionar empréstimo:", err);
    res.status(500).send("Erro ao adicionar empréstimo");
  } finally {
    client.release();
  }
};

const marcarComoDevolvido = async (req, res) => {
  const { usuario_id, exemplar_codigo, data_inicio } = req.params;
  const dataFormatada = data_inicio.split('T')[0];

  const client = await pool.connect(); // Também corrigido aqui para segurança

  try {
    await client.query('BEGIN');

    const result = await client.query(queries.marcarComoDevolvido, [
      usuario_id,
      exemplar_codigo,
      dataFormatada
    ]);
    
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).send("Empréstimo não encontrado para devolução");
    }
    
    await client.query(`
      UPDATE exemplar
      SET status_disponibilidade = TRUE
      WHERE codigo = $1
    `, [exemplar_codigo]);
    
    await client.query('COMMIT');    

    res.status(200).send("Empréstimo marcado como devolvido");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erro ao marcar como devolvido:", err);
    res.status(500).send("Erro ao marcar como devolvido");
  } finally {
    client.release();
  }
};

module.exports = {
  getAll,
  deleteEmprestimo,
  renovarEmprestimo,
  adicionarEmprestimo,
  marcarComoDevolvido
};