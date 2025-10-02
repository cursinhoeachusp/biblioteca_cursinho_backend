const queries = require('./queries');
const utils = require('./utils');
const pool = require('../config/db');
const fs = require('fs');
const csv = require('csv-parser');

const autorQueries = require('../autores/queries');
const exemplarQueries = require('../exemplares/queries');

const getAll = async (req,res) => {
    try{
        const result = await pool.query(queries.getAll)
        const livros = result.rows.map(utils.formatarLivro);
        res.json(livros);
    } catch (err) {
        console.error("Erro ao consultar livros:", err);
        res.status(500).send("Erro no banco de dados");
    }
}

const addLivro = async (req, res) => {
    const { isbn, titulo, editora, edicao, categoria, quantidade_exemplares } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const resultLivro = await client.query(queries.insert, [
            isbn,
            titulo,
            editora,
            edicao,
            categoria
        ]);
        const livroCriado = resultLivro.rows[0];

        for (let i = 1; i <= quantidade_exemplares; i++) {
            const codigo = `${livroCriado.isbn}-${i}`; 
            await client.query(
                `INSERT INTO exemplar (codigo, livro_id, status_disponibilidade)
                 VALUES ($1, $2, TRUE)`,
                [codigo, livroCriado.id]
            );
        }

        await client.query('COMMIT');
        const livroFormatado = {
            ...utils.formatarLivro(livroCriado),
            total_exemplares: quantidade_exemplares,
            exemplares_disponiveis: quantidade_exemplares
        };

        res.status(201).json(livroFormatado);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Erro ao adicionar livro:", err);
        res.status(500).send("Erro ao adicionar livro");
    } finally {
        client.release();
    }
};

const editLivro = async (req, res) => {
    const { id } = req.params;
    const { isbn, titulo, editora, edicao, categoria } = req.body;

    try {
        const result = await pool.query(queries.update, [
            isbn,
            titulo,
            editora,
            edicao,
            categoria,
            id
        ]);

        if (result.rowCount === 0) {
            return res.status(404).send("Livro não encontrado");
        }

        const livroAtualizado = utils.formatarLivro(result.rows[0]);
        res.json(livroAtualizado);
    } catch (err) {
        console.error("Erro ao atualizar livro:", err);
        res.status(500).send("Erro ao atualizar livro");
    }
};

const removeLivro = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(queries.remove, [id]);

        if (result.rowCount === 0) {
            return res.status(404).send("Livro não encontrado");
        }

        res.status(200).send("Livro removido com sucesso");
    } catch (err) {
        console.error("Erro ao remover livro:", err);
        res.status(500).send("Erro ao remover livro");
    }
};

const adicionarAutorAoLivro = async (req, res) => {
  const { livroId, autorId } = req.body;

  try {
    const result = await pool.query(queries.vincularAutor, [livroId, autorId]);

    if (result.rowCount === 0) {
      return res.status(200).send("Associação já existente");
    }

    res.status(201).json({ message: "Autor vinculado ao livro com sucesso" });
  } catch (err) {
    console.error("Erro ao vincular autor ao livro:", err);
    res.status(500).send("Erro ao vincular autor ao livro");
  }
};

const getByIsbnCompleto = async (req, res) => {
  const { isbn } = req.params;

  try {
    const result = await pool.query(queries.getByIsbnCompleto, [isbn]);

    if (result.rowCount === 0) {
      return res.status(404).send("Livro não encontrado");
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao buscar livro por ISBN:", err);
    res.status(500).send("Erro ao buscar livro");
  }
};

const importarCsv = async (req, res) => {
  const resultados = [];

  try {
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (row) => resultados.push(row))
      .on('end', async () => {
        const client = await pool.connect();

        try {
          await client.query('BEGIN');

          for (const row of resultados) {
            const {
              isbn,
              titulo,
              editora,
              edicao,
              categoria,
              autores,
              quantidade_exemplares
            } = row;

            const resultLivro = await client.query(queries.insertFromCsv, [
              isbn,
              titulo,
              editora,
              parseInt(edicao),
              categoria
            ]);

            let livro = resultLivro.rows[0];
            if (!livro) {
              const buscaLivro = await client.query(
                `SELECT * FROM livro WHERE isbn = $1`,
                [isbn]
              );
              livro = buscaLivro.rows[0];
              if (!livro) continue;
            }

            const nomesAutores = autores.split(',').map((nome) => nome.trim());

            for (const nome of nomesAutores) {
              let resultAutor = await client.query(autorQueries.getByNome, [nome]);
              let autor = resultAutor.rows[0];

              if (!autor) {
                const insertAutor = await client.query(autorQueries.insert, [nome]);
                autor = insertAutor.rows[0];
              }

              await client.query(queries.vincularAutor, [livro.id, autor.id]);
            }

            const total = parseInt(quantidade_exemplares);
            for (let i = 1; i <= total; i++) {
              const codigo = `${livro.id}-${i}`;
              await client.query(exemplarQueries.insert, [codigo, livro.id]);
            }
          }

          await client.query('COMMIT');

          fs.unlink(req.file.path, (err) => {
            if (err) console.warn('Erro ao apagar arquivo temporário:', err);
          });

          res.send(`Importação concluída. ${resultados.length} livros processados.`);
        } catch (err) {
          await client.query('ROLLBACK');
          fs.unlink(req.file.path, () => {}); 
          console.error('Erro durante importação:', err);
          res.status(500).send('Erro durante importação');
        } finally {
          client.release();
        }
      });
  } catch (err) {
    console.error('Erro no processamento do arquivo:', err);
    res.status(500).send('Erro ao processar CSV');
  }
};


const removeByIsbn = async (req, res) => {
  const { isbn } = req.params;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const livroResult = await client.query(`SELECT id FROM livro WHERE isbn = $1`, [isbn]);
    if (livroResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).send("Livro não encontrado");
    }

    const livroId = livroResult.rows[0].id;

    const emprestimoAtivo = await client.query(exemplarQueries.hasEmprestimosAtivos, [livroId]);
    if (emprestimoAtivo.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).send("Este livro possui exemplares com empréstimos ativos.");
    }

    await client.query(queries.removeByIsbn, [isbn]);

    await client.query('COMMIT');
    res.status(200).send("Livro removido com sucesso");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erro ao remover livro por ISBN:", err);
    res.status(500).send("Erro ao remover livro");
  } finally {
    client.release();
  }
};

const getExemplaresIndisponiveis = async (req, res) => {
  const { isbn } = req.params;
  const client = await pool.connect();

  try {
    const livroResult = await client.query("SELECT id FROM livro WHERE isbn = $1", [isbn]);
    if (livroResult.rows.length === 0) {
      return res.json([]);
    }
    const livroId = livroResult.rows[0].id;

    // A lógica da query foi invertida para status_disponibilidade = false
    const exemplaresResult = await client.query(
      "SELECT codigo FROM exemplar WHERE livro_id = $1 AND status_disponibilidade = false",
      [livroId]
    );
    res.json(exemplaresResult.rows);

  } catch (error) {
    console.error("Erro ao buscar exemplares indisponíveis:", error);
    res.status(500).json({ message: 'Erro interno no servidor.' });
  } finally {
    client.release();
  }
};


module.exports = {
  getAll,
  addLivro,
  editLivro,
  removeLivro,
  adicionarAutorAoLivro,
  getByIsbnCompleto,
  importarCsv,
  removeByIsbn,
  getExemplaresIndisponiveis,
}