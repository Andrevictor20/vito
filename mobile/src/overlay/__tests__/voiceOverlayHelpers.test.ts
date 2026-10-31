import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateHarmonicBarHeights,
  getAuraColor,
  getStateLabel,
  extractWhatsAppCardData,
  isGoodbyeUtterance,
  GAUSSIAN_WEIGHTS_13,
  formatVoiceDuration,
  getPrototypeStateColor,
  getPrototypeSpeakerLabel,
  getPrototypeHint,
} from '../voiceOverlayHelpers';

describe('voiceOverlayHelpers — Testes do Visualizador e Lógica de Voz', () => {
  it('calculateHarmonicBarHeights produz 13 barras com pesos gaussianos dentro dos limites', () => {
    const barsListening = calculateHarmonicBarHeights(0.8, 'LISTENING', 0);
    assert.strictEqual(barsListening.length, 13);
    assert.strictEqual(GAUSSIAN_WEIGHTS_13.length, 13);
    barsListening.forEach((height) => {
      assert.ok(height >= 4 && height <= 28, `Altura ${height} fora do range [4, 28]`);
    });

    // Ponto central (índice 6) é o ápice da gaussiana (peso 1.0)
    assert.ok(barsListening[6] >= barsListening[0], 'Centro deve ser maior que ponta esquerda');
    assert.ok(barsListening[6] >= barsListening[12], 'Centro deve ser maior que ponta direita');
    assert.ok(barsListening[6] >= barsListening[3], 'Centro deve ser maior que intermediário');
  });

  it('calculateHarmonicBarHeights reage ao silêncio com valores mínimos e animações em THINKING e SPEAKING', () => {
    const barsSilence = calculateHarmonicBarHeights(0.0, 'LISTENING', 0);
    assert.strictEqual(barsSilence.length, 13);
    barsSilence.forEach((h) => assert.ok(h >= 4));

    const barsThinking = calculateHarmonicBarHeights(0, 'THINKING', 1.5);
    assert.strictEqual(barsThinking.length, 13);
    barsThinking.forEach((h) => assert.ok(h >= 4 && h <= 28));

    const barsSpeaking = calculateHarmonicBarHeights(0, 'SPEAKING', 2.0);
    assert.strictEqual(barsSpeaking.length, 13);
    barsSpeaking.forEach((h) => assert.ok(h >= 4 && h <= 28));
  });

  it('isGoodbyeUtterance detecta saudações de despedida e comandos de encerramento em pt-BR', () => {
    assert.strictEqual(isGoodbyeUtterance('tchau'), true);
    assert.strictEqual(isGoodbyeUtterance('Tchau Vito!'), true);
    assert.strictEqual(isGoodbyeUtterance('valeu, até mais'), true);
    assert.strictEqual(isGoodbyeUtterance('obrigado, só isso'), true);
    assert.strictEqual(isGoodbyeUtterance('Muito obrigado'), true);
    assert.strictEqual(isGoodbyeUtterance('brigado, pode fechar'), true);
    assert.strictEqual(isGoodbyeUtterance('até logo!'), true);
    assert.strictEqual(isGoodbyeUtterance('pode fechar'), true);
    assert.strictEqual(isGoodbyeUtterance('so isso'), true);
    assert.strictEqual(isGoodbyeUtterance('encerrar'), true);
  });

  it('isGoodbyeUtterance não dispara falsos positivos para comandos e perguntas normais', () => {
    assert.strictEqual(isGoodbyeUtterance(''), false);
    assert.strictEqual(isGoodbyeUtterance(undefined), false);
    assert.strictEqual(isGoodbyeUtterance('Qual a previsão do tempo para amanhã?'), false);
    assert.strictEqual(isGoodbyeUtterance('Marca dentista terça às 15 horas'), false);
    assert.strictEqual(isGoodbyeUtterance('Como está a cotação do dólar hoje?'), false);
    assert.strictEqual(isGoodbyeUtterance('Mandar mensagem para o João'), false);
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

  it('formatVoiceDuration formata segundos em formato MM:SS conforme vito-telas', () => {
    assert.strictEqual(formatVoiceDuration(0), '0:00');
    assert.strictEqual(formatVoiceDuration(9), '0:09');
    assert.strictEqual(formatVoiceDuration(10), '0:10');
    assert.strictEqual(formatVoiceDuration(60), '1:00');
    assert.strictEqual(formatVoiceDuration(75), '1:15');
    assert.strictEqual(formatVoiceDuration(605), '10:05');
  });

  it('getPrototypeStateColor mapeia as cores exatas do vito-telas.html', () => {
    assert.strictEqual(getPrototypeStateColor('LISTENING'), '#2B7FD4'); // Azul
    assert.strictEqual(getPrototypeStateColor('THINKING'), '#D9681A');  // Laranja
    assert.strictEqual(getPrototypeStateColor('SPEAKING'), '#0B9A5F');  // Esmeralda
  });

  it('getPrototypeSpeakerLabel identifica o orador atual', () => {
    assert.strictEqual(getPrototypeSpeakerLabel('LISTENING'), 'VOCÊ');
    assert.strictEqual(getPrototypeSpeakerLabel('THINKING'), 'VOCÊ');
    assert.strictEqual(getPrototypeSpeakerLabel('SPEAKING'), 'VITO');
  });

  it('getPrototypeHint fornece dicas contextuais corretas', () => {
    assert.strictEqual(getPrototypeHint('LISTENING', true), 'Microfone desativado');
    assert.strictEqual(getPrototypeHint('SPEAKING', false), 'Toque no Vito para interromper');
    assert.strictEqual(getPrototypeHint('THINKING', false), 'Processando sua solicitação...');
    assert.strictEqual(getPrototypeHint('LISTENING', false), 'Fale naturalmente com o Vito');
  });
});
