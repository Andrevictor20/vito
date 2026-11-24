import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearPluggyApiKeyCache,
  getOrRefreshPluggyApiKey,
  pluggyFetchWithRetry,
} from '../features/finance/services/pluggyHttp';

describe('SyncEngine v2 (Onda 0-C)', () => {
  beforeEach(() => {
    clearPluggyApiKeyCache();
  });

  it('cacheia apiKey por 110 min e renova quando forceRefresh=true', async () => {
    let authCalls = 0;
    const mockFetch = (async () => {
      authCalls += 1;
      return new Response(JSON.stringify({ apiKey: `key-${authCalls}` }), { status: 200 });
    }) as unknown as typeof fetch;

    const k1 = await getOrRefreshPluggyApiKey('cid', 'csec', false, mockFetch);
    const k2 = await getOrRefreshPluggyApiKey('cid', 'csec', false, mockFetch);
    assert.equal(k1, 'key-1');
    assert.equal(k2, 'key-1');
    assert.equal(authCalls, 1);

    const k3 = await getOrRefreshPluggyApiKey('cid', 'csec', true, mockFetch);
    assert.equal(k3, 'key-2');
    assert.equal(authCalls, 2);
  });

  it('faz retry em HTTP 503 e resolve na tentativa seguinte', async () => {
    let calls = 0;
    const mockFetch = (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response('unavailable', { status: 503 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;

    const res = await pluggyFetchWithRetry('https://api.pluggy.ai/items/1', {}, {
      fetchImpl: mockFetch,
      sleepImpl: async () => {},
      maxRetries: 2,
    });
    assert.equal(res.status, 200);
    assert.equal(calls, 2);
  });

  it('faz retry em HTTP 429 respeitando Retry-After', async () => {
    let calls = 0;
    const slept: number[] = [];
    const mockFetch = (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response('rate limited', {
          status: 429,
          headers: { 'Retry-After': '1' },
        });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;

    const res = await pluggyFetchWithRetry('https://api.pluggy.ai/items/1', {}, {
      fetchImpl: mockFetch,
      sleepImpl: async (ms) => {
        slept.push(ms);
      },
      maxRetries: 2,
    });
    assert.equal(res.status, 200);
    assert.equal(calls, 2);
    assert.equal(slept.length, 1);
    assert.ok(slept[0] >= 1000);
  });
});
