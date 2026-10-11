import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isAllDayEvent, isEventOnDate, getEventDays, formatEventTimeRange } from './calendarDateUtils';
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
