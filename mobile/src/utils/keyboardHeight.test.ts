import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveKeyboardHeight, KEYBOARD_HEIGHT_DEADZONE } from './keyboardHeight';

describe('keyboardHeight', () => {
  it('adota altura quando teclado estaba fechado', () => {
    assert.equal(resolveKeyboardHeight(0, false, 280), 280);
  });

  it('ignora re-disparo com variação pequena (faixa de sugestões)', () => {
    assert.equal(resolveKeyboardHeight(280, true, 300), null);
    assert.equal(resolveKeyboardHeight(280, true, 260), null);
  });

  it('adota variação grande (troca p/ emoji/painel alto)', () => {
    assert.equal(resolveKeyboardHeight(280, true, 280 + KEYBOARD_HEIGHT_DEADZONE + 10), 280 + KEYBOARD_HEIGHT_DEADZONE + 10);
  });

  it('zera ao fechar', () => {
    assert.equal(resolveKeyboardHeight(280, true, 0), 0);
  });
});
