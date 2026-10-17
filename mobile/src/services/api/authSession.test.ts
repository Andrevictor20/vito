import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AuthApi } from './authApi';
import { ApiClient } from './client';

describe('Sprint 13 AuthApi & Dual Token Sessions Unit Tests', () => {
  test('login e register armazenam access_token, refresh_token e session_id', async () => {
    let savedAccess: string | null = null;
    let savedRefresh: string | null = null;
    let savedSessionId: string | null = null;

    const client = {
      request: async () => ({
        user: { id: 'u1', name: 'André', email: 'andre@vito.ai' },
        token: 'jwt_15m',
        access_token: 'jwt_15m',
        refresh_token: 'vrt_30d_secret',
        session_id: 'sess-123',
        expires_in: 900,
      }),
      setAuthTokens: async (access: string | null, refresh?: string | null, sessionId?: string | null) => {
        savedAccess = access;
        savedRefresh = refresh || null;
        savedSessionId = sessionId || null;
      },
      setToken: async (t: string | null) => {
        savedAccess = t;
      },
    } as unknown as ApiClient;

    const authApi = new AuthApi(client);
    const res = await authApi.login('andre@vito.ai', 'senha123', 'Galaxy S24');
    assert.equal(res.token, 'jwt_15m');
    assert.equal(savedAccess, 'jwt_15m');
    assert.equal(savedRefresh, 'vrt_30d_secret');
    assert.equal(savedSessionId, 'sess-123');
  });

  test('getSessions, revokeSession e revokeOtherSessions chamam as rotas REST corretas', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        if (ep === '/api/v1/auth/sessions' && (!opt?.method || opt?.method === 'GET')) {
          return {
            sessions: [
              {
                id: 'sess-1',
                user_id: 'u1',
                device_name: 'Galaxy S24',
                ip_address: '192.168.1.10',
                expires_at: '2026-11-15T00:00:00Z',
                created_at: '2026-10-16T00:00:00Z',
                last_used_at: '2026-10-16T00:00:00Z',
                is_current: true,
              },
            ],
            current_session_id: 'sess-1',
          };
        }
        return { status: 'revoked' };
      },
      getSessionId: () => 'sess-1',
      getRefreshToken: () => 'vrt_abc',
    } as unknown as ApiClient;

    const authApi = new AuthApi(client);

    const list = await authApi.getSessions();
    assert.equal(calls[0].ep, '/api/v1/auth/sessions');
    assert.equal(list.sessions.length, 1);
    assert.equal(list.sessions[0].is_current, true);

    await authApi.revokeSession('sess-2');
    assert.equal(calls[1].ep, '/api/v1/auth/sessions/sess-2');
    assert.equal(calls[1].opt?.method, 'DELETE');

    await authApi.revokeOtherSessions();
    assert.equal(calls[2].ep, '/api/v1/auth/sessions/others');
    assert.equal(calls[2].opt?.method, 'DELETE');

    await authApi.logoutSession();
    assert.equal(calls[3].ep, '/api/v1/auth/logout');
    assert.equal(calls[3].opt?.method, 'POST');
  });
});
