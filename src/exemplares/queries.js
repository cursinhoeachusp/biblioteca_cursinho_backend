const getIsbnByLivroId = `
  SELECT isbn FROM livro WHERE id = $1;
`;

const remove = `
  DELETE FROM exemplar
  WHERE codigo = $1
  RETURNING *;
`;

const countByLivroId = `
  SELECT COUNT(*) FROM exemplar WHERE livro_id = $1;
`;

const insert = `
  INSERT INTO exemplar (codigo, livro_id, status_disponibilidade)
  VALUES ($1, $2, TRUE)
  RETURNING *;
`;

const hasEmprestimosAtivos = `
  SELECT 1
  FROM exemplar e
  JOIN emprestimo emp ON emp.exemplar_codigo = e.codigo
  WHERE e.livro_id = $1 AND emp.data_devolucao IS NULL
  LIMIT 1;
`;


module.exports = {
  countByLivroId,
  insert,
  remove,
  hasEmprestimosAtivos,
  getIsbnByLivroId,
};
