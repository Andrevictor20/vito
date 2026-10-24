import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { copyToClipboard, __setClipboardModuleForTesting } from './clipboard';

describe('copyToClipboard Utility (TDD)', () => {
  beforeEach(() => {
    // Reset test mock
    __setClipboardModuleForTesting(null);
  });

  it('retorna false quando o texto é vazio ou inválido', async () => {
    let called = false;
    __setClipboardModuleForTesting({
      setStringAsync: async () => {
        called = true;
        return true;
      },
    });

    const emptyResult = await copyToClipboard('');
    const nullResult = await copyToClipboard(null as any);
    const undefinedResult = await copyToClipboard(undefined as any);

    assert.equal(emptyResult, false);
    assert.equal(nullResult, false);
    assert.equal(undefinedResult, false);
    assert.equal(called, false);
  });

  it('copia texto com sucesso quando o módulo nativo está disponível', async () => {
    let copiedText = '';
    __setClipboardModuleForTesting({
      setStringAsync: async (text: string) => {
        copiedText = text;
        return true;
      },
    });

    const result = await copyToClipboard('https://vito.app/book/reuniao-15m');
    assert.equal(result, true);
    assert.equal(copiedText, 'https://vito.app/book/reuniao-15m');
  });

  it('retorna false quando módulo nativo não está disponível', async () => {
    __setClipboardModuleForTesting(null);

    const result = await copyToClipboard('test string');
    assert.equal(result, false);
  });

  it('captura exceções e retorna false se módulo nativo falhar', async () => {
    __setClipboardModuleForTesting({
      setStringAsync: async () => {
        throw new Error('Native clipboard error');
      },
    });

    const result = await copyToClipboard('test string');
    assert.equal(result, false);
  });
});
