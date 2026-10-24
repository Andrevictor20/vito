import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GmailApi } from './gmailApi';
import { ApiClient } from './client';

describe('GmailApi Unit Tests', () => {
  test('getStatus consulta /api/v1/integrations/gmail/status', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        return {
          connected: true,
          email: 'usuario@gmail.com',
          last_scanned_at: '2026-10-17T20:00:00Z',
        };
      },
    } as unknown as ApiClient;

    const api = new GmailApi(client);
    const res = await api.getStatus();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].ep, '/api/v1/integrations/gmail/status');
    assert.equal(res.connected, true);
    assert.equal(res.email, 'usuario@gmail.com');
    assert.equal(res.last_scanned_at, '2026-10-17T20:00:00Z');
  });

  test('getStatus desempacota resposta aninhada em data', async () => {
    const client = {
      request: async () => ({
        data: {
          connected: true,
          email: 'aninhado@gmail.com',
          last_scanned_at: '2026-10-18T10:00:00Z',
        },
      }),
    } as unknown as ApiClient;

    const api = new GmailApi(client);
    const res = await api.getStatus();

    assert.equal(res.connected, true);
    assert.equal(res.email, 'aninhado@gmail.com');
    assert.equal(res.last_scanned_at, '2026-10-18T10:00:00Z');
  });

  test('scanEmails envia requisição POST com parâmetros e timeout de 60s', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        return {
          scanned_count: 5,
          bills: [
            {
              id: 'bill-1',
              email_id: 'msg-1',
              sender: 'financeiro@empresa.com',
              subject: 'Boleto mensal',
              received_at: '2026-10-17T10:00:00Z',
              amount: 150.5,
              due_date: '2026-10-25',
              linha_digitavel: '34191.79001 01043.510047 91020.150008 8 98760000015050',
            },
          ],
          flights: [],
          urgent_emails: [],
        };
      },
    } as unknown as ApiClient;

    const api = new GmailApi(client);
    const res = await api.scanEmails({ days: 7, limit: 20 });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].ep, '/api/v1/integrations/gmail/scan');
    assert.equal(calls[0].opt?.method, 'POST');
    assert.equal(calls[0].opt?.timeoutMs, 60000);
    assert.equal(calls[0].opt?.body, JSON.stringify({ days: 7, limit: 20 }));
    assert.equal(res.scanned_count, 5);
    assert.equal(res.bills.length, 1);
    assert.equal(res.bills[0].amount, 150.5);
  });

  test('disconnect envia requisição DELETE para /api/v1/integrations/gmail/disconnect', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        return { message: 'Gmail integration disconnected successfully' };
      },
    } as unknown as ApiClient;

    const api = new GmailApi(client);
    const res = await api.disconnect();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].ep, '/api/v1/integrations/gmail/disconnect');
    assert.equal(calls[0].opt?.method, 'DELETE');
    assert.equal(res.message, 'Gmail integration disconnected successfully');
  });

  test('createDraft envia rascunho via POST /api/v1/integrations/gmail/draft', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        return { id: 'draft-1', thread_id: 'th-1' };
      },
    } as unknown as ApiClient;

    const api = new GmailApi(client);
    const res = await api.createDraft({
      to: 'cliente@exemplo.com',
      subject: 'Proposta Vito',
      body: 'Olá, segue a proposta.',
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].ep, '/api/v1/integrations/gmail/draft');
    assert.equal(calls[0].opt?.method, 'POST');
    assert.equal(res.id, 'draft-1');
  });

  test('sendEmail envia e-mail via POST /api/v1/integrations/gmail/send e normaliza message_id', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        return { data: { message_id: 'msg-sent-99', message: 'Enviado pelo servidor' } };
      },
    } as unknown as ApiClient;

    const api = new GmailApi(client);
    const payload = {
      to: 'destinatario@exemplo.com',
      subject: 'Assunto de Teste',
      body: 'Corpo do e-mail',
    };
    const res = await api.sendEmail(payload);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].ep, '/api/v1/integrations/gmail/send');
    assert.equal(calls[0].opt?.method, 'POST');
    assert.equal(calls[0].opt?.body, JSON.stringify(payload));
    assert.equal(res.id, 'msg-sent-99');
    assert.equal(res.message, 'Enviado pelo servidor');
  });
});
