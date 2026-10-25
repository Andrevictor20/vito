import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateHarmonicBarHeights,
  getAuraColor,
  getStateLabel,
  extractWhatsAppCardData,
} from '../voiceOverlayHelpers';

describe('voiceOverlayHelpers — Testes do Visualizador e Lógica de Voz', () => {
  it('calculateHarmonicBarHeights produz 5 barras dentro dos limites min e max', () => {
    const barsListening = calculateHarmonicBarHeights(0.8, 'LISTENING', 0);
    assert.strictEqual(barsListening.length, 5);
    barsListening.forEach((height) => {
      assert.ok(height >= 8 && height <= 38, `Altura ${height} fora do range [8, 38]`);
    });

    // O elemento central deve ser maior que as pontas na curva de sino
    assert.ok(barsListening[2] >= barsListening[0]);
    assert.ok(barsListening[2] >= barsListening[4]);
  });

  it('calculateHarmonicBarHeights reage ao silêncio com valores mínimos e animações em THINKING e SPEAKING', () => {
    const barsSilence = calculateHarmonicBarHeights(0.0, 'LISTENING', 0);
    assert.strictEqual(barsSilence.length, 5);
    barsSilence.forEach((h) => assert.ok(h >= 8));

    const barsThinking = calculateHarmonicBarHeights(0, 'THINKING', 1.5);
    assert.strictEqual(barsThinking.length, 5);

    const barsSpeaking = calculateHarmonicBarHeights(0, 'SPEAKING', 2.0);
    assert.strictEqual(barsSpeaking.length, 5);
  });

  it('getAuraColor mapeia corretamente as cores de cada estado', () => {
    assert.strictEqual(getAuraColor('LISTENING'), '#10B981');
    assert.strictEqual(getAuraColor('THINKING'), '#3B82F6');
    assert.strictEqual(getAuraColor('SPEAKING'), '#8B5CF6');
  });

  it('getStateLabel retorna texto apropriado em português', () => {
    assert.strictEqual(getStateLabel('LISTENING'), 'Ouvindo você...');
    assert.strictEqual(getStateLabel('THINKING'), 'Processando...');
    assert.strictEqual(getStateLabel('SPEAKING'), 'Vito');
  });

  it('extractWhatsAppCardData extrai payload de mensagem do WhatsApp com sucesso', () => {
    const mockResponse: any = {
      message: 'Preparei a mensagem para João: Oi João, tudo bem? Posso enviar?',
      whatsapp_message: {
        recipient_name: 'João Silva',
        recipient_phone: '5511999998888',
        message: 'Oi João, tudo bem?',
        status: 'ready',
      },
    };

    const card = extractWhatsAppCardData(mockResponse);
    assert.ok(card);
    assert.strictEqual(card?.recipient_name, 'João Silva');
    assert.strictEqual(card?.message, 'Oi João, tudo bem?');
  });

  it('extractWhatsAppCardData extrai via regex em texto quando whatsapp_message não está presente', () => {
    const mockResponse: any = {
      message: 'Preparei a mensagem para Carlos: Vamos almoçar amanhã? Posso enviar?',
    };

    const card = extractWhatsAppCardData(mockResponse);
    assert.ok(card);
    assert.strictEqual(card?.recipient_name, 'Carlos');
    assert.strictEqual(card?.message, 'Vamos almoçar amanhã?');
  });

  it('extractWhatsAppCardData retorna null quando a resposta não é sobre WhatsApp', () => {
    const mockResponse: any = {
      message: 'Reunião agendada com sucesso para as 15h.',
    };

    const card = extractWhatsAppCardData(mockResponse);
    assert.strictEqual(card, null);
  });
});
