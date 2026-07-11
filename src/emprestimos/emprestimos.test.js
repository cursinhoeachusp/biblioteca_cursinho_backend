import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const request = require('supertest');
const express = require('express');
const emprestimosRoutes = require('./routes');
const pool = require('../config/db');

const app = express();
app.use(express.json());
app.use('/emprestimos', emprestimosRoutes);

describe('Testes da API de Empréstimos', () => {
  
  // Variável para armazenar o nosso "cliente" de banco de dados falso
  let mockClient;

  beforeEach(() => {
    // Cria o mock do client que é retornado por pool.connect()
    mockClient = {
      query: vi.fn(),     // Simula a execução de queries na transação
      release: vi.fn()    // Simula a liberação do client no 'finally'
    };

    // Espiona as funções diretas do pool
    vi.spyOn(pool, 'query');
    
    // Faz o pool.connect() retornar o nosso mockClient
    vi.spyOn(pool, 'connect').mockResolvedValue(mockClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================
  // GET /emprestimos
  // ==========================================
  describe('GET /emprestimos', () => {
    it('Deve retornar todos os empréstimos com status 200', async () => {
      const mockRows = [{ usuario_id: 1, exemplar_codigo: 'L1', livro_titulo: 'O Hobbit' }];
      pool.query.mockResolvedValueOnce({ rows: mockRows });

      const res = await request(app).get('/emprestimos');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockRows);
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it('Deve retornar 500 em caso de erro no banco', async () => {
      pool.query.mockRejectedValueOnce(new Error('Falha no banco'));

      const res = await request(app).get('/emprestimos');
      expect(res.status).toBe(500);
    });
  });

  // ==========================================
  // POST /emprestimos (Adicionar)
  // ==========================================
  describe('POST /emprestimos', () => {
    const novoEmprestimo = {
      usuario_id: 1,
      exemplar_codigo: 'L1',
      data_inicio: '2023-10-01',
      data_fim_previsto: '2023-10-15'
    };

    it('Deve retornar 403 se o usuário tiver uma penalidade ativa', async () => {
      // Configuramos a ordem de retorno do mockClient.query
      mockClient.query
        .mockResolvedValueOnce() // 1. Resposta para o 'BEGIN'
        .mockResolvedValueOnce({ rowCount: 1 }); // 2. Resposta para a busca de penalidade (Encontrou = 1)

      const res = await request(app).post('/emprestimos').send(novoEmprestimo);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('suspensão ativa');
      
      // Verifica se a transação sofreu ROLLBACK e o client foi liberado
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('Deve criar um empréstimo com sucesso e retornar 201', async () => {
      const retornoEmprestimo = { id_emprestimo: 1, ...novoEmprestimo };

      mockClient.query
        .mockResolvedValueOnce() // 1. BEGIN
        .mockResolvedValueOnce({ rowCount: 0 }) // 2. Penalidade (Não encontrou = 0)
        .mockResolvedValueOnce({ rows: [retornoEmprestimo] }) // 3. Insert de Empréstimo
        .mockResolvedValueOnce() // 4. Update status do exemplar
        .mockResolvedValueOnce() // 5. Delete reserva
        .mockResolvedValueOnce(); // 6. COMMIT

      const res = await request(app).post('/emprestimos').send(novoEmprestimo);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(retornoEmprestimo);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================
  // DELETE /emprestimos/:usuario_id/:exemplar_codigo/:data_inicio
  // ==========================================
  describe('DELETE /emprestimos/:id/...', () => {
    it('Deve retornar 404 se o empréstimo não for encontrado para exclusão', async () => {
      mockClient.query
        .mockResolvedValueOnce() // 1. BEGIN
        .mockResolvedValueOnce({ rowCount: 0 }); // 2. Delete (rowCount 0 significa que não achou)

      const res = await request(app).delete('/emprestimos/1/L1/2023-10-01');

      expect(res.status).toBe(404);
      expect(res.text).toBe('Empréstimo não encontrado');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('Deve deletar o empréstimo e atualizar o exemplar com sucesso (200)', async () => {
      mockClient.query
        .mockResolvedValueOnce() // 1. BEGIN
        .mockResolvedValueOnce({ rowCount: 1 }) // 2. Delete efetuado com sucesso
        .mockResolvedValueOnce() // 3. Update status_disponibilidade
        .mockResolvedValueOnce(); // 4. COMMIT

      const res = await request(app).delete('/emprestimos/1/L1/2023-10-01');

      expect(res.status).toBe(200);
      expect(res.text).toBe('Empréstimo deletado e exemplar disponibilizado com sucesso');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });

  // ==========================================
  // PATCH /emprestimos/.../renovar
  // ==========================================
  describe('PATCH /emprestimos/.../renovar', () => {
    // Nota: Renovar usa pool.query direto, não transações.
    it('Deve renovar empréstimo com sucesso (200)', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).patch('/emprestimos/1/L1/2023-10-01/renovar');
      
      expect(res.status).toBe(200);
      expect(res.text).toBe('Empréstimo renovado com sucesso');
    });

    it('Deve retornar 404 se não achar o empréstimo para renovar', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 0 });

      const res = await request(app).patch('/emprestimos/1/L1/2023-10-01/renovar');
      
      expect(res.status).toBe(404);
    });
  });

  // ==========================================
  // PATCH /emprestimos/.../devolver
  // ==========================================
  describe('PATCH /emprestimos/.../devolver', () => {
    it('Deve marcar como devolvido e liberar exemplar (200)', async () => {
      mockClient.query
        .mockResolvedValueOnce() // 1. BEGIN
        .mockResolvedValueOnce({ rowCount: 1 }) // 2. Update emprestimo (sucesso)
        .mockResolvedValueOnce() // 3. Update exemplar
        .mockResolvedValueOnce(); // 4. COMMIT

      const res = await request(app).patch('/emprestimos/1/L1/2023-10-01/devolver');
      
      expect(res.status).toBe(200);
      expect(res.text).toBe('Empréstimo marcado como devolvido');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('Deve retornar 404 se não achar para devolução', async () => {
      mockClient.query
        .mockResolvedValueOnce() // 1. BEGIN
        .mockResolvedValueOnce({ rowCount: 0 }); // 2. Update emprestimo (não achou)

      const res = await request(app).patch('/emprestimos/1/L1/2023-10-01/devolver');
      
      expect(res.status).toBe(404);
      expect(res.text).toBe('Empréstimo não encontrado para devolução');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

});