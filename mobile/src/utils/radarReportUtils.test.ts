import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractReportParagraphs,
  detectPaymentAndMarketFeatures,
  buildRadarChatPrompt,
} from './radarReportUtils';

describe('radarReportUtils', () => {
  test('extractReportParagraphs prioriza array paragraphs do payload quando disponível', () => {
    const parsed = {
      paragraphs: [
        'O smartphone Poco X8 Pro Max teve seu menor preço histórico registrado hoje.',
        'No Mercado Livre e KaBuM!, o aparelho sai por R$ 2.199 à vista no Pix.',
        'Recomenda-se aproveitar pois os cupons de desconto têm validade até meia-noite.',
      ],
    };
    const paragraphs = extractReportParagraphs('Mensagem curta', parsed);
    assert.equal(paragraphs.length, 3);
    assert.equal(paragraphs[0], 'O smartphone Poco X8 Pro Max teve seu menor preço histórico registrado hoje.');
    assert.equal(paragraphs[1], 'No Mercado Livre e KaBuM!, o aparelho sai por R$ 2.199 à vista no Pix.');
    assert.equal(paragraphs[2], 'Recomenda-se aproveitar pois os cupons de desconto têm validade até meia-noite.');
  });

  test('extractReportParagraphs divide texto corrido por quebras de linha e ignora links brutos', () => {
    const raw = 'Primeiro parágrafo de notícia importante.\n\nSegundo parágrafo detalhando o impacto.\nhttps://noticias.uol.com.br/fato';
    const paragraphs = extractReportParagraphs(raw, null);
    assert.equal(paragraphs.length, 2);
    assert.equal(paragraphs[0], 'Primeiro parágrafo de notícia importante.');
    assert.equal(paragraphs[1], 'Segundo parágrafo detalhando o impacto.');
  });

  test('detectPaymentAndMarketFeatures identifica Pix, parcelamento e moeda BRL', () => {
    const features = detectPaymentAndMarketFeatures(
      'Menor preço KaBuM!',
      'R$ 1.999 no Pix ou em até 10x sem juros no cartão',
      []
    );
    assert.equal(features.hasPix, true);
    assert.equal(features.hasInstallments, true);
    assert.equal(features.hasReal, true);
  });

  test('buildRadarChatPrompt contextualiza a IA para compras e planejamento', () => {
    const prompt = buildRadarChatPrompt(
      'Preço Poco X8',
      'chat',
      'Preço caiu para R$ 2.199 no Mercado Livre à vista no Pix.'
    );
    assert.match(prompt, /Preço Poco X8/);
    assert.match(prompt, /Pix ou parcelado/);
    assert.match(prompt, /tarefa ou agendar no calendário/);
  });
});
