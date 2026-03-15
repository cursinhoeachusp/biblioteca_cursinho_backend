const getAll = `
  SELECT 
    l.*,
    COUNT(DISTINCT e.codigo) AS total_exemplares,
    COUNT(DISTINCT e.codigo) FILTER (WHERE e.status_disponibilidade = TRUE) AS exemplares_disponiveis,
    COALESCE(
      JSON_AGG(DISTINCT JSONB_BUILD_OBJECT('id', a.id, 'nome', a.nome))
      FILTER (WHERE a.id IS NOT NULL),
      '[]'
    ) AS autores
  FROM 
    livro l
  LEFT JOIN exemplar e ON e.livro_id = l.id
  LEFT JOIN livro_autor la ON la.livro_id = l.id
  LEFT JOIN autor a ON a.id = la.autor_id
  GROUP BY l.id;
`;

const vincularAutor = `
  INSERT INTO livro_autor (livro_id, autor_id)
  VALUES ($1, $2)
  ON CONFLICT DO NOTHING
  RETURNING *;
`;

const insert = `
  INSERT INTO livro (isbn, titulo, editora, edicao, categoria)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING *;
`;

const update = `
  UPDATE livro
  SET isbn = $1,
      titulo = $2,
      editora = $3,
      edicao = $4,
      categoria = $5
  WHERE id = $6
  RETURNING *;
`;

const remove = `
  DELETE FROM livro
  WHERE id = $1
  RETURNING *;
`;

const getByIsbnCompleto = `
  SELECT 
    l.*,
    COALESCE(
      JSON_AGG(DISTINCT JSONB_BUILD_OBJECT('id', a.id, 'nome', a.nome))
      FILTER (WHERE a.id IS NOT NULL),
      '[]'
    ) AS autores,
    COALESCE(
      JSON_AGG(DISTINCT JSONB_BUILD_OBJECT('codigo', e.codigo, 'status_disponibilidade', e.status_disponibilidade))
      FILTER (WHERE e.codigo IS NOT NULL),
      '[]'
    ) AS exemplares
  FROM livro l
  LEFT JOIN livro_autor la ON la.livro_id = l.id
  LEFT JOIN autor a ON a.id = la.autor_id
  LEFT JOIN exemplar e ON e.livro_id = l.id
  WHERE l.isbn = $1
  GROUP BY l.id;
`;

const insertFromCsv = `
  INSERT INTO livro (isbn, titulo, editora, edicao, categoria)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (isbn) DO NOTHING;
`;

const removeByIsbn = `
  DELETE FROM livro
  WHERE isbn = $1
  RETURNING *;
`;


module.exports = {
    getAll,
    insert, 
    update, 
    remove,
    vincularAutor,
    getByIsbnCompleto,
    insertFromCsv,
    removeByIsbn
}