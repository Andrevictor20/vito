import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ChatApi } from '../services/api/chatApi';

describe('AC-06: Segurança do Stream SSE (timeout 90s e sem retry cego após 200 OK)', () => {
  test('test_ac_06_nao_reexecuta_post_chat_apos_stream_200_ok', async () => {
    const calls: string[] = [];
    const mockClient = {
      getToken: () => 'tok-123',
      getBaseUrl: () => 'https://vito.test',
      init: async () => {},
      request: async (endpoint: string) => {
        calls.push(`request:${endpoint}`);
        return { intent: 'general_chat', reply: 'fallback-post' };
      },
    } as any;

    const chatApi = new ChatApi(mockClient);
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (url: any, init: any) => {
      calls.push(`fetch:${String(url)}`);
      assert.ok(init?.signal, 'assistantChatStream deve passar signal de timeout para fetch');
      return new Response('', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }) as any;

    try {
      await assert.rejects(
        () => chatApi.assistantChatStream('Criar tarefa', { thread_id: 'th-1' }),
        /stream|SSE|encerrad|resposta/i
      );
      assert.equal(
        calls.includes('request:/api/v1/assistant/chat'),
        false,
        'NÃO deve chamar POST /api/v1/assistant/chat após stream 200 OK já conectado'
      );
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('test_ac_06_assistantConfirm_suporta_reject_reason_threadId_e_timeout_90s', async () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../services/api/chatApi.ts'), 'utf8');
    assert.ok(src.includes('90000'), 'assistantChatStream deve configurar timeout de 90s (90000ms)');

    let capturedBody: any = null;
    const mockClient = {
      getToken: () => 'tok-123',
      getBaseUrl: () => 'https://vito.test',
      init: async () => {},
      request: async (_endpoint: string, init: any) => {
        capturedBody = JSON.parse(init.body);
        return { intent: 'confirmed', reply: 'Confirmado' };
      },
    } as any;

    const chatApi = new ChatApi(mockClient);
    await (chatApi as any).assistantConfirm('pend-99', {
      reject: true,
      reason: 'Não quero agora',
      threadId: 'th-99',
    });

    assert.equal(capturedBody.pending_id, 'pend-99');
    assert.equal(capturedBody.reject, true);
    assert.equal(capturedBody.reason, 'Não quero agora');
    assert.equal(capturedBody.thread_id, 'th-99');
  });
});
