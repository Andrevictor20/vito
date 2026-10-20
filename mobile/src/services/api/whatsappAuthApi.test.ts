import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { WhatsAppAuthApi } from './whatsappAuthApi';
import { ApiClient } from './client';

// Contrato real do backend (backend/internal/handler/whatsapp_auth_handler.go):
//   { "data": { "user": {...}, "token_pair": { access_token, refresh_token, session_id, expires_in } } }
// O cliente mobile precisa desembrulhar esse envelope antes de usar os tokens.
const BACKEND_VERIFY_RESPONSE = {
  data: {
    user: {
      id: 'usr-1',
      name: 'User 5511999998888',
      email: '5511999998888@vito.local',
      phone: '+5511999998888',
    },
    token_pair: {
      access_token: 'jwt-access-token',
      refresh_token: 'jwt-refresh-token',
      session_id: 'sess-123',
      expires_in: 900,
    },
  },
};

describe('WhatsAppAuthApi Unit Tests', () => {
  test('requestOTP envia número de telefone via POST para /api/v1/auth/whatsapp/request-otp', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        return {
          status: 'sent',
          phone: '+5511999998888',
          expires_in: 300,
        };
      },
    } as unknown as ApiClient;

    const api = new WhatsAppAuthApi(client);
    const res = await api.requestOTP('+55 (11) 99999-8888');

    assert.equal(calls.length, 1);
    assert.equal(calls[0].ep, '/api/v1/auth/whatsapp/request-otp');
    assert.equal(calls[0].opt?.method, 'POST');
    assert.equal(calls[0].opt?.body, JSON.stringify({ phone: '+55 (11) 99999-8888' }));
    assert.equal(res.status, 'sent');
    assert.equal(res.expires_in, 300);
  });

  test('requestOTP tolera o envelope { data: { message } } devolvido pelo backend', async () => {
    const client = {
      request: async () => ({ data: { message: 'Código de acesso enviado com sucesso para o seu WhatsApp' } }),
    } as unknown as ApiClient;

    const api = new WhatsAppAuthApi(client);
    const res = await api.requestOTP('+5511999998888');

    assert.equal(res.status, 'sent');
    assert.ok(res.message);
    assert.match(res.message, /enviado com sucesso/);
  });

  test('verifyOTP desembrulha { data: { user, token_pair } } e persiste os tokens', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    let savedAccess: string | null = null;
    let savedRefresh: string | null = null;
    let savedSession: string | null = null;

    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        return BACKEND_VERIFY_RESPONSE;
      },
      setAuthTokens: async (a: string, r: string, s: string) => {
        savedAccess = a;
        savedRefresh = r;
        savedSession = s;
      },
    } as unknown as ApiClient;

    const api = new WhatsAppAuthApi(client);
    const res = await api.verifyOTP('+5511999998888', '123456');

    assert.equal(calls.length, 1);
    assert.equal(calls[0].ep, '/api/v1/auth/whatsapp/verify-otp');
    assert.equal(calls[0].opt?.method, 'POST');
    const parsedBody = JSON.parse(calls[0].opt?.body as string);
    assert.equal(parsedBody.phone, '+5511999998888');
    assert.equal(parsedBody.code, '123456');
    assert.ok(parsedBody.device_name);

    // Tokens extraídos de data.token_pair
    assert.equal(savedAccess, 'jwt-access-token');
    assert.equal(savedRefresh, 'jwt-refresh-token');
    assert.equal(savedSession, 'sess-123');
    assert.equal(res.access_token, 'jwt-access-token');
    assert.equal(res.refresh_token, 'jwt-refresh-token');
    assert.equal(res.session_id, 'sess-123');
    // Usuário extraído de data.user
    assert.equal(res.user.id, 'usr-1');
    assert.equal(res.user.phone, '+5511999998888');
  });

  test('verifyOTP aceita também o formato flat (compatibilidade)', async () => {
    const client = {
      request: async () => ({
        access_token: 'flat-access',
        refresh_token: 'flat-refresh',
        session_id: 'sess-flat',
        user: { id: 'usr-2', name: 'Flat', email: 'flat@vito.local' },
      }),
      setAuthTokens: async () => {},
    } as unknown as ApiClient;

    const api = new WhatsAppAuthApi(client);
    const res = await api.verifyOTP('+5511999998888', '123456');

    assert.equal(res.access_token, 'flat-access');
    assert.equal(res.session_id, 'sess-flat');
    assert.equal(res.user.id, 'usr-2');
  });

  test('verifyOTP falha de forma explícita quando a resposta não traz usuário nem tokens', async () => {
    const client = {
      request: async () => ({ data: {} }),
      setAuthTokens: async () => {
        throw new Error('não deveria persistir tokens em resposta inválida');
      },
    } as unknown as ApiClient;

    const api = new WhatsAppAuthApi(client);

    await assert.rejects(
      () => api.verifyOTP('+5511999998888', '123456'),
      /resposta de login do WhatsApp/i
    );
  });

  test('linkPhone envia número de telefone via POST para /api/v1/auth/whatsapp/link', async () => {
    const calls: { ep: string; opt?: RequestInit }[] = [];
    const client = {
      request: async <T>(ep: string, opt?: RequestInit): Promise<T> => {
        calls.push({ ep, opt });
        return { data: { status: 'linked', message: 'Telefone vinculado com sucesso' } } as T;
      },
    } as unknown as ApiClient;

    const api = new WhatsAppAuthApi(client);
    const res = await api.linkPhone('+5511999998888');

    assert.equal(calls.length, 1);
    assert.equal(calls[0].ep, '/api/v1/auth/whatsapp/link');
    assert.equal(calls[0].opt?.method, 'POST');
    assert.equal(calls[0].opt?.body, JSON.stringify({ phone: '+5511999998888' }));
    assert.equal(res.data.status, 'linked');
  });
});
