import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildAssistantConfirmPayload, executeChatStreamFetch } from '../features/chat/services/chatStreamHelper';

describe('AC-06: Segurança do Stream SSE (timeout 90s e sem retry cego após 200 OK)', () => {
  test('test_ac_06_nao_reexecuta_post_chat_apos_stream_200_ok', async () => {
    const calls: string[] = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push(`fetch:${String(url)}`);
      assert.ok(init?.signal, 'executeChatStreamFetch deve passar signal de timeout para fetch');
      return new Response('', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }) as typeof globalThis.fetch;

    try {
      await assert.rejects(
        () =>
          executeChatStreamFetch({
            url: 'https://vito.test/api/v1/assistant/chat/stream',
            headers: { 'Content-Type': 'application/json' },
            bodyPayload: '{}',
            fallbackChat: async () => {
              calls.push('request:/api/v1/assistant/chat');
              return { intent: 'general_chat', reply: 'fallback-post' };
            },
          }),
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
    const helperSrc = fs.readFileSync(path.resolve(__dirname, '../features/chat/services/chatStreamHelper.ts'), 'utf8');
    const chatApiSrc = fs.readFileSync(path.resolve(__dirname, '../features/chat/services/chatApi.ts'), 'utf8');
    assert.ok(helperSrc.includes('90000') && chatApiSrc.includes('90000'), 'assistantChatStream deve configurar timeout de 90s (90000ms)');

    const payload = buildAssistantConfirmPayload('pend-99', {
      reject: true,
      reason: 'Não quero agora',
      threadId: 'th-99',
    });

    assert.equal(payload.pending_id, 'pend-99');
    assert.equal(payload.reject, true);
    assert.equal(payload.reason, 'Não quero agora');
    assert.equal(payload.thread_id, 'th-99');
  });
});
