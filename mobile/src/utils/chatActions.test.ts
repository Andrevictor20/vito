import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  preparePlainTextForCopy,
  prepareEditDraft,
  isAbortError,
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
      assert.equal(isAbortError(abortErr), true);

      const customCancelErr = new Error('USER_CANCELLED');
      assert.equal(isAbortError(customCancelErr), true);
    });

    it('não deve considerar erros de rede comuns ou 500 como cancelamento', () => {
      const serverErr = new Error('Internal Server Error 500');
      assert.equal(isAbortError(serverErr), false);
    });
  });
});
