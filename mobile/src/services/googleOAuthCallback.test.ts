import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isGoogleOAuthCallbackUrl,
  parseGoogleOAuthCallback,
  parseOAuthCallbackQuery,
} from './googleOAuthCallback';

const USER = {
  id: 'user-1',
  name: 'André Victor',
  email: 'andre@example.com',
};

function loginCallback(overrides: Record<string, string> = {}): string {
  const params: Record<string, string> = {
    status: 'success',
    token: 'access-token-123',
    access_token: 'access-token-123',
    refresh_token: 'refresh-token-456',
    session_id: 'session-789',
    user: JSON.stringify(USER),
    ...overrides,
  };
  const query = Object.entries(params)
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return `vito://oauth/callback?${query}`;
}

describe('googleOAuthCallback parser', () => {
  test('reconhece apenas o path canônico /oauth/callback', () => {
    assert.equal(isGoogleOAuthCallbackUrl('vito://oauth/callback?status=success'), true);
    assert.equal(isGoogleOAuthCallbackUrl('vito://oauth/callback/'), true);
    assert.equal(isGoogleOAuthCallbackUrl('exp://192.168.1.5:8081/--/oauth/callback?x=1'), true);
    assert.equal(isGoogleOAuthCallbackUrl('vito://oauth/callback-evil?status=success'), false);
    assert.equal(isGoogleOAuthCallbackUrl('vito://oauth/other?status=success'), false);
    assert.equal(isGoogleOAuthCallbackUrl('https://vitoassistant.rasppi.cloud/auth/callback'), false);
    assert.equal(isGoogleOAuthCallbackUrl('https://evil.example/oauth/callback?x=1'), false);
    assert.equal(isGoogleOAuthCallbackUrl('https://vito.rasppi.cloud/oauth/callback?x=1'), true);
    assert.equal(isGoogleOAuthCallbackUrl('https://vitoassistant.rasppi.cloud/oauth/callback'), true);
    assert.equal(isGoogleOAuthCallbackUrl('http://localhost:8081/oauth/callback'), true);
    assert.equal(isGoogleOAuthCallbackUrl('http://127.0.0.1:8081/oauth/callback'), true);
    assert.equal(isGoogleOAuthCallbackUrl(null), false);
    assert.equal(isGoogleOAuthCallbackUrl(''), false);
  });

  test('extrai sessão completa do callback de login', () => {
    const parsed = parseGoogleOAuthCallback(loginCallback());
    assert.ok(parsed);
    assert.equal(parsed.kind, 'success');
    if (parsed.kind !== 'success') return;
    assert.equal(parsed.accessToken, 'access-token-123');
    assert.equal(parsed.refreshToken, 'refresh-token-456');
    assert.equal(parsed.sessionId, 'session-789');
    assert.equal(parsed.user.id, USER.id);
    assert.equal(parsed.user.email, USER.email);
    assert.equal(parsed.status, 'success');
  });

  test('decodifica uma única vez valores com espaço, + e % (formato url.QueryEscape do Go)', () => {
    const trickyUser = {
      id: 'user-2',
      name: 'André 100% + Vito',
      email: 'andre+vito@example.com',
    };
    const goStyleUser = encodeURIComponent(JSON.stringify(trickyUser)).replace(/%20/g, '+');
    const url = `vito://oauth/callback?status=success&access_token=tkn&user=${goStyleUser}`;

    const parsed = parseGoogleOAuthCallback(url);
    assert.ok(parsed);
    assert.equal(parsed.kind, 'success');
    if (parsed.kind !== 'success') return;
    assert.equal(parsed.user.name, 'André 100% + Vito');
    assert.equal(parsed.user.email, 'andre+vito@example.com');
  });

  test('classifica erro explícito do Google/backend', () => {
    const parsed = parseGoogleOAuthCallback(
      'vito://oauth/callback?status=error&error=access_denied'
    );
    assert.deepEqual(parsed, { kind: 'error', error: 'access_denied' });

    const statusOnly = parseGoogleOAuthCallback('vito://oauth/callback?status=denied');
    assert.deepEqual(statusOnly, { kind: 'error', error: 'denied' });
  });

  test('marca como inválido um callback sem tokens ou com usuário malformado', () => {
    const missingTokens = parseGoogleOAuthCallback(
      'vito://oauth/callback?status=success&provider=google&email=andre%40example.com'
    );
    assert.equal(missingTokens?.kind, 'invalid');

    const brokenUser = parseGoogleOAuthCallback(
      'vito://oauth/callback?status=success&access_token=tkn&user=not-json'
    );
    assert.equal(brokenUser?.kind, 'invalid');

    const userWithoutId = parseGoogleOAuthCallback(
      `vito://oauth/callback?status=success&access_token=tkn&user=${encodeURIComponent(JSON.stringify({ name: 'Sem ID' }))}`
    );
    assert.equal(userWithoutId?.kind, 'invalid');
  });

  test('retorna null para URLs que não são callback OAuth', () => {
    assert.equal(parseGoogleOAuthCallback('vito://home'), null);
    assert.equal(parseGoogleOAuthCallback('https://example.com/oauth/callback?x=1'), null);
    assert.equal(parseGoogleOAuthCallback(null), null);
  });

  test('parseOAuthCallbackQuery entrega a query de Calendar/Gmail já decodificada uma vez', () => {
    const query = parseOAuthCallbackQuery(
      'vito://oauth/callback?status=success&provider=google&email=andre%2Bvito%40example.com'
    );
    assert.deepEqual(query, {
      status: 'success',
      provider: 'google',
      email: 'andre+vito@example.com',
    });

    assert.equal(parseOAuthCallbackQuery('vito://home?status=success'), null);
  });

  test('ignora fragmento e aceita query vazia em callback sem parâmetros', () => {
    const parsed = parseGoogleOAuthCallback('vito://oauth/callback#fragment');
    assert.equal(parsed?.kind, 'invalid');
    assert.deepEqual(parseOAuthCallbackQuery('vito://oauth/callback#fragment'), {});
  });
});
