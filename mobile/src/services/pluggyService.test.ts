import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, createConnectToken, listItems, PluggyError } from './pluggyService';

type Call = { url: string; init?: RequestInit };

function fakeFetch(status: number, body: unknown, calls: Call[] = []): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
  }) as unknown as typeof fetch;
}

const throwingFetch = (async () => {
  throw new TypeError('Network request failed');
}) as unknown as typeof fetch;

describe('pluggyService', () => {
  it('authenticate retorna apiKey e envia clientId/clientSecret', async () => {
    const calls: Call[] = [];
    const key = await authenticate('id', 'sec', fakeFetch(200, { apiKey: 'K1' }, calls));
    assert.equal(key, 'K1');
    assert.equal(calls[0].url, 'https://api.pluggy.ai/auth');
    assert.equal(calls[0].init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { clientId: 'id', clientSecret: 'sec' });
  });

  for (const status of [401, 403]) {
    it(`authenticate ${status} → invalid_keys`, async () => {
      await assert.rejects(authenticate('a', 'b', fakeFetch(status, {})), (e: unknown) => {
        assert.ok(e instanceof PluggyError);
        assert.equal(e.kind, 'invalid_keys');
        assert.equal(e.status, status);
        return true;
      });
    });
  }

  it('authenticate falha de rede → network', async () => {
    await assert.rejects(authenticate('a', 'b', throwingFetch), (e: unknown) => {
      assert.ok(e instanceof PluggyError);
      assert.equal(e.kind, 'network');
      return true;
    });
  });

  it('authenticate 500 → http', async () => {
    await assert.rejects(authenticate('a', 'b', fakeFetch(500, {})), (e: unknown) => {
      assert.ok(e instanceof PluggyError);
      assert.equal(e.kind, 'http');
      assert.equal(e.status, 500);
      return true;
    });
  });

  it('authenticate sem apiKey na resposta → http', async () => {
    await assert.rejects(authenticate('a', 'b', fakeFetch(200, {})), (e: unknown) => {
      assert.ok(e instanceof PluggyError);
      assert.equal(e.kind, 'http');
      return true;
    });
  });

  it('createConnectToken usa X-API-KEY e retorna accessToken', async () => {
    const calls: Call[] = [];
    const tok = await createConnectToken('K', 'user-1', fakeFetch(200, { accessToken: 'T' }, calls));
    assert.equal(tok, 'T');
    assert.equal(calls[0].url, 'https://api.pluggy.ai/connect_token');
    assert.equal((calls[0].init?.headers as Record<string, string>)['X-API-KEY'], 'K');
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { clientUserId: 'user-1' });
  });

  it('listItems retorna results ou [] e usa GET com X-API-KEY', async () => {
    const calls: Call[] = [];
    const items = await listItems('K', fakeFetch(200, { results: [{ id: 'i1' }] }, calls));
    assert.equal(items.length, 1);
    assert.equal(calls[0].url, 'https://api.pluggy.ai/items');
    assert.equal((calls[0].init?.headers as Record<string, string>)['X-API-KEY'], 'K');
    assert.deepEqual(await listItems('K', fakeFetch(200, {})), []);
  });

  it('listItems 401 → invalid_keys', async () => {
    await assert.rejects(listItems('K', fakeFetch(401, {})), (e: unknown) => {
      assert.ok(e instanceof PluggyError);
      assert.equal(e.kind, 'invalid_keys');
      return true;
    });
  });
});
