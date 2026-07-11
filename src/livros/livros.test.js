import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const request = require('supertest');
const express = require('express');
const livrosRoutes = require('./routes');
const pool = require('../config/db');
const utils = require('./utils');

const app = express();
app.use(express.json());
app.use('/livros', livrosRoutes);

describe('Testes da API de Livros', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn()
    };
    vi.spyOn(pool, 'query');
    vi.spyOn(pool, 'connect').mockResolvedValue(mockClient);
    
    // Espiona o utils.formatarLivro para apenas repassar o dado sem quebrar o teste
    vi.spyOn(utils, 'formatarLivro').mockImplementation((livro) => livro);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Consultas Diretas (pool.query)', () => {
    it('GET /livros - Deve retornar todos os livros', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, titulo: 'Livro A' }] });
      const res = await request(app).get('/livros');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 1, titulo: 'Livro A' }]);
    });

    it('PUT /livros/:id - Deve editar um livro (200)', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1, titulo: 'Editado' }] });
      const res = await request(app).put('/livros/1').send({ titulo: 'Editado' });
      expect(res.status).toBe(200);
    });

    it('DELETE /livros/:id - Deve deletar um livro por ID (200)', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).delete('/livros/1');
      expect(res.status).toBe(200);
    });

    it('POST /livros/autor - Deve vincular autor (201)', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).post('/livros/autor').send({ livroId: 1, autorId: 2 });
      expect(res.status).toBe(201);
    });

    it('GET /livros/isbn/:isbn - Deve buscar livro completo (200)', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1, isbn: '123' }] });
      const res = await request(app).get('/livros/isbn/123');
      expect(res.status).toBe(200);
    });
  });

  describe('Transações (pool.connect)', () => {
    
    it('POST /livros - Deve adicionar livro e exemplares gerando o código (201)', async () => {
      const mockLivro = { id: 10, isbn: '978-85' };
      
      mockClient.query
        .mockResolvedValueOnce() // 1. BEGIN
        .mockResolvedValueOnce({ rows: [mockLivro] }) // 2. Insert Livro
        .mockResolvedValueOnce() // 3. Insert Exemplar 1 (do For Loop)
        .mockResolvedValueOnce() // 4. Insert Exemplar 2 (do For Loop)
        .mockResolvedValueOnce(); // 5. COMMIT

      const res = await request(app).post('/livros').send({
        isbn: '978-85',
        titulo: 'O Processo',
        editora: 'Ed',
        edicao: 1,
        categoria: 'Cat',
        quantidade_exemplares: 2 // O loop rodará 2 vezes
      });

      expect(res.status).toBe(201);
      expect(res.body.total_exemplares).toBe(2);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('DELETE /livros/isbn/:isbn - Deve deletar com sucesso (200)', async () => {
      mockClient.query
        .mockResolvedValueOnce() // 1. BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] }) // 2. Select Livro
        .mockResolvedValueOnce({ rowCount: 0 }) // 3. hasEmprestimosAtivos (0 = liberado para deletar)
        .mockResolvedValueOnce() // 4. DELETE
        .mockResolvedValueOnce(); // 5. COMMIT

      const res = await request(app).delete('/livros/isbn/978-85');
      
      expect(res.status).toBe(200);
      expect(res.text).toBe('Livro removido com sucesso');
    });

    it('DELETE /livros/isbn/:isbn - Deve retornar 409 se houver empréstimo ativo', async () => {
      mockClient.query
        .mockResolvedValueOnce() // 1. BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] }) // 2. Select Livro
        .mockResolvedValueOnce({ rowCount: 1 }); // 3. hasEmprestimosAtivos (1 = não pode deletar!)

      const res = await request(app).delete('/livros/isbn/978-85');
      
      expect(res.status).toBe(409);
      expect(res.text).toBe('Este livro possui exemplares com empréstimos ativos.');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK'); // Garante que a transação foi desfeita
    });

    it('GET /livros/:isbn/exemplares-disponiveis - Deve retornar lista de Strings', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Busca ID do Livro
        .mockResolvedValueOnce({ rows: [{ codigo: '978-1' }, { codigo: '978-2' }] }); // Busca exemplares

      const res = await request(app).get('/livros/978/exemplares-disponiveis');
      
      expect(res.status).toBe(200);
      // O seu controller disponível mapeia e retorna apenas as strings (Array of Strings)
      expect(res.body).toEqual(['978-1', '978-2']); 
    });

    it('GET /livros/:isbn/exemplares-indisponiveis - Deve retornar lista de Objetos', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) 
        .mockResolvedValueOnce({ rows: [{ codigo: '978-3' }] }); 

      const res = await request(app).get('/livros/978/exemplares-indisponiveis');
      
      expect(res.status).toBe(200);
      // O seu controller indisponível não mapeia, retorna a linha inteira do banco (Array of Objects)
      expect(res.body).toEqual([{ codigo: '978-3' }]); 
    });
  });

  describe('Outros Casos Especiais', () => {
    it('POST /livros/import - Deve tratar erro corretamente sem arquivo (500)', async () => {
      // Como não anexamos arquivo real pelo supertest, o req.file fica undefined 
      // e aciona corretamente o bloco catch (Erro ao processar CSV).
      const res = await request(app).post('/livros/import');
      expect(res.status).toBe(500);
      expect(res.text).toBe('Erro ao processar CSV');
    });
  });

});