import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPendingCacheKey,
  parseCachedPendingItems,
  isNetworkError,
} from './pendingCache';

describe('pendingCache', () => {
  it('chave sem usuário usa sufixo padrão', () => {
    assert.equal(getPendingCacheKey(), '@vito_cache_pending');
    assert.equal(getPendingCacheKey(undefined), '@vito_cache_pending');
  });

  it('chave isola por conta', () => {
    assert.equal(getPendingCacheKey('u1'), '@vito_cache_pending_u1');
  });

  it('nulo e JSON inválido devolvem null', () => {
    assert.equal(parseCachedPendingItems(null), null);
    assert.equal(parseCachedPendingItems('{{{'), null);
  });

  it('não-array devolve null', () => {
    assert.equal(parseCachedPendingItems('{"a":1}'), null);
    assert.equal(parseCachedPendingItems('"x"'), null);
  });

  it('array válido é devolvido', () => {
    const raw = JSON.stringify([{ id: 'p1', title: 'Ler livro' }]);
    assert.deepEqual(parseCachedPendingItems(raw), [{ id: 'p1', title: 'Ler livro' }]);
  });

  it('detecta erro de rede (fetch/CORS/offline)', () => {
    assert.equal(isNetworkError(new TypeError('Failed to fetch')), true);
    assert.equal(isNetworkError(new Error('Network request failed')), true);
    assert.equal(
      isNetworkError(new Error('Tempo limite esgotado (15s) ao conectar no servidor (https://x).')),
      true
    );
  });

  it('não confunde erro HTTP com erro de rede', () => {
    assert.equal(isNetworkError(new Error('Erro HTTP 500')), false);
    assert.equal(isNetworkError(new Error('falha ao listar pendências')), false);
    assert.equal(isNetworkError(null), false);
  });
});
