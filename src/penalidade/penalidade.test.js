import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const request = require('supertest');
const express = require('express');
const penalidadeRoutes = require('./routes');
const pool = require('../config/db');

const app = express();
app.use(express.json());
app.use('/penalidades', penalidadeRoutes);

describe('Testes da API de Penalidade', () => {
  
  beforeEach(() => {
    // Como o controller usa apenas pool.query direto, só precisamos espionar ele
    vi.spyOn(pool, 'query');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rotas de Leitura (GET)', () => {
    it('GET /penalidades/tipos - Deve retornar os tipos de penalidade', async () => {
      const mockTipos = [{ id: 1, nome: 'Atraso' }];
      pool.query.mockResolvedValueOnce({ rows: mockTipos });

      const res = await request(app).get('/penalidades/tipos');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockTipos);
    });

    it('GET /penalidades/causas - Deve retornar as causas de penalidade', async () => {
      const mockCausas = [{ id: 1, nome: 'Livro Danificado' }];
      pool.query.mockResolvedValueOnce({ rows: mockCausas });

      const res = await request(app).get('/penalidades/causas');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockCausas);
    });

    it('GET /penalidades - Deve listar todas formatadas', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ usuario_id: 1, tipo: 'Atraso' }] });

      const res = await request(app).get('/penalidades');
      expect(res.status).toBe(200);
      // O utils.formatarPenalidade transforma usuario_id em usuarioId
      expect(res.body[0]).toHaveProperty('usuarioId', 1);
    });
  });

  describe('Rotas de Escrita (POST, PUT, DELETE, PATCH)', () => {
    
    it('POST /penalidades - Deve adicionar uma penalidade e formatar retorno (201)', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ usuario_id: 2, exemplar_codigo: 'L1' }] });

      const res = await request(app).post('/penalidades').send({
        usuario_id: 2,
        exemplar_codigo: 'L1',
        emprestimo_data_inicio: '2023-10-01',
        tipo_id: 1,
        causa_id: 1,
        data_aplicacao: '2023-10-10'
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('usuarioId', 2);
    });

    it('PUT /penalidades/... - Deve editar penalidade com sucesso (200)', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ usuario_id: 1 }] });

      const res = await request(app)
        .put('/penalidades/1/L1/2023-10-01/2023-10-10')
        .send({ tipo_id: 2, status_cumprida: true });

      expect(res.status).toBe(200);
    });

    it('DELETE /penalidades/... - Deve deletar e retornar sucesso (200)', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).delete('/penalidades/1/L1/2023-10-01/2023-10-10');
      expect(res.status).toBe(200);
      expect(res.text).toBe('Penalidade removida com sucesso');
    });

    it('DELETE /penalidades/... - Deve retornar 404 se não achar para deletar', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 0 });

      const res = await request(app).delete('/penalidades/1/L1/2023-10-01/2023-10-10');
      expect(res.status).toBe(404);
    });

    it('PATCH /penalidades/.../cumprida - Deve marcar como cumprida (200)', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ status_cumprida: true }] });

      const res = await request(app).patch('/penalidades/1/L1/2023-10-01/2023-10-10/cumprida');
      expect(res.status).toBe(200);
      expect(res.body.statusCumprida).toBe(true);
    });
  });

});