import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const request = require('supertest');
const express = require('express');
const reservasRoutes = require('./routes');
const pool = require('../config/db');

const app = express();
app.use(express.json());
app.use('/reservas', reservasRoutes);

describe('Testes da API de Reservas', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn()
    };
    vi.spyOn(pool, 'query');
    vi.spyOn(pool, 'connect').mockResolvedValue(mockClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================
  // GET /reservas
  // ==========================================
  it('GET /reservas - Deve listar reservas com sucesso (200)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ usuario_id: 1, exemplar_codigo: 'L1' }] });
    const res = await request(app).get('/reservas');
    expect(res.status).toBe(200);
    expect(res.body[0].usuario_id).toBe(1);
  });

  // ==========================================
  // POST /reservas (Criação padrão)
  // ==========================================
  describe('POST /reservas', () => {
    const bodyPadrao = { usuario_id: 1, exemplar_codigo: 'L1', data_efetuacao: '2023-10-01' };

    it('Deve retornar 400 se faltar algum campo', async () => {
      const res = await request(app).post('/reservas').send({ usuario_id: 1 }); // Faltou campos
      expect(res.status).toBe(400);
    });

    it('Deve retornar 404 se o exemplar não for encontrado', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // Simula que não achou o exemplar

      const res = await request(app).post('/reservas').send(bodyPadrao);
      expect(res.status).toBe(404);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('Deve retornar 400 se o exemplar estiver DISPONÍVEL (não pode reservar)', async () => {
      // Simula banco retornando que o livro tá na prateleira
      mockClient.query.mockResolvedValueOnce({ rows: [{ status_disponibilidade: true }] });

      const res = await request(app).post('/reservas').send(bodyPadrao);
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('não pode ser reservado');
    });

    it('Deve criar reserva com sucesso se exemplar estiver INDISPONÍVEL (201)', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ status_disponibilidade: false }] }) // Exemplar indisponível
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [{ id_reserva: 1 }] }) // Insert
        .mockResolvedValueOnce(); // COMMIT

      const res = await request(app).post('/reservas').send(bodyPadrao);
      
      expect(res.status).toBe(201);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('Deve retornar 409 se violar a regra de unicidade do banco (Erro 23505)', async () => {
      const erroUnico = new Error('Unique Violation');
      erroUnico.code = '23505';

      mockClient.query
        .mockResolvedValueOnce({ rows: [{ status_disponibilidade: false }] }) // Exemplar indisponível
        .mockResolvedValueOnce() // BEGIN
        .mockRejectedValueOnce(erroUnico); // Simula erro do Postgres no Insert

      const res = await request(app).post('/reservas').send(bodyPadrao);
      
      expect(res.status).toBe(409);
      expect(res.body.message).toContain('já possui uma reserva');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  // ==========================================
  // POST /reservas/carteirinha (Fluxo Aluno)
  // ==========================================
  describe('POST /reservas/carteirinha', () => {
    
    it('Deve retornar 400 se não achar o email do usuário', async () => {
      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rowCount: 0 }); // Erro: e-mail não achou o usuário

      const res = await request(app).post('/reservas/carteirinha').send({ email: 'x@usp.br', isbn: '123' });
      
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Usuário não encontrado no sistema');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('Deve retornar 400 se não achar nenhum exemplar INDISPONÍVEL para reservar', async () => {
      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] }) // Achou usuário
        .mockResolvedValueOnce({ rowCount: 0 }); // Erro: Não tem exemplar indisponível

      const res = await request(app).post('/reservas/carteirinha').send({ email: 'x@usp.br', isbn: '123' });
      
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('basta ir à biblioteca');
    });

    it('Deve criar a reserva pela carteirinha com sucesso e prever devolução (201)', async () => {
      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] }) // Achou usuário
        .mockResolvedValueOnce({ 
          rowCount: 1, 
          rows: [{ codigo: 'L1', data_fim_previsto: '2023-10-20' }] 
        }) // Achou exemplar emprestado com data prevista
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Insert
        .mockResolvedValueOnce(); // COMMIT

      const res = await request(app).post('/reservas/carteirinha').send({ email: 'aluno@usp.br', isbn: '978' });
      
      expect(res.status).toBe(201);
      expect(res.body.previsao_devolucao).toBe('2023-10-20');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });

});