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


  test('getPreview busca o endpoint de previa do contexto', async () => {
    const { client, calls } = mockClient({
      scope: 'all',
      window_size: 12,
      max_age_days: 30,
      archived_total: 271,
      window_messages: 12,
      chats: ['Você', 'Ana'],
      sample: ['reuniao com a Ana quinta 10h'],
    });

    const api = new WhatsAppContextApi(client);
    const res = await api.getPreview();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].ep, '/api/v1/integrations/whatsapp/context-preview');
    assert.equal(res.archived_total, 271);
    assert.equal(res.window_messages, 12);
    assert.equal(res.max_age_days, 30);
    assert.deepEqual(res.chats, ['Você', 'Ana']);
    assert.equal(res.sample.length, 1);
  });


  test('getDirectory busca o endpoint do diretorio de conversas', async () => {
    const { client, calls } = mockClient({
      contacts: [{ name: 'Ana', preview: 'pode ser quinta as 10h', age: 'ha 2h' }],
      pending: [{ name: 'Ana', preview: 'pode ser quinta as 10h', age: 'ha 2h', pending: true }],
    });

    const api = new WhatsAppContextApi(client);
    const res = await api.getDirectory();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].ep, '/api/v1/integrations/whatsapp/context-directory');
    assert.equal(res.contacts.length, 1);
    assert.equal(res.contacts[0].name, 'Ana');
    assert.equal(res.pending.length, 1);
    assert.equal(res.pending[0].pending, true);
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
