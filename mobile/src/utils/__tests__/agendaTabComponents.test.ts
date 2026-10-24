import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAllDayEvent, badgeDayMonthUTC, isHolidayReadOnly } from '../calendarDateUtils';
import type { Event } from '../../types';

describe('Agenda Tab & Components Unit Tests (TDD)', () => {
  const sampleEvents: Event[] = [
    {
      id: 'e1',
      user_id: 'u1',
      title: 'Reunião Executiva',
      start_at: '2026-10-23T10:00:00Z',
      end_at: '2026-10-23T11:00:00Z',
      category: 'work',
      source: 'google',
      created_at: '2026-10-01T00:00:00Z',
    },
    {
      id: 'e2',
      user_id: 'u1',
      title: 'Feriado Nacional',
      start_at: '2026-10-23T00:00:00Z',
      end_at: '2026-10-23T23:59:59Z',
      category: 'holiday',
      source: 'google',
      created_at: '2026-10-01T00:00:00Z',
    },
    {
      id: 'e3',
      user_id: 'u1',
      title: 'Treino e Academia',
      start_at: '2026-10-24T08:00:00Z',
      end_at: '2026-10-24T09:00:00Z',
      category: 'health',
      source: 'local',
      created_at: '2026-10-01T00:00:00Z',
    },
    {
      id: 'e4',
      user_id: 'u1',
      title: 'Aula de Piano',
      start_at: '2026-10-25T14:00:00Z',
      end_at: '2026-10-25T15:30:00Z',
      category: 'study',
      source: 'local',
      created_at: '2026-10-01T00:00:00Z',
    },
  ];

  describe('EventCard categorization and time handling', () => {
    it('corretamente identifica eventos de dia inteiro (.allday)', () => {
      assert.equal(isAllDayEvent(sampleEvents[1]), true);
      assert.equal(isAllDayEvent(sampleEvents[0]), false);
      assert.equal(isAllDayEvent(sampleEvents[2]), false);
    });

    it('extrai dia e mês em UTC de forma resiliente para os blocos .db', () => {
      const badge = badgeDayMonthUTC(sampleEvents[0].start_at, false);
      assert.equal(badge.day, '23');
      assert.equal(badge.month.toLowerCase(), 'out');
    });

    it('garante que feriados sejam somente leitura (sem exclusão acidental)', () => {
      assert.equal(isHolidayReadOnly(sampleEvents[1]), true);
      assert.equal(isHolidayReadOnly(sampleEvents[0]), false);
    });
  });

  describe('AgendaWeekStrip date mathematics', () => {
    it('calcula o domingo como primeiro dia da semana de qualquer data', () => {
      const targetDate = new Date('2026-10-23T12:00:00'); // Sexta-feira
      const dayOfWeek = targetDate.getDay(); // 5 = Sexta
      const startOfWeek = new Date(targetDate);
      startOfWeek.setDate(targetDate.getDate() - dayOfWeek);

      assert.equal(startOfWeek.getDay(), 0); // 0 = Domingo
      assert.equal(startOfWeek.getDate(), 18); // Domingo 18 de outubro
    });

    it('navega 7 dias no modo semana ao avançar ou retroceder', () => {
      const current = new Date('2026-10-23T12:00:00');
      const nextWeek = new Date(current);
      nextWeek.setDate(current.getDate() + 7);
      assert.equal(nextWeek.getDate(), 30);

      const prevWeek = new Date(current);
      prevWeek.setDate(current.getDate() - 7);
      assert.equal(prevWeek.getDate(), 16);
    });

    it('navega 1 mês no modo mês ao avançar ou retroceder', () => {
      const current = new Date('2026-10-23T12:00:00');
      const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      assert.equal(nextMonth.getMonth(), 10); // Novembro (base 0)

      const prevMonth = new Date(current.getFullYear(), current.getMonth() - 1, 1);
      assert.equal(prevMonth.getMonth(), 8); // Setembro (base 0)
    });
  });

  describe('AgendaView event grouping & suggestion logic', () => {
    it('separa compromissos de dia inteiro de compromissos com horário marcado', () => {
      const dayEvents = sampleEvents.slice(0, 2);
      const allDay = dayEvents.filter(isAllDayEvent);
      const timed = dayEvents.filter((ev) => !isAllDayEvent(ev));

      assert.equal(allDay.length, 1);
      assert.equal(allDay[0].id, 'e2');
      assert.equal(timed.length, 1);
      assert.equal(timed[0].id, 'e1');
    });

    it('formata o rótulo de contagem (.cnt) no padrão do protótipo vito-telas.html', () => {
      const formatBadge = (count: number) => {
        if (count === 0) return 'Dia livre';
        return `${count} ${count > 1 ? 'eventos' : 'evento'}`;
      };

      assert.equal(formatBadge(0), 'Dia livre');
      assert.equal(formatBadge(1), '1 evento');
      assert.equal(formatBadge(3), '3 eventos');
    });
  });
});
