import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore
import { formatPhoneNumber, cleanPhoneNumber, isValidPhoneNumber } from './phoneFormat';

describe('Phone format helpers (TDD)', () => {
  it('limpa caracteres não numéricos preservando o +', () => {
    assert.equal(cleanPhoneNumber('+55 (11) 98765-4321'), '+5511987654321');
    assert.equal(cleanPhoneNumber('11 98765-4321'), '11987654321');
  });

  it('formata números brasileiros no formato (XX) XXXXX-XXXX', () => {
    assert.equal(formatPhoneNumber('11987654321'), '(11) 98765-4321');
    assert.equal(formatPhoneNumber('+5511987654321'), '+55 (11) 98765-4321');
  });

  it('valida telefones com tamanho válido', () => {
    assert.equal(isValidPhoneNumber('11987654321'), true);
    assert.equal(isValidPhoneNumber('+5511987654321'), true);
    assert.equal(isValidPhoneNumber('123'), false);
    assert.equal(isValidPhoneNumber(''), false);
  });
});
