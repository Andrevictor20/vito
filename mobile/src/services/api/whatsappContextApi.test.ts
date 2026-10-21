import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { WhatsAppContextApi, WHATSAPP_CONTEXT_SCOPES, WHATSAPP_CONTEXT_WINDOW_SIZES } from './whatsappContextApi';
import { ApiClient } from './client';

function mockClient(response: unknown = {}) {
  const calls: { ep: string; opt?: any }[] = [];
  const client = {
    request: async (ep: string, opt?: any) => {
      calls.push({ ep, opt });
      return response;
    },
  } as unknown as ApiClient;
  return { client, calls };
}

describe('WhatsAppContextApi Unit Tests', () => {
  test('getSettings consulta o endpoint de preferências de contexto', async () => {
    const { client, calls } = mockClient({ scope: 'all', window_size: 12 });

    const api = new WhatsAppContextApi(client);
    const res = await api.getSettings();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].ep, '/api/v1/integrations/whatsapp/context-settings');
    assert.equal(res.scope, 'all');
    assert.equal(res.window_size, 12);
  });

  test('updateSettings envia PUT com scope e window_size', async () => {
    const { client, calls } = mockClient({ scope: 'chat', window_size: 24 });

    const api = new WhatsAppContextApi(client);
    const res = await api.updateSettings('chat', 24);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].ep, '/api/v1/integrations/whatsapp/context-settings');
    assert.equal(calls[0].opt?.method, 'PUT');
    assert.equal(calls[0].opt?.body, JSON.stringify({ scope: 'chat', window_size: 24 }));
    assert.equal(res.scope, 'chat');
    assert.equal(res.window_size, 24);
  });

  test('purgeMessages envia DELETE para apagar o histórico', async () => {
    const { client, calls } = mockClient({ message: 'Histórico do WhatsApp limpo com sucesso' });

    const api = new WhatsAppContextApi(client);
    const res = await api.purgeMessages();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].ep, '/api/v1/integrations/whatsapp/context-messages');
    assert.equal(calls[0].opt?.method, 'DELETE');
    assert.ok(res.message.length > 0);
  });

  test('catálogo de escopos cobre off, quoted, chat e all', () => {
    const values = WHATSAPP_CONTEXT_SCOPES.map((s) => s.value);
    assert.deepEqual(values, ['off', 'quoted', 'chat', 'all']);
    WHATSAPP_CONTEXT_SCOPES.forEach((s) => {
      assert.ok(s.label.length > 0, `escopo ${s.value} precisa de rótulo`);
      assert.ok(s.hint.length > 0, `escopo ${s.value} precisa de texto auxiliar`);
    });
  });

  test('tamanhos de janela disponíveis são ascendentes e limitados', () => {
    assert.deepEqual(WHATSAPP_CONTEXT_WINDOW_SIZES, [6, 12, 24, 48]);
    assert.ok(WHATSAPP_CONTEXT_WINDOW_SIZES[WHATSAPP_CONTEXT_WINDOW_SIZES.length - 1] <= 48);
  });
});
