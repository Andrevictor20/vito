import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterTriggersByCategory,
  countTriggersByCategory,
  type RadarFilterInput,
} from './radarFilter';

const SAMPLE: RadarFilterInput[] = [
  { id: '1', category: 'finance', status: 'active' },
  { id: '2', category: 'finance', status: 'paused' },
  { id: '3', category: 'weather', status: 'active' },
];

describe('radarFilter', () => {
  it("'all' devolve todos os radares", () => {
    assert.equal(filterTriggersByCategory(SAMPLE, 'all').length, 3);
  });

  it('filtra por categoria exata', () => {
    const out = filterTriggersByCategory(SAMPLE, 'finance');
    assert.deepEqual(out.map((t) => t.id), ['1', '2']);
  });

  it('categoria vazia devolve lista vazia', () => {
    assert.deepEqual(filterTriggersByCategory(SAMPLE, 'sports' as never), []);
  });

  it('conta radares por categoria', () => {
    assert.deepEqual(countTriggersByCategory(SAMPLE), {
      finance: 2,
      weather: 1,
    });
  });
});
