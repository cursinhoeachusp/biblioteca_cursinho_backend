import { describe, it, expect } from 'vitest';
const { formatarUsuario } = require('./utils');

describe('Testes do utilitário de Usuários', () => {
  
  it('Deve formatar corretamente um usuário regular completo', () => {
    const mockDbUser = {
      id: 1,
      nome: 'João da Silva',
      cpf: '12345678900',
      gmail: 'joao@gmail.com',
      telefone: '11999999999',
      status_regularidade: true,
      logradouro: 'Rua das Flores',
      numero: '123',
      complemento: 'Apto 42',
      cep: '01234-567'
    };

    const resultado = formatarUsuario(mockDbUser);

    expect(resultado.id).toBe(1);
    expect(resultado.status).toBe('Regular');
    expect(resultado.address).toBe('Rua das Flores, 123 - Apto 42\n01234-567');
  });

  it('Deve formatar corretamente um usuário bloqueado e sem complemento', () => {
    const mockDbUser = {
      id: 2,
      nome: 'Maria Souza',
      cpf: '09876543211',
      gmail: 'maria@gmail.com',
      telefone: '11888888888',
      status_regularidade: false,
      logradouro: 'Avenida Paulista',
      numero: '1000',
      complemento: null,
      cep: '01310-100'
    };

    const resultado = formatarUsuario(mockDbUser);

    expect(resultado.status).toBe('Bloqueado');
    expect(resultado.address).toBe('Avenida Paulista, 1000\n01310-100');
  });
});