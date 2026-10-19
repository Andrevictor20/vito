import { describe, it, expect } from 'vitest';
import { filterTriggersByCategory, countTriggersByCategory, RadarFilterInput } from './radarFilter';

describe('radarFilter utility', () => {
  const sampleTriggers: RadarFilterInput[] = [
    { id: '1', category: 'career', status: 'active' },
    { id: '2', category: 'career', status: 'paused' },
    { id: '3', category: 'finance', status: 'active' },
    { id: '4', category: 'tech', status: 'active' },
  ];

  it('retorna todos os radares quando category for "all"', () => {
    const result = filterTriggersByCategory(sampleTriggers, 'all');
    expect(result).toHaveLength(4);
  });

  it('filtra radares por categoria com case-insensitivity', () => {
    const result = filterTriggersByCategory(sampleTriggers, 'Career');
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(['1', '2']);
  });

  it('retorna lista vazia para categoria sem itens', () => {
    const result = filterTriggersByCategory(sampleTriggers, 'real_estate');
    expect(result).toHaveLength(0);
  });

  it('conta corretamente radares por categoria', () => {
    const counts = countTriggersByCategory(sampleTriggers);
    expect(counts).toEqual({
      career: 2,
      finance: 1,
      tech: 1,
    });
  });
});
