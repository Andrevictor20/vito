import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAT_CARD_ANIMATION,
  shouldReduceMotion,
  computeEntranceTiming,
} from './chatCardAnimation';

describe('Chat Card Animation Helpers (TDD)', () => {
  it('contém parâmetros de timing suaves dentro das especificações de design', () => {
    assert.ok(CHAT_CARD_ANIMATION.duration >= 380 && CHAT_CARD_ANIMATION.duration <= 420);
    assert.ok(CHAT_CARD_ANIMATION.delay >= 150 && CHAT_CARD_ANIMATION.delay <= 200);
    assert.ok(CHAT_CARD_ANIMATION.offsetY >= 8 && CHAT_CARD_ANIMATION.offsetY <= 10);
  });

  it('possui a curva cúbica bezier idêntica à do login-vito.html', () => {
    const [x1, y1, x2, y2] = CHAT_CARD_ANIMATION.bezier;
    assert.equal(x1, 0.2);
    assert.equal(y1, 0.8);
    assert.equal(x2, 0.2);
    assert.equal(y2, 1.0);
  });

  it('possui configuração orgânica de spring alternativa válida', () => {
    assert.equal(CHAT_CARD_ANIMATION.spring.damping, 20);
    assert.equal(CHAT_CARD_ANIMATION.spring.stiffness, 220);
  });

  it('respeita corretamente a flag de acessibilidade shouldReduceMotion', () => {
    assert.equal(shouldReduceMotion(true), true);
    assert.equal(shouldReduceMotion(false), false);
  });

  it('calcula delays escalonados sem quebrar para múltiplos cards', () => {
    assert.equal(computeEntranceTiming(0, 180, 60), 180);
    assert.equal(computeEntranceTiming(1, 180, 60), 240);
    assert.equal(computeEntranceTiming(2, 180, 60), 300);
  });
});
