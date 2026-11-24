import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatToolCallStepLabel } from '../features/chat/utils/chatMessageBuilder';
import {
  isTableSeparatorRow,
  parseMarkdownTableRow,
} from '../features/chat/components/FormattedChatMessageText';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Chat Formatting, Bot Sync & Live Steps', () => {
  it('FormattedChatMessageText suporta tabelas Markdown com pipes escapados e horizontal ScrollView', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../features/chat/components/FormattedChatMessageText.tsx'),
      'utf8'
    );
    assert.ok(src.includes('ScrollView'), 'Deve usar ScrollView horizontal para tabelas largas');
    assert.ok(src.includes('parseMarkdownTableRow'), 'Deve possuir parser de linha de tabela Markdown');
    assert.ok(src.includes('isTableSeparatorRow'), 'Deve detectar linha separadora |---|');

    assert.equal(isTableSeparatorRow('| Data | Descrição | Categoria | Valor |'), false);
    assert.equal(isTableSeparatorRow('|------|-----------|-----------|-------|'), true);
    assert.deepEqual(
      parseMarkdownTableRow('| 20/11 | Compra no débito via NuPay\\|EBW\\|Spotify | Music streaming | -R$ 12,90 |'),
      ['20/11', 'Compra no débito via NuPay|EBW|Spotify', 'Music streaming', '-R$ 12,90']
    );
  });

  it('formatToolCallStepLabel traduz todas as ferramentas atômicas para PT-BR conciso', () => {
    assert.equal(formatToolCallStepLabel({ tool: 'finance_list_transactions' }), 'Consultando transações');
    assert.equal(formatToolCallStepLabel({ tool: 'web_search' }), 'Pesquisando na web');
    assert.equal(formatToolCallStepLabel({ tool: 'bot_create_bot' }), 'Criando bot');
    assert.equal(formatToolCallStepLabel({ tool: 'transfer_to_agent' }), 'Acionando especialista');
  });

  it('chatStreamRunner ignora tokens crus de reasoning e normaliza etapas via formatToolCallStepLabel', () => {
    const runnerSrc = fs.readFileSync(
      path.resolve(__dirname, '../features/chat/hooks/chatStreamRunner.ts'),
      'utf8'
    );
    assert.equal(
      runnerSrc.includes('pushSteps(res.reasoning)'),
      false,
      'Não deve despejar tokens/parágrafos crus de res.reasoning como etapas'
    );
    assert.ok(
      runnerSrc.includes("delta.type === 'reasoning'"),
      'Deve filtrar deltas crus de reasoning token-a-token'
    );
  });

  it('chatMessageEffects notifica refresh_bots quando bot é criado via chat', () => {
    const effectsSrc = fs.readFileSync(
      path.resolve(__dirname, '../features/chat/hooks/chatMessageEffects.ts'),
      'utf8'
    );
    assert.ok(effectsSrc.includes('refresh_bots'), 'Deve disparar refresh_bots ao criar bot');
  });
});
