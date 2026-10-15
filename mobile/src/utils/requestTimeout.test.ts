import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_ENDPOINT_TIMEOUT_MS,
  resolveTimeoutMs,
  isAbortLike,
} from './requestTimeout';

describe('requestTimeout', () => {
  it('endpoints de IA usam timeout longo', () => {
    assert.equal(AI_ENDPOINT_TIMEOUT_MS, 120000);
    assert.equal(resolveTimeoutMs('/api/v1/triggers/abc/run'), 120000);
    assert.equal(resolveTimeoutMs('/api/v1/triggers/abc/test'), 120000);
  });

  it('endpoints comuns usam o padrão de 15s', () => {
    assert.equal(resolveTimeoutMs('/api/v1/todos'), 15000);
    assert.equal(resolveTimeoutMs('/api/v1/triggers'), 15000);
  });

  it('override explícito vence', () => {
    assert.equal(resolveTimeoutMs('/api/v1/todos', 5000), 5000);
  });

  it('detecta AbortError clássico', () => {
    const err = new Error('Aborted');
    err.name = 'AbortError';
    assert.equal(isAbortLike(err), true);
  });

  it('detecta mensagem de cancelamento sem name padronizado', () => {
    assert.equal(isAbortLike(new Error('fetch failed: fetch request has been canceled')), true);
    assert.equal(isAbortLike(new Error('Fetch request has been cancelled')), true);
  });

  it('não confunde erro HTTP/rede', () => {
    assert.equal(isAbortLike(new Error('Erro HTTP 500')), false);
    assert.equal(isAbortLike(new Error('Failed to fetch')), false);
    assert.equal(isAbortLike(null), false);
  });
});
