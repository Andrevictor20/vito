import { describe, it, expect } from 'vitest';
import { extractReportParagraphs, parseReportPayload, buildRadarChatPrompt } from './radarReportUtils';

describe('radarReportUtils', () => {
  it('should parse valid JSON payload', () => {
    const payload = JSON.stringify({
      condition_met: true,
      summary: 'Alerta de concurso aberto',
      confidence: 0.95,
    });
    const parsed = parseReportPayload(payload);
    expect(parsed).not.toBeNull();
    expect(parsed?.condition_met).toBe(true);
    expect(parsed?.summary).toBe('Alerta de concurso aberto');
  });

  it('should extract paragraphs array from JSON report', () => {
    const payload = JSON.stringify({
      paragraphs: ['Parágrafo 1 de detalhes', 'Parágrafo 2 de cronograma'],
    });
    const paragraphs = extractReportParagraphs(undefined, payload);
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toBe('Parágrafo 1 de detalhes');
    expect(paragraphs[1]).toBe('Parágrafo 2 de cronograma');
  });

  it('should extract plain text split by double newlines when not json', () => {
    const message = 'Primeiro parágrafo do relatório.\n\nSegundo parágrafo detalhando fontes.';
    const paragraphs = extractReportParagraphs(message);
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toBe('Primeiro parágrafo do relatório.');
    expect(paragraphs[1]).toBe('Segundo parágrafo detalhando fontes.');
  });

  it('should build radar ask prompt correctly', () => {
    const prompt = buildRadarChatPrompt('Concursos', 'Quero que me avise');
    expect(prompt).toContain('Olá Vito!');
    expect(prompt).toContain('radar "Concursos"');
    expect(prompt).toContain('Quero que me avise');
  });
});
