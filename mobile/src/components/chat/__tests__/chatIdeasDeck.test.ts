import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  IDEA_CARDS,
  CAROUSEL_TIMING,
  getCardOffset,
  getCardVisualSpec,
} from '../../../utils/chatIdeasDeckMotion';

describe('ChatIdeasDeck — Física de Gestos e Animações 3D', () => {
  it('contém exatamente 7 cards temáticos sem emojis em títulos e tags', () => {
    assert.equal(IDEA_CARDS.length, 7);
    for (const card of IDEA_CARDS) {
      assert.ok(card.id);
      assert.ok(card.tag);
      assert.ok(card.title);
      assert.ok(card.subtitle);
      assert.ok(card.prompt);
      // Garante que não possui emojis no título ou tag
      assert.equal(/[\u{1F300}-\u{1F9FF}]/u.test(card.title), false);
      assert.equal(/[\u{1F300}-\u{1F9FF}]/u.test(card.tag), false);
    }
  });

  it('calcula o offset relativo modular entre cards corretamente', () => {
    const total = 7;
    // Quando cur = 0
    assert.equal(getCardOffset(0, 0, total), 0); // card atual
    assert.equal(getCardOffset(1, 0, total), 1); // próximo
    assert.equal(getCardOffset(2, 0, total), 2); // próximo do próximo
    assert.equal(getCardOffset(6, 0, total), -1); // anterior
    assert.equal(getCardOffset(5, 0, total), -2); // anterior do anterior

    // Quando cur = 3
    assert.equal(getCardOffset(3, 3, total), 0);
    assert.equal(getCardOffset(4, 3, total), 1);
    assert.equal(getCardOffset(2, 3, total), -1);
  });

  it('especificações visuais batem com a escala e física de vito-telas.html', () => {
    // Card atual no centro
    const center = getCardVisualSpec(0);
    assert.equal(center.tx, 0);
    assert.equal(center.rot, '0deg');
    assert.equal(center.scale, 1.0);
    assert.equal(center.op, 1.0);

    // Próximo card à direita
    const next = getCardVisualSpec(1);
    assert.equal(next.tx, 48);
    assert.equal(next.rot, '5deg');
    assert.equal(next.scale, 0.92);
    assert.equal(next.op, 0.8);

    // Card anterior à esquerda
    const prev = getCardVisualSpec(-1);
    assert.equal(prev.tx, -48);
    assert.equal(prev.rot, '-5deg');
    assert.equal(prev.scale, 0.92);
    assert.equal(prev.op, 0.8);

    // Cards em background
    const bgRight = getCardVisualSpec(2);
    assert.equal(bgRight.scale, 0.85);
    assert.equal(bgRight.op, 0.0);

    const bgLeft = getCardVisualSpec(-2);
    assert.equal(bgLeft.scale, 0.85);
    assert.equal(bgLeft.op, 0.0);
  });

  it('parâmetros de timing e mola batem com a especificação', () => {
    assert.equal(CAROUSEL_TIMING.durationMs, 480);
    assert.deepEqual(CAROUSEL_TIMING.bezier, [0.2, 0.8, 0.2, 1]);
    assert.equal(CAROUSEL_TIMING.swipeThresholdPx, 35);
    assert.equal(CAROUSEL_TIMING.spring.damping, 22);
    assert.equal(CAROUSEL_TIMING.spring.stiffness, 240);
  });
});
