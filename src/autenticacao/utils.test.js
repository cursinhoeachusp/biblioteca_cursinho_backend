import { describe, it, expect, vi } from 'vitest';
const { generateAccessToken, generateRefreshToken } = require('./utils'); 
const jwt = require('jsonwebtoken'); 

describe('Testes dos utilitários de Autenticação', () => {
  
  it('Deve gerar um Access Token JWT com sucesso', () => {
    const signSpy = vi.spyOn(jwt, 'sign').mockReturnValue('mock_access_token_123');
    const mockUser = { username: 'admin' };
    const secret = 'meu_segredo_access';

    const token = generateAccessToken(mockUser, secret);

    expect(token).toBe('mock_access_token_123');
    expect(signSpy).toHaveBeenCalledWith(
      { username: mockUser.username }, 
      secret, 
      { expiresIn: '1m' }
    );
    signSpy.mockRestore(); 
  });

  it('Deve gerar um Refresh Token JWT com sucesso', () => {
    const signSpy = vi.spyOn(jwt, 'sign').mockReturnValue('mock_refresh_token_456');
    const mockUser = { username: 'admin' };
    const secret = 'meu_segredo_refresh';

    const token = generateRefreshToken(mockUser, secret);

    expect(token).toBe('mock_refresh_token_456');
    expect(signSpy).toHaveBeenCalledWith(
      { username: mockUser.username }, 
      secret, 
      { expiresIn: '10m' }
    );
    signSpy.mockRestore();
  });
});