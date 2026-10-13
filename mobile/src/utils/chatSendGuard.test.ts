import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldTriggerSend } from './chatSendGuard';

// W0: um toque com teclado aberto deve enviar exatamente uma vez.
// Guarda pura extraída do dock: sem fiação dupla onPressIn+onPress,
// sem trava de setTimeout — debounce por timestamp + motivo de recusa
// (para feedback em vez de swallow silencioso).

describe('chatSendGuard', () => {
  it('permite envio com conteúdo e sem loading', () => {
    const r = shouldTriggerSend({ hasContent: true, loading: false, now: 1000, lastSentAt: 0 });
    assert.equal(r.allowed, true);
  });

  it('recusa sem conteúdo (motivo empty)', () => {
    const r = shouldTriggerSend({ hasContent: false, loading: false, now: 1000, lastSentAt: 0 });
    assert.equal(r.allowed, false);
    assert.equal(r.reason, 'empty');
  });

  it('recusa durante loading (motivo loading, para feedback)', () => {
    const r = shouldTriggerSend({ hasContent: true, loading: true, now: 1000, lastSentAt: 0 });
    assert.equal(r.allowed, false);
    assert.equal(r.reason, 'loading');
  });

  it('debounce: segundo toque < 400ms é recusado', () => {
    const first = shouldTriggerSend({ hasContent: true, loading: false, now: 1000, lastSentAt: 0 });
    assert.equal(first.allowed, true);
    const second = shouldTriggerSend({ hasContent: true, loading: false, now: 1200, lastSentAt: first.sentAt });
    assert.equal(second.allowed, false);
    assert.equal(second.reason, 'debounced');
  });

  it('permite novo envio após janela de debounce', () => {
    const first = shouldTriggerSend({ hasContent: true, loading: false, now: 1000, lastSentAt: 0 });
    const second = shouldTriggerSend({ hasContent: true, loading: false, now: 1500, lastSentAt: first.sentAt });
    assert.equal(second.allowed, true);
  });
});
