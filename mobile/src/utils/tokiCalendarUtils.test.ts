import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getEventCompactEmoji,
  generateMonthData,
  generateMonthRange,
  formatTokiMonthHeader,
} from './tokiCalendarUtils';
import type { Event } from '../types';

describe('tokiCalendarUtils', () => {
  it('mapeia emojis semânticos para eventos no modo compacto Toki', () => {
    const holidayEvent: Event = {
      id: 'h1',
      user_id: 'u1',
      title: 'Dia do Servidor Público',
      start_at: '2026-10-28T00:00:00Z',
      end_at: '2026-10-28T23:59:59Z',
      category: 'holiday',
      created_at: '2026-10-01T00:00:00Z',
    };
    assert.equal(getEventCompactEmoji(holidayEvent), '🇧🇷');

    const finadosEvent: Event = {
      id: 'h2',
      user_id: 'u1',
      title: 'Finados',
      start_at: '2026-11-02T00:00:00Z',
      end_at: '2026-11-02T23:59:59Z',
      category: 'holiday',
      created_at: '2026-10-01T00:00:00Z',
    };
    assert.equal(getEventCompactEmoji(finadosEvent), '🕯️');

    const englishEvent: Event = {
      id: 's1',
      user_id: 'u1',
      title: 'Aula de inglês',
      start_at: '2026-10-24T08:00:00Z',
      end_at: '2026-10-24T11:15:00Z',
      category: 'study',
      created_at: '2026-10-01T00:00:00Z',
    };
    assert.equal(getEventCompactEmoji(englishEvent), '🇬🇧');

    const meetingEvent: Event = {
      id: 'w1',
      user_id: 'u1',
      title: 'Reunião planejamento',
      start_at: '2026-10-21T18:00:00Z',
      end_at: '2026-10-21T18:30:00Z',
      category: 'work',
      created_at: '2026-10-01T00:00:00Z',
    };
    assert.equal(getEventCompactEmoji(meetingEvent), '💼');
  });

  it('gera os dados corretos de um mês com padding de dias da semana', () => {
    // Outubro de 2026 começa na Quinta-feira (index 4 se Domingo = 0)
    const monthData = generateMonthData(2026, 9); // mês 9 = Outubro (0-indexed)
    assert.equal(monthData.year, 2026);
    assert.equal(monthData.month, 9);
    assert.equal(monthData.daysInMonth, 31);
    assert.equal(monthData.firstDayOfWeek, 4); // Quinta-feira

    // O primeiro dia com número 1 deve ter dayNumber = 1
    const dayOne = monthData.grid.find((d) => d.dayNumber === 1);
    assert.ok(dayOne);
    assert.equal(dayOne?.isCurrentMonth, true);
    assert.equal(dayOne?.dateKey, '2026-10-01');
  });

  it('gera uma sequência de meses para rolagem contínua infinita', () => {
    const baseDate = new Date(2026, 9, 19);
    const months = generateMonthRange(baseDate, 1, 2); // 1 passado, atual, 2 futuros = 4 meses
    assert.equal(months.length, 4);
    assert.equal(months[0].month, 8); // Setembro
    assert.equal(months[1].month, 9); // Outubro
    assert.equal(months[2].month, 10); // Novembro
    assert.equal(months[3].month, 11); // Dezembro
  });

  it('formata o cabeçalho do mês no estilo Toki', () => {
    const formatted = formatTokiMonthHeader(2026, 9);
    assert.equal(formatted.toLowerCase(), 'outubro 2026');
  });
});
