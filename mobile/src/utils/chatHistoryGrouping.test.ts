import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatGroupTimestamp, formatShortDate, groupSessionsByDate } from './chatHistoryGrouping';
import type { ConversationSession } from '../types';

const NOW = new Date(2026, 9, 14, 18, 10, 0); // 14 out 2026, 18:10 (timezone do device)

function sess(id: string, timestamp: string): ConversationSession {
  return { id, title: id, preview: 'oi', timestamp, messages: [] };
}

describe('chatHistoryGrouping', () => {
  it('hoje → "Hoje, 18:10"', () => {
    const ts = new Date(2026, 9, 14, 18, 10, 0).toISOString();
    assert.equal(formatGroupTimestamp(ts, NOW), 'Hoje, 18:10');
  });

  it('ontem → "Ontem"', () => {
    const ts = new Date(2026, 9, 13, 22, 5, 0).toISOString();
    assert.equal(formatGroupTimestamp(ts, NOW), 'Ontem');
  });

  it('semana passada → "11 out" (sem ponto, sem "de")', () => {
    const ts = new Date(2026, 9, 11, 9, 0, 0).toISOString();
    const label = formatGroupTimestamp(ts, NOW);
    assert.equal(label, '11 out');
    assert.ok(!label.includes('.'), 'sem ponto');
    assert.ok(!label.includes(' de '), 'sem "de"');
  });

  it('formatShortDate remove ponto e "de"', () => {
    assert.equal(formatShortDate(new Date(2026, 9, 10, 12, 0, 0)), '10 out');
  });

  it('agrupa HOJE / ONTEM / data e ordena grupos por recência + itens desc', () => {
    const groups = groupSessionsByDate(
      [
        sess('old-a', new Date(2026, 9, 10, 8, 0, 0).toISOString()),
        sess('today-old', new Date(2026, 9, 14, 9, 0, 0).toISOString()),
        sess('yesterday', new Date(2026, 9, 13, 20, 0, 0).toISOString()),
        sess('today-new', new Date(2026, 9, 14, 17, 0, 0).toISOString()),
        sess('old-b', new Date(2026, 9, 10, 15, 30, 0).toISOString()),
      ],
      NOW,
    );
    assert.deepEqual(
      groups.map((g) => g.title),
      ['Hoje', 'Ontem', '10 out'],
    );
    assert.deepEqual(
      groups[0].sessions.map((s) => s.id),
      ['today-new', 'today-old'],
    );
    assert.deepEqual(
      groups[2].sessions.map((s) => s.id),
      ['old-b', 'old-a'],
    );
  });

  it('timestamp inválido não quebra (vai por último)', () => {
    const groups = groupSessionsByDate(
      [sess('bad', 'nao-e-data'), sess('ok', new Date(2026, 9, 14, 10, 0, 0).toISOString())],
      NOW,
    );
    assert.equal(groups[0].title, 'Hoje');
    assert.equal(groups[groups.length - 1].sessions[0].id, 'bad');
    assert.equal(formatGroupTimestamp('nao-e-data', NOW), 'Recente');
  });
});
