import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractReportParagraphs,
  detectPaymentAndMarketFeatures,
  buildRadarChatPrompt,
  extractRadarBullets,
  extractRadarSources,
  extractDomain,
  getFaviconUrl,
  isRadarUrgentOrBreaking,
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

  test('extractReportParagraphs extrai parágrafos limpos mesmo se receber JSON bruto por falha de deserialização', () => {
    const leakedRawJson = '{"condition_met":false,"summary":"Nenhuma novidade relevante","paragraphs":["Primeiro fato verificado no mercado.","Segundo parágrafo com análise."],"current_data":["Item 1"]}';
    const paragraphs = extractReportParagraphs(leakedRawJson, { paragraphs: [leakedRawJson] });
    assert.equal(paragraphs.length, 2);
    assert.equal(paragraphs[0], 'Primeiro fato verificado no mercado.');
    assert.equal(paragraphs[1], 'Segundo parágrafo com análise.');
    assert.equal(paragraphs[0].includes('{"condition_met"'), false);
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

  test('extractRadarBullets prioriza array bullets e limpa marcadores de listas', () => {
    const parsed = {
      bullets: [
        '• Pedro marcou aos 34\' e garantiu a virada.',
        '- Próximo confronto marcado para domingo às 16h.',
        'Sem rodeios adicionais.',
      ],
    };
    const bullets = extractRadarBullets('', parsed);
    assert.equal(bullets.length, 3);
    assert.equal(bullets[0], 'Pedro marcou aos 34\' e garantiu a virada.');
    assert.equal(bullets[1], 'Próximo confronto marcado para domingo às 16h.');
    assert.equal(bullets[2], 'Sem rodeios adicionais.');
  });

  test('extractRadarBullets divide parágrafos em bullets concisos quando bullets direto não existir', () => {
    const parsed = {
      paragraphs: [
        'Dólar opera a R$ 5,72 em alta de 0,85% com tensões globais.',
        'Recomenda-se cautela antes de fechar remessas hoje.',
      ],
    };
    const bullets = extractRadarBullets('', parsed);
    assert.equal(bullets.length, 2);
    assert.equal(bullets[0], 'Dólar opera a R$ 5,72 em alta de 0,85% com tensões globais.');
  });

  test('extractDomain e getFaviconUrl extraem domínio limpo e endpoint Google Favicons', () => {
    const domain = extractDomain('https://ge.globo.com/futebol/times/flamengo');
    assert.equal(domain, 'ge.globo.com');
    const favicon = getFaviconUrl('https://ge.globo.com/futebol/times/flamengo');
    assert.match(favicon, /domain=ge\.globo\.com/);
  });

  test('extractRadarSources extrai fontes estruturadas com nomes e favicons', () => {
    const parsed = {
      sources: [
        { name: 'ge.globo', url: 'https://ge.globo.com/futebol/123', title: 'Fla vence' },
        { name: 'UOL', url: 'https://uol.com.br/esporte/456', title: 'Gols de Pedro' },
      ],
    };
    const sources = extractRadarSources('', parsed);
    assert.equal(sources.length, 2);
    assert.equal(sources[0].name, 'ge.globo');
    assert.equal(sources[0].domain, 'ge.globo.com');
    assert.equal(sources[1].name, 'UOL');
    assert.equal(sources[1].domain, 'uol.com.br');
  });

  test('isRadarUrgentOrBreaking identifica corretamente breaking news e urgência alta', () => {
    assert.equal(isRadarUrgentOrBreaking('breaking', false), true);
    assert.equal(isRadarUrgentOrBreaking('high', false), true);
    assert.equal(isRadarUrgentOrBreaking('low', true), true);
    assert.equal(isRadarUrgentOrBreaking('low', false, '🚨 URGENTE: Gol nos acréscimos'), true);
    assert.equal(isRadarUrgentOrBreaking('low', false, 'Resumo diário estável'), false);
  });
});
