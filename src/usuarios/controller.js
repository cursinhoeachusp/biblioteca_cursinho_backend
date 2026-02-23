const queries = require('./queries');
const utils = require('./utils');
const pool = require('../config/db');

function formatarEndereco(logradouro, numero, complemento, cep) {
  let endereco = `${logradouro}, ${numero}`;
  if (complemento) {
    endereco += ` - ${complemento}`;
  }
  endereco += `\n${cep}`;
  return endereco;
}

const getById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const result = await pool.query(`
      SELECT u.*, e.cep, e.logradouro, e.numero, e.complemento 
      FROM usuario u
      LEFT JOIN endereco e ON u.id = e.usuario_id
      WHERE u.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const usuario = {
      ...result.rows[0],
      status: result.rows[0].status_regularidade ? 'Regular' : 'Bloqueado',
      endereco: {
        cep: result.rows[0].cep,
        logradouro: result.rows[0].logradouro,
        numero: result.rows[0].numero,
        complemento: result.rows[0].complemento
      }
    };

    res.json(usuario);
  } catch (err) {
    console.error("Erro ao atualizar usuário:", err);
    res.status(500).json({ message: "Erro no banco de dados", detalhe: err.detail || err.message });
  }
};

const getAll = async (req, res) => {
  try {
    const result = await pool.query(queries.getAll)
    const usuarios = result.rows.map(utils.formatarUsuario);
    res.json(usuarios);
  } catch (err) {
    console.error("Erro ao consultar usuários:", err);
    res.status(500).send("Erro no banco de dados");
  }
}


const getAtrasados = async (req, res) => {
  try {
    const result = await pool.query(queries.getAtrasados)
    const usuarios = result.rows.map(utils.formatarUsuario);
    res.json(usuarios);
  } catch (err) {
    console.error("Erro ao consultar usuários:", err);
    res.status(500).send("Erro no banco de dados");
  }
}

const create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Cria usuário
    const { nome, cpf, gmail, telefone, ...endereco } = req.body;
    const userResult = await client.query(queries.createUser,
      [nome, cpf, gmail, telefone]);

    // 2. Cria endereço
    const addressResult = await client.query(queries.createAddress, [
      userResult.rows[0].id,
      endereco.cep,
      endereco.logradouro,
      endereco.numero,
      endereco.complemento
    ]);

    await client.query('COMMIT');
    res.status(201).json({
      ...userResult.rows[0],
      endereco: addressResult.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erro ao criar usuário:", err);
    res.status(500).send("Erro no banco de dados");
  } finally {
    client.release();
  }
};



const update = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const id = parseInt(req.params.id);
    const { nome, cpf, gmail, telefone, status, endereco } = req.body;

    // 1. Atualiza usuário (6 parâmetros)
    const userResult = await client.query(queries.updateUser, [
      nome,           // $1
      cpf,            // $2
      gmail,          // $3
      telefone,       // $4
      status === 'Regular', // $5 (boolean)
      id              // $6
    ]);

    // 2. Atualiza endereço (5 parâmetros)
    const addressResult = await client.query(queries.updateAddress, [
      endereco.cep,         // $1
      endereco.logradouro,  // $2
      endereco.numero,      // $3
      endereco.complemento || null, // $4 (pode ser null)
      id                    // $5 (usuario_id)
    ]);

    await client.query('COMMIT');
    res.json({
      ...userResult.rows[0],
      endereco: addressResult.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erro detalhado:", err);
    
    if (err.code === '23505') {
      return res.status(400).json({ 
        message: "Email já está em uso por outro usuário" 
      });
    }
    
    res.status(500).json({ 
      message: "Erro no banco de dados", 
      detalhe: err.message 
    });
  } finally {
    client.release();
  }
};




const remove = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await pool.query('DELETE FROM usuario WHERE id = $1', [id]);
    res.status(204).send(); // 204 = No Content (sucesso sem retorno)
  } catch (err) {
    console.error("Erro ao excluir usuário:", err);
    res.status(500).json({ message: "Erro no banco de dados" });
  }
};

const createBatch = async (req, res) => {
  const { usuarios } = req.body;

  if (!usuarios || !Array.isArray(usuarios) || usuarios.length === 0) {
    return res.status(400).json({ message: 'Nenhum usuário fornecido ou formato inválido.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // Inicia a transação

    for (const usuario of usuarios) {
      const { nome, cpf, gmail, telefone, cep, logradouro, numero, complemento } = usuario;

      // Validação mínima dos dados
      if (!nome || !cpf || !gmail || !telefone || !cep || !logradouro || !numero) {
        throw new Error(`Dados obrigatórios faltando para o usuário ${nome || cpf}`);
      }

      // 1. Cria o usuário e obtém o ID de retorno
      const userResult = await client.query(queries.createUser, [nome, cpf, gmail, telefone || null]);
      const newUserId = userResult.rows[0].id;

      // 2. Cria o endereço usando o ID do novo usuário
      await client.query(queries.createAddress, [newUserId, cep, logradouro, numero, complemento || null]);
    }

    await client.query('COMMIT'); // Confirma a transação se tudo deu certo
    res.status(201).json({ message: `${usuarios.length} usuários adicionados com sucesso!` });

  } catch (error) {
    await client.query('ROLLBACK'); // Desfaz tudo se ocorrer qualquer erro
    console.error('Erro na inserção em lote:', error);
    res.status(500).json({ message: error.message || 'Erro interno ao processar o lote de usuários.' });
  } finally {
    client.release(); // Libera a conexão de volta para o pool
  }
};

const searchUsuarios = async (req, res) => {
  const searchTerm = req.query.q; 
  if (!searchTerm) {
    return res.json([]);
  }

  try {
    const result = await pool.query(queries.searchUsers, [`%${searchTerm}%`]);
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    res.status(500).json({ message: "Erro no servidor" });
  }
};

const getResumoBiblioteca = async (req, res) => {
  const { email } = req.params;
  
  try {
    const emprestimos = await pool.query(`
      SELECT e.data_fim_previsto, l.titulo 
      FROM emprestimo e
      JOIN usuario u ON e.usuario_id = u.id
      JOIN exemplar ex ON e.exemplar_codigo = ex.codigo
      JOIN livro l ON ex.livro_id = l.id
      WHERE u.gmail = $1 AND e.data_devolucao IS NULL
    `, [email]);

    const reservas = await pool.query(`
      SELECT r.data_efetuacao, l.titulo
      FROM reserva r
      JOIN usuario u ON r.usuario_id = u.id
      JOIN exemplar ex ON r.exemplar_codigo = ex.codigo
      JOIN livro l ON ex.livro_id = l.id
      WHERE u.gmail = $1
    `, [email]);

    res.json({
      emprestimos: emprestimos.rows,
      reservas: reservas.rows
    });
  } catch (err) {
    console.error("Erro ao buscar resumo:", err);
    res.status(500).json({ message: "Erro ao buscar dados." });
  }
};

module.exports = {
  getAll,
  getAtrasados,
  create,
  update,
  remove,
  getById,
  createBatch,
  searchUsuarios,
  getResumoBiblioteca,
};
