import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore
import {
  formatEventDuration,
  formatTodoDue,
  formatScheduledDate,
  formatBookingDays,
  formatBookingWindow,
  bookingDisplayLink,
  formatRecurrenceLabel,
  formatTriggerSchedule,
} from './chatCards';

describe('Chat Cards helpers (TDD)', () => {
  describe('formatEventDuration', () => {
    it('formata minutos, horas cheias e horas quebradas', () => {
      assert.equal(formatEventDuration('2026-10-13T14:00:00', '2026-10-13T14:45:00'), '45 min');
      assert.equal(formatEventDuration('2026-10-13T14:00:00', '2026-10-13T15:00:00'), '1h');
      assert.equal(formatEventDuration('2026-10-13T14:00:00', '2026-10-13T15:30:00'), '1h30');
      assert.equal(formatEventDuration('2026-10-13T14:00:00', '2026-10-13T16:05:00'), '2h05');
    });

    it('retorna vazio para datas inválidas ou fim antes do início', () => {
      assert.equal(formatEventDuration('x', 'y'), '');
      assert.equal(formatEventDuration('2026-10-13T15:00:00', '2026-10-13T14:00:00'), '');
    });
  });

  describe('formatTodoDue', () => {
    it('formata prazo em pt-BR e trata ausência', () => {
      assert.equal(formatTodoDue(undefined), 'Sem prazo');
      assert.equal(formatTodoDue(''), 'Sem prazo');
      assert.equal(formatTodoDue('invalida'), 'Sem prazo');
      const out = formatTodoDue('2026-10-20T14:00:00-03:00');
      assert.ok(out.startsWith('Vence 20/10'), `got ${out}`);
    });
  });

  describe('formatScheduledDate', () => {
    it('extrai DD/MM de data simples e ISO', () => {
      assert.equal(formatScheduledDate(undefined), 'Sem data');
      assert.equal(formatScheduledDate('2026-10-20'), '20/10');
      assert.equal(formatScheduledDate('2026-10-20T00:00:00Z'), '20/10');
    });
  });

  describe('formatBookingDays', () => {
    it('rotula janelas semanais comuns', () => {
      assert.equal(formatBookingDays('[1,2,3,4,5,6,7]'), 'todos os dias');
      assert.equal(formatBookingDays(undefined), 'todos os dias');
      assert.equal(formatBookingDays('[1,2,3,4,5]'), 'dias úteis');
      assert.equal(formatBookingDays('[6,7]'), 'fim de semana');
    });
  });

  describe('formatBookingWindow', () => {
    it('compõe duração, horário e dias', () => {
      assert.equal(
        formatBookingWindow({ id: '1', title: 'Café', duration_minutes: 30, start_hour: '09:00', end_hour: '18:00', days_of_week: '[1,2,3,4,5,6,7]' }),
        '30 min · 09:00–18:00 · todos os dias'
      );
    });
  });

  describe('bookingDisplayLink', () => {
    it('prefere short_url e cai para public_url', () => {
      assert.equal(
        bookingDisplayLink({ id: '1', title: 'x', short_url: 'https://vito.s.gy/a', public_url: 'https://x/book' }),
        'https://vito.s.gy/a'
      );
      assert.equal(bookingDisplayLink({ id: '1', title: 'x', public_url: 'https://x/book' }), 'https://x/book');
      assert.equal(bookingDisplayLink({ id: '1', title: 'x' }), '');
    });
  });

  describe('formatRecurrenceLabel', () => {
    it('rotula recorrências em PT-BR', () => {
      assert.equal(formatRecurrenceLabel('WEEKLY'), 'Repete semanalmente');
      assert.equal(formatRecurrenceLabel('DAILY'), 'Repete diariamente');
      assert.equal(formatRecurrenceLabel('MONTHLY'), 'Repete mensalmente');
      assert.equal(formatRecurrenceLabel(undefined), null);
      assert.equal(formatRecurrenceLabel(''), null);
    });
  });

  describe('formatTriggerSchedule', () => {
    it('rotula frequência e horário do radar', () => {
      assert.equal(formatTriggerSchedule('daily_morning', '08:30'), 'Diário de manhã · 08:30');
      assert.equal(formatTriggerSchedule('hourly'), 'De hora em hora');
      assert.equal(formatTriggerSchedule(undefined, undefined), 'Diário de manhã');
    });
  });
});
