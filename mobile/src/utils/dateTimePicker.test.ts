import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  toISODateLocal,
  parseISODate,
  addDaysISO,
  todayISO,
  buildMonthGrid,
  monthLabelPt,
  buildTimeSlots,
  isValidHHMM,
  toLocalISO,
} from './dateTimePicker';

describe('dateTimePicker', () => {
  it('toISODateLocal monta YYYY-MM-DD com zero à esquerda', () => {
    assert.equal(toISODateLocal(2026, 10, 5), '2026-10-05');
    assert.equal(toISODateLocal(2026, 1, 15), '2026-01-15');
  });

  it('parseISODate extrai ano/mês/dia ou null', () => {
    assert.deepEqual(parseISODate('2026-10-13'), { year: 2026, month: 10, day: 13 });
    assert.equal(parseISODate('2026-13-01'), null);
    assert.equal(parseISODate('não-data'), null);
  });

  it('addDaysISO soma/subtrai dias atravessando mês', () => {
    assert.equal(addDaysISO('2026-10-31', 1), '2026-11-01');
    assert.equal(addDaysISO('2026-10-01', -1), '2026-09-30');
    assert.equal(addDaysISO('2026-02-28', 1), '2026-03-01');
  });

  it('todayISO retorna a data local de hoje', () => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    assert.equal(todayISO(), `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
  });

  it('buildMonthGrid de outubro/2026 começa numa quinta (Sun-start)', () => {
    const grid = buildMonthGrid(2026, 10);
    assert.equal(grid[0].map((c) => c.day).join(','), ',,,,1,2,3');
    assert.equal(grid[0][4].iso, '2026-10-01');
    const allDays = grid.flat().filter((c) => c.day !== null);
    assert.equal(allDays.length, 31);
    assert.equal(allDays[30].iso, '2026-10-31');
  });

  it('buildMonthGrid cobre fevereiro bissexto (2024)', () => {
    const allDays = buildMonthGrid(2024, 2).flat().filter((c) => c.day !== null);
    assert.equal(allDays.length, 29);
  });

  it('monthLabelPt sem depender de ICU', () => {
    assert.equal(monthLabelPt(2026, 10), 'outubro de 2026');
    assert.equal(monthLabelPt(2026, 1), 'janeiro de 2026');
  });

  it('buildTimeSlots gera 48 slots de 30min', () => {
    const slots = buildTimeSlots(30);
    assert.equal(slots.length, 48);
    assert.equal(slots[0], '00:00');
    assert.equal(slots[47], '23:30');
    assert.ok(slots.includes('09:00'));
  });

  it('isValidHHMM valida formato e faixa', () => {
    assert.equal(isValidHHMM('09:00'), true);
    assert.equal(isValidHHMM('23:59'), true);
    assert.equal(isValidHHMM('24:00'), false);
    assert.equal(isValidHHMM('9:00'), false);
    assert.equal(isValidHHMM('ab:cd'), false);
  });

  it('toLocalISO monta ISO ou null', () => {
    const iso = toLocalISO('2026-10-20', '09:30');
    assert.ok(iso);
    const d = new Date(iso as string);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 9);
    assert.equal(d.getDate(), 20);
    assert.equal(d.getHours(), 9);
    assert.equal(d.getMinutes(), 30);
    assert.equal(toLocalISO('2026-13-01', '09:00'), null);
    assert.equal(toLocalISO('2026-10-20', '9:00'), null);
  });
});
