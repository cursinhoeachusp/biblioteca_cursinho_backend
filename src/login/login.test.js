import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const request = require('supertest');
const express = require('express');
const loginRoutes = require('./routes');
const pool = require('../config/db');
const jwt = require('jsonwebtoken');

// Instância do Express para o teste
const app = express();
app.use(express.json());
app.use('/login', loginRoutes);

describe('Testes da API de Login', () => {
  
  beforeEach(() => {
    // Espiona o banco de dados e a geração de token
    vi.spyOn(pool, 'query');
    vi.spyOn(jwt, 'sign');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Deve realizar login com sucesso e retornar o token (200)', async () => {
    const mockUsuario = {
      id: 1,
      nome: 'Usuário Teste',
      gmail: 'teste@usp.br',
      senha: 'senha123',
      admin: true
    };

    // Simula o banco retornando o usuário
    pool.query.mockResolvedValueOnce({ rows: [mockUsuario], rowCount: 1 });
    // Simula a criação do token
    jwt.sign.mockReturnValueOnce('token_jwt_falso');

    const res = await request(app)
      .post('/login')
      .send({ email: 'teste@usp.br', senha: 'senha123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('token_jwt_falso');
    expect(res.body.user.email).toBe('teste@usp.br');
    expect(res.body.user.admin).toBe(true);
  });

  it('Deve retornar 401 se o usuário não for encontrado', async () => {
    // Banco não encontra nada
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .post('/login')
      .send({ email: 'invalido@usp.br', senha: '123' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Usuário não encontrado');
  });

  it('Deve retornar 401 se a senha for incorreta', async () => {
    // Banco retorna o usuário
    pool.query.mockResolvedValueOnce({ 
      rows: [{ gmail: 'teste@usp.br', senha: 'senha_correta' }] 
    });

    const res = await request(app)
      .post('/login')
      .send({ email: 'teste@usp.br', senha: 'senha_errada' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Senha incorreta');
  });

  it('Deve retornar 500 se o banco de dados falhar', async () => {
    pool.query.mockRejectedValueOnce(new Error('Falha no DB'));

    const res = await request(app)
      .post('/login')
      .send({ email: 'teste@usp.br', senha: '123' });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Erro interno no servidor');
  });
});