import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const request = require('supertest');
const express = require('express');
const exemplaresRoutes = require('./routes');
const pool = require('../config/db');

// Cria uma mini-instância do Express
const app = express();
app.use(express.json());
// Monta as rotas na rota base /exemplares
app.use('/exemplares', exemplaresRoutes);

describe('Testes da API de Exemplares', () => {
  let mockClient;

  beforeEach(() => {
    // Mock do client para as transações de adicionarExemplar
    mockClient = {
      query: vi.fn(),
      release: vi.fn()
    };

    // Espiona as queries diretas (usado no removeExemplar)
    vi.spyOn(pool, 'query');
    
    // Espiona o connect para retornar o client falso (usado no addExemplar)
    vi.spyOn(pool, 'connect').mockResolvedValue(mockClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================
  // DELETE /exemplares/:codigo
  // ==========================================
  describe('DELETE /exemplares/:codigo', () => {
    
    it('Deve remover um exemplar com sucesso e retornar 200', async () => {
      // Simula que 1 linha foi deletada com sucesso
      pool.query.mockResolvedValueOnce({ rowCount: 1 });

      const response = await request(app).delete('/exemplares/ISBN123-1');

      expect(response.status).toBe(200);
      expect(response.text).toBe('Exemplar removido com sucesso');
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it('Deve retornar 404 se o exemplar não for encontrado', async () => {
      // Simula que o exemplar não existe no banco
      pool.query.mockResolvedValueOnce({ rowCount: 0 });

      const response = await request(app).delete('/exemplares/NAO-EXISTE');

      expect(response.status).toBe(404);
      expect(response.text).toBe('Exemplar não encontrado');
    });

    it('Deve retornar 500 em caso de erro no banco de dados', async () => {
      pool.query.mockRejectedValueOnce(new Error('Erro catastrófico no BD'));

      const response = await request(app).delete('/exemplares/ISBN123-1');

      expect(response.status).toBe(500);
      expect(response.text).toBe('Erro ao remover exemplar');
    });
  });

  // ==========================================
  // POST /exemplares/adicionar
  // ==========================================
  describe('POST /exemplares/adicionar', () => {
    
    it('Deve retornar 400 se livro_id não for fornecido', async () => {
      // Envia um body vazio de propósito
      const response = await request(app).post('/exemplares/adicionar').send({});

      expect(response.status).toBe(400);
      expect(response.text).toBe('livro_id é obrigatório');
      // O pool nem deve ser chamado se barra na validação inicial
      expect(pool.connect).not.toHaveBeenCalled(); 
    });

    it('Deve adicionar um exemplar com sucesso gerando o código correto (201)', async () => {
      const mockLivroId = 1;
      const mockIsbn = '978-85'; // ISBN falso
      const mockCountDB = '2'; // Simula que o BD já tem 2 exemplares (retorno do banco costuma ser string)
      const mockCodigoGerado = `${mockIsbn}-${parseInt(mockCountDB, 10) + 1}`; // 978-85-3
      
      const exemplarCriado = { codigo: mockCodigoGerado, livro_id: mockLivroId, status_disponibilidade: true };

      // Configura a esteira de respostas do banco de dados na transação
      mockClient.query
        .mockResolvedValueOnce() // 1. BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ isbn: mockIsbn }] }) // 2. getIsbnByLivroId
        .mockResolvedValueOnce({ rows: [{ count: mockCountDB }] }) // 3. countByLivroId
        .mockResolvedValueOnce({ rows: [exemplarCriado] }) // 4. insert do exemplar
        .mockResolvedValueOnce(); // 5. COMMIT

      const response = await request(app)
        .post('/exemplares/adicionar')
        .send({ livro_id: mockLivroId });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(exemplarCriado);
      
      // Valida se a transação foi commitada e a conexão liberada
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('Deve retornar 500 e fazer ROLLBACK se o livro não for encontrado no banco', async () => {
      mockClient.query
        .mockResolvedValueOnce() // 1. BEGIN
        .mockResolvedValueOnce({ rowCount: 0 }); // 2. getIsbnByLivroId não achou nada (rowCount 0)

      const response = await request(app)
        .post('/exemplares/adicionar')
        .send({ livro_id: 999 }); // Livro que não existe

      expect(response.status).toBe(500);
      expect(response.text).toBe('Erro ao adicionar exemplar');
      
      // Valida se ele desfez a operação com ROLLBACK
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('Deve retornar 500 e fazer ROLLBACK em caso de erro inesperado no banco', async () => {
      mockClient.query
        .mockResolvedValueOnce() // 1. BEGIN
        .mockRejectedValueOnce(new Error('Erro de conexão durante a query')); // 2. O banco caiu

      const response = await request(app)
        .post('/exemplares/adicionar')
        .send({ livro_id: 1 });

      expect(response.status).toBe(500);
      expect(response.text).toBe('Erro ao adicionar exemplar');
      
      // Valida o comportamento à prova de falhas
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
  });

});