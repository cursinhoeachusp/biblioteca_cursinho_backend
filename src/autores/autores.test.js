import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const request = require('supertest');
const express = require('express');
const autoresRoutes = require('./routes');
const pool = require('../config/db'); 

// Cria uma mini-instância do app Express
const app = express();
app.use(express.json());
app.use('/autores', autoresRoutes);

describe('Testes da API de Autores', () => {
  
  beforeEach(() => {
    // Espiona o método 'query' do pool real e o transforma em uma função mockada
    vi.spyOn(pool, 'query');
  });

  afterEach(() => {
    // Restaura a função original após cada teste para garantir isolamento
    vi.restoreAllMocks();
  });

  describe('GET /autores', () => {
    it('Deve retornar uma lista de autores com status 200', async () => {
      const mockAutores = [
        { id: 1, nome: 'Machado de Assis' },
        { id: 2, nome: 'Clarice Lispector' }
      ];
      
      // Agora o mockResolvedValueOnce vai funcionar perfeitamente
      pool.query.mockResolvedValueOnce({ rows: mockAutores });

      const response = await request(app).get('/autores');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAutores);
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it('Deve retornar status 500 se o banco de dados falhar', async () => {
      pool.query.mockRejectedValueOnce(new Error('Erro de conexão'));

      const response = await request(app).get('/autores');

      expect(response.status).toBe(500);
      expect(response.text).toBe('Erro ao buscar autores');
    });
  });

  describe('POST /autores', () => {
    it('Deve criar um novo autor e retornar status 201', async () => {
      const novoAutor = { nome: 'Jorge Amado' };
      const autorCriado = { id: 3, nome: 'Jorge Amado' };
      
      pool.query.mockResolvedValueOnce({ rows: [autorCriado] });

      const response = await request(app)
        .post('/autores')
        .send(novoAutor);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(autorCriado);
      
      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String), 
        [novoAutor.nome]
      );
    });
  });

  describe('DELETE /autores/:id', () => {
    it('Deve remover um autor com sucesso e retornar status 200', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1 });

      const response = await request(app).delete('/autores/1');

      expect(response.status).toBe(200);
      expect(response.text).toBe('Autor removido com sucesso');
    });

    it('Deve retornar status 404 se o autor não existir', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 0 });

      const response = await request(app).delete('/autores/999');

      expect(response.status).toBe(404);
      expect(response.text).toBe('Autor não encontrado');
    });
  });
});