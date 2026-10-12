import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  preparePlainTextForCopy,
  prepareEditDraft,
  isAbortError,
  truncateMessagesForEdit,
} from './chatActions';

describe('Chat Modern Actions (TDD - AC-01 a AC-04)', () => {
  describe('AC-01: preparePlainTextForCopy', () => {
    it('deve remover marcadores markdown pesados preservando o conteúdo legível', () => {
      const markdown = '### Resumo da Reunião\n\n**Data:** 12/10/2026\n* Item 1\n* Item 2';
      const clean = preparePlainTextForCopy(markdown);
      assert.equal(clean.includes('###'), false);
      assert.equal(clean.includes('Resumo da Reunião'), true);
      assert.equal(clean.includes('Data: 12/10/2026'), true);
      assert.equal(clean.includes('• Item 1'), true);
    });

    it('deve retornar string vazia caso o texto seja nulo ou vazio', () => {
      assert.equal(preparePlainTextForCopy(''), '');
    });
  });

  describe('AC-03: prepareEditDraft', () => {
    it('deve priorizar a mensagem a ser editada e limpar espaços soltos', () => {
      const msg = '   Agende reunião com Carlos amanhã às 15h   ';
      const draft = prepareEditDraft('', msg);
      assert.equal(draft, 'Agende reunião com Carlos amanhã às 15h');
    });
  });

  describe('AC-02: isAbortError', () => {
    it('deve identificar corretamente erro de abort intencional do usuário', () => {
      const abortErr = new Error('The user aborted a request.');
      abortErr.name = 'AbortError';
      const customCancelErr = new Error('USER_CANCELLED');
      assert.equal(isAbortError(customCancelErr), true);
    });

    it('não deve considerar erros de rede comuns ou 500 como cancelamento', () => {
      const serverErr = new Error('Internal Server Error 500');
      assert.equal(isAbortError(serverErr), false);
    });
  });

  describe('AC-05: truncateMessagesForEdit', () => {
    it('deve truncar mensagens posteriores e atualizar a mensagem editada', () => {
      const msgs = [
        { id: '1', sender: 'user' as const, text: 'Primeira', timestamp: '2026-10-10T10:00:00Z' },
        { id: '2', sender: 'vito' as const, text: 'Resposta 1', timestamp: '2026-10-10T10:00:01Z' },
        { id: '3', sender: 'user' as const, text: 'Segunda', timestamp: '2026-10-10T10:01:00Z' },
        { id: '4', sender: 'vito' as const, text: 'Resposta 2', timestamp: '2026-10-10T10:01:01Z' },
      ];

      const truncated = truncateMessagesForEdit(msgs, '3', 'Segunda Editada');
      assert.equal(truncated.length, 3);
      assert.equal(truncated[0].id, '1');
      assert.equal(truncated[1].id, '2');
      assert.equal(truncated[2].id, '3');
      assert.equal(truncated[2].text, 'Segunda Editada');
    });

    it('deve retornar a lista inalterada se a mensagem não for encontrada', () => {
      const msgs = [
        { id: '1', sender: 'user' as const, text: 'Primeira', timestamp: '2026-10-10T10:00:00Z' },
      ];
      const truncated = truncateMessagesForEdit(msgs, 'inexistente', 'Novo');
      assert.equal(truncated.length, 1);
      assert.equal(truncated[0].text, 'Primeira');
    });
  });
});
