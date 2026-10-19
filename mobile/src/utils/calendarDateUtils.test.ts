import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isAllDayEvent, isEventOnDate, getEventDays, formatEventTimeRange, badgeDayMonthUTC, isHolidayReadOnly, getUpcomingGroupedEvents } from './calendarDateUtils';
import { Event } from '../types';

describe('Calendar Date Utils & All-Day / Holiday Detection (TDD)', () => {
  describe('isAllDayEvent', () => {
    test('detects Google Calendar all-day event saved as 00:00:00Z to 23:59:59Z', () => {
      const googleHoliday: Partial<Event> = {
        title: 'Nossa Senhora Aparecida',
        start_at: '2026-10-12T00:00:00Z',
        end_at: '2026-10-12T23:59:59Z',
      };
      assert.equal(isAllDayEvent(googleHoliday as Event), true);
    });

    test('detects national holidays by title even when starting at 00:00:00 or local night conversion', () => {
      const holiday: Partial<Event> = {
        title: 'Feriado de Nossa Senhora Aparecida',
        start_at: '2026-10-12T00:00:00Z',
        end_at: '2026-10-12T23:59:59Z',
      };
      assert.equal(isAllDayEvent(holiday as Event), true);

      const anoNovo: Partial<Event> = {
        title: 'Ano Novo',
        start_at: '2027-01-01T00:00:00Z',
        end_at: '2027-01-01T23:59:59Z',
      };
      assert.equal(isAllDayEvent(anoNovo as Event), true);

      const natal: Partial<Event> = {
        title: 'Natal',
        start_at: '2026-12-25T00:00:00Z',
        end_at: '2026-12-25T23:59:59Z',
      };
      assert.equal(isAllDayEvent(natal as Event), true);
    });

    test('detects explicit holiday category', () => {
      const holiday: Partial<Event> = {
        title: 'Emenda de Feriado',
        start_at: '2026-10-13T00:00:00Z',
        category: 'holiday',
      };
      assert.equal(isAllDayEvent(holiday as Event), true);
    });

    test('detects multi-day all-day events (diffHours >= 23)', () => {
      const vacation: Partial<Event> = {
        title: 'Viagem de Férias',
        start_at: '2026-11-01T00:00:00Z',
        end_at: '2026-11-05T23:59:59Z',
      };
      assert.equal(isAllDayEvent(vacation as Event), true);
    });

    test('returns false for regular timed meetings and appointments', () => {
      const meeting: Partial<Event> = {
        title: 'Reunião de Alinhamento com Cliente',
        start_at: '2026-10-12T14:00:00-03:00',
        end_at: '2026-10-12T15:00:00-03:00',
      };
      assert.equal(isAllDayEvent(meeting as Event), false);

      const dental: Partial<Event> = {
        title: 'Dentista - Limpeza',
        start_at: '2026-10-12T09:30:00-03:00',
        end_at: '2026-10-12T10:15:00-03:00',
      };
      assert.equal(isAllDayEvent(dental as Event), false);
    });

    test('returns false for empty or invalid event', () => {
      assert.equal(isAllDayEvent({} as Event), false);
    });
  });

  describe('formatEventTimeRange', () => {
    test('formats all-day event as "Dia Inteiro"', () => {
      const holiday: Partial<Event> = {
        title: 'Nossa Senhora Aparecida',
        start_at: '2026-10-12T00:00:00Z',
        end_at: '2026-10-12T23:59:59Z',
      };
      assert.equal(formatEventTimeRange(holiday as Event), 'Dia Inteiro');
    });
  });
});

  describe('badgeDayMonthUTC', () => {
    test('linha legada 00:00Z mantém o dia civil', () => {
      assert.deepEqual(badgeDayMonthUTC('2026-10-15T00:00:00Z', true), { day: '15', month: 'out' });
    });
    test('linha nova 03:00Z mantém o dia civil', () => {
      assert.deepEqual(badgeDayMonthUTC('2026-10-15T03:00:00Z', true), { day: '15', month: 'out' });
    });
  });

  describe('isHolidayReadOnly', () => {
    test('feriado trava, resto libera', () => {
      assert.equal(isHolidayReadOnly({ category: 'holiday' }), true);
      assert.equal(isHolidayReadOnly({ category: 'work' }), false);
      assert.equal(isHolidayReadOnly(null), false);
    });
  });

  describe('getUpcomingGroupedEvents (filtro de mesmo mês)', () => {
    test('retorna apenas eventos futuros do mesmo mês de referência e exclui meses seguintes', () => {
      const refDate = new Date(2026, 9, 19); // 19 de Outubro de 2026
      const sampleEvents: Event[] = [
        {
          id: 'ev-1',
          user_id: 'u-1',
          title: 'Reunião de Planejamento',
          start_at: '2026-10-21T18:00:00Z',
          end_at: '2026-10-21T18:30:00Z',
          category: 'work',
          created_at: '2026-10-01T00:00:00Z',
        },
        {
          id: 'ev-2',
          user_id: 'u-1',
          title: 'Dia do Servidor Público',
          start_at: '2026-10-28T00:00:00Z',
          end_at: '2026-10-28T23:59:59Z',
          category: 'holiday',
          created_at: '2026-10-01T00:00:00Z',
        },
        {
          id: 'ev-3',
          user_id: 'u-1',
          title: 'Finados',
          start_at: '2026-11-02T00:00:00Z',
          end_at: '2026-11-02T23:59:59Z',
          category: 'holiday',
          created_at: '2026-10-01T00:00:00Z',
        },
        {
          id: 'ev-passado',
          user_id: 'u-1',
          title: 'Reunião Passada',
          start_at: '2026-10-10T10:00:00Z',
          end_at: '2026-10-10T11:00:00Z',
          category: 'work',
          created_at: '2026-10-01T00:00:00Z',
        },
      ];

      const result = getUpcomingGroupedEvents(sampleEvents, refDate);

      // Deve incluir apenas ev-1 (21 Out) e ev-2 (28 Out), excluindo ev-3 (02 Nov) e ev-passado (10 Out)
      assert.equal(result.length, 2);
      assert.equal(result[0].id, 'ev-1');
      assert.equal(result[1].id, 'ev-2');
    });
  });
