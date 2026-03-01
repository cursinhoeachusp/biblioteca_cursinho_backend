const getUserById = `
  SELECT u.*, e.cep, e.logradouro, e.numero, e.complemento 
  FROM usuario u
  LEFT JOIN endereco e ON u.id = e.usuario_id
  WHERE u.id = $1`;


const getAll =
  `SELECT u.id, u.nome, u.gmail, u.telefone, 
             u.status_regularidade,
             u.cpf, e.logradouro, e.numero, e.complemento, e.cep
      FROM usuario u
      LEFT JOIN endereco e ON u.id = e.usuario_id ORDER BY u.id ASC`;

const getAtrasados =
  `SELECT DISTINCT u.id, u.nome, u.gmail, u.telefone, 
                      u.status_regularidade,
                      u.cpf, e.logradouro, e.numero, e.complemento, e.cep
      FROM usuario u
      INNER JOIN emprestimo emp ON emp.usuario_id = u.id
      LEFT JOIN endereco e ON u.id = e.usuario_id
      WHERE emp.data_devolucao IS NULL 
        AND emp.data_fim_previsto < CURRENT_DATE
      ORDER BY u.id ASC`;

const createUser = `
  INSERT INTO usuario (nome, cpf, gmail, telefone)
  VALUES ($1, $2, $3, $4)
  RETURNING *`;

const updateUser = `UPDATE usuario 
                    SET nome = $1, cpf = $2, gmail = $3, telefone = $4, status_regularidade = $5
                    WHERE id = $6
                    RETURNING *`;

const deleteUser = `
  DELETE FROM usuario
  WHERE id = $1`;

const createAddress = `
  INSERT INTO endereco (usuario_id, cep, logradouro, numero, complemento)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING *`;

const updateAddress = `UPDATE endereco 
                       SET cep = $1, logradouro = $2, numero = $3, complemento = $4
                       WHERE usuario_id = $5
                       RETURNING *`;

const searchUsers = `
  SELECT id, nome, cpf FROM usuario
  WHERE nome ILIKE $1 OR cpf ILIKE $1
  LIMIT 10
`;

module.exports = {
  getAll,
  getAtrasados,
  createUser,
  updateUser,
  deleteUser,
  createAddress,
  updateAddress,
  getUserById,
  searchUsers
}