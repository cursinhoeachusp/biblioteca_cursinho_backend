import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');

// Como o seu controller usa process.env logo na importação, 
// precisamos definir valores falsos para os testes não quebrarem
process.env.ACCESS_TOKEN_SECRET = 'segredo_access';
process.env.REFRESH_TOKEN_SECRET = 'segredo_refresh';
process.env.ADMIN_PASSWORD_HASH = 'hash_falso_do_admin';

const autenticacaoRoutes = require('./routes');

const app = express();
app.use(express.json());
// Monta as rotas na base /autenticacao
app.use('/autenticacao', autenticacaoRoutes);

describe('Testes da API de Autenticação (Admin)', () => {
  
  beforeEach(() => {
    // Como esse controller não usa o DB, nós espionamos o bcrypt
    vi.spyOn(bcrypt, 'compare');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /autenticacao/login', () => {
    
    it('Deve fazer login com sucesso e retornar os tokens', async () => {
      // Simula que a senha digitada bate com o hash (retorna true)
      bcrypt.compare.mockResolvedValueOnce(true);

      const response = await request(app)
        .post('/autenticacao/login') // Caminho completo corrigido
        .send({
          username: 'admin',
          password: 'senha_correta'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('Deve retornar status 401 se o usuário não for o admin', async () => {
      const response = await request(app)
        .post('/autenticacao/login')
        .send({
          username: 'usuario_errado',
          password: '123'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Usuário inválido.');
    });

    it('Deve retornar status 401 se a senha for incorreta', async () => {
      // Simula que a senha está errada (retorna false)
      bcrypt.compare.mockResolvedValueOnce(false);

      const response = await request(app)
        .post('/autenticacao/login')
        .send({
          username: 'admin',
          password: 'senha_errada'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Senha incorreta.');
    });
  });
});