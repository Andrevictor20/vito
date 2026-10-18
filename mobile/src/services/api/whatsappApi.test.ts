import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { WhatsAppApi } from './whatsappApi';
import { ApiClient } from './client';

describe('WhatsAppApi Unit Tests', () => {
  test('getStatus busca o endpoint correto de status', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        return {
          id: 'wa-1',
          status: 'connected',
          phone: '5511999998888',
          last_connected_at: '2026-10-17T20:00:00Z',
        };
      },
    } as unknown as ApiClient;

    const api = new WhatsAppApi(client);
    const res = await api.getStatus();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].ep, '/api/v1/integrations/whatsapp/status');
    assert.equal(res.status, 'connected');
    assert.equal(res.phone, '5511999998888');
  });

  test('requestPairingCode envia telefone sanitizado via POST', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        return {
          pairing_code: 'ABCD-1234',
          status: 'connecting',
        };
      },
    } as unknown as ApiClient;

    const api = new WhatsAppApi(client);
    const res = await api.requestPairingCode('11999998888');

    assert.equal(calls.length, 1);
    assert.equal(calls[0].ep, '/api/v1/integrations/whatsapp/pairing-code');
    assert.equal(calls[0].opt?.method, 'POST');
    assert.equal(calls[0].opt?.body, JSON.stringify({ phone: '11999998888' }));
    assert.equal(res.pairing_code, 'ABCD-1234');
    assert.equal(res.status, 'connecting');
  });

  test('disconnect envia requisição DELETE para desconectar', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        return {
          message: 'WhatsApp desconectado com sucesso',
          status: 'disconnected',
        };
      },
    } as unknown as ApiClient;

    const api = new WhatsAppApi(client);
    const res = await api.disconnect();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].ep, '/api/v1/integrations/whatsapp/disconnect');
    assert.equal(calls[0].opt?.method, 'DELETE');
    assert.equal(res.status, 'disconnected');
  });

  test('getContacts consulta o endpoint correto e retorna lista de contatos correspondidos', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        return {
          contacts: [
            {
              user_id: 'user-friend-2',
              name: 'Amigo Vito',
              phone: '5511988887777',
              email: 'friend@vito.local',
            },
          ],
          count: 1,
        };
      },
    } as unknown as ApiClient;

    const api = new WhatsAppApi(client);
    const res = await api.getContacts();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].ep, '/api/v1/integrations/whatsapp/contacts');
    assert.equal(res.count, 1);
    assert.equal(res.contacts[0].user_id, 'user-friend-2');
    assert.equal(res.contacts[0].name, 'Amigo Vito');
  });
});
