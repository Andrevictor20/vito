import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { WhatsAppAuthApi } from './whatsappAuthApi';
import { ApiClient } from './client';

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

  test('verifyOTP envia phone e code via POST e armazena auth tokens no client', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    let savedAccess: string | null = null;
    let savedRefresh: string | null = null;
    let savedSession: string | null = null;

    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        return {
          access_token: 'jwt-access-token',
          refresh_token: 'jwt-refresh-token',
          session_id: 'sess-123',
          user: {
            id: 'usr-1',
            name: 'User 5511999998888',
            email: '5511999998888@whatsapp.vito.local',
            phone: '+5511999998888',
          },
        };
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
    assert.equal(calls[0].opt?.body, JSON.stringify({ phone: '+5511999998888', code: '123456' }));
    assert.equal(savedAccess, 'jwt-access-token');
    assert.equal(savedRefresh, 'jwt-refresh-token');
    assert.equal(savedSession, 'sess-123');
    assert.equal(res.user.phone, '+5511999998888');
  });
});
