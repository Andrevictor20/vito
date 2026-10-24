import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatPhoneNumber, cleanPhoneNumber, isValidPhoneNumber, toE164Phone } from './phoneFormat';

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

  it('normaliza telefones para padrão E.164 com DDI', () => {
    // Nacional com DDD (11 dígitos)
    assert.equal(toE164Phone('(11) 98765-4321'), '+5511987654321');
    // Nacional com DDD e zero na frente (011...)
    assert.equal(toE164Phone('011 98765-4321'), '+5511987654321');
    // Já com +55
    assert.equal(toE164Phone('+55 11 98765-4321'), '+5511987654321');
    // Internacional genérico
    assert.equal(toE164Phone('+1 415 555 2671'), '+14155552671');
    // Nacional com código de operadora CSP (ex: 021 Claro, 015 Vivo, 031 Oi, 041 TIM)
    assert.equal(toE164Phone('021 21 98765-4321'), '+5521987654321');
    assert.equal(toE164Phone('015 11 98765-4321'), '+5511987654321');
    assert.equal(toE164Phone('031 31 3333-4444'), '+553133334444');
    // Nacional com 55 prefixado sem o +
    assert.equal(toE164Phone('5521987654321'), '+5521987654321');
    assert.equal(toE164Phone('552133334444'), '+552133334444');
    // Com +55 e zero redundante após o DDI (+55 021...)
    assert.equal(toE164Phone('+55 021 98765-4321'), '+5521987654321');
    // Inválido ou vazio
    assert.equal(toE164Phone(''), '');
    assert.equal(toE164Phone('123'), '');
  });
});

