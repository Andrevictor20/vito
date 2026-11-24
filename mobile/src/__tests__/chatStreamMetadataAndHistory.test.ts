import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { formatModelDisplayName } from '../services/ai/aiProviderCatalog';
import * as chatStreamRunner from '../hooks/chatStreamRunner';

describe('AC-05: Metadata de modelo, histórico { role, content } e status HITL no stream', () => {
  test('test_ac_05_formatModelDisplayName_preserva_sufixo_free', () => {
    const qwen = formatModelDisplayName('qwen/qwen3-32b:free');
    assert.notEqual(qwen, 'free');
    assert.ok(qwen.includes('qwen3-32b'), `esperava qwen3-32b, obteve ${qwen}`);

    const orQwen = formatModelDisplayName('openrouter:qwen/qwen3-32b:free');
    assert.notEqual(orQwen, 'free');
    assert.ok(orQwen.includes('qwen3-32b'), `esperava qwen3-32b, obteve ${orQwen}`);

    assert.equal(formatModelDisplayName('srv:auto'), 'Vito Auto');
  });

  test('test_ac_05_chatStreamRunner_history_role_content_e_status_confirmacao', () => {
    const fnHistory = (chatStreamRunner as Record<string, any>).formatHistoryForStream;
    assert.equal(typeof fnHistory, 'function', 'formatHistoryForStream deve ser exportada');
    const serialized = fnHistory([
      { id: '1', sender: 'user', text: 'Oi', timestamp: '' },
      { id: '2', sender: 'vito', text: 'Olá!', timestamp: '' },
    ]);
    assert.deepEqual(serialized, [
      { role: 'user', content: 'Oi' },
      { role: 'assistant', content: 'Olá!' },
    ]);

    const fnStep = (chatStreamRunner as Record<string, any>).formatToolCallStepLabel;
    assert.equal(typeof fnStep, 'function', 'formatToolCallStepLabel deve ser exportada');
    assert.equal(
      fnStep({ tool: 'task_and_pending_manager', operation: 'create_todo', status: 'AWAITING_USER_CONFIRMATION' }),
      'Aguardando sua confirmação'
    );

    const runnerSrc = fs.readFileSync(path.resolve(__dirname, '../hooks/chatStreamRunner.ts'), 'utf8');
    assert.equal(runnerSrc.includes("sender: m.sender === 'user'"), false);
  });
});
