import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDailySummary,
  calculateMonthWeeks,
  calculateMonthlyMetrics,
} from '../summaryCalculators';
import { Event, Todo } from '../../types';

describe('summaryCalculators — Eliminação de mocks e dados hardcoded', () => {
  const REF_NOW = new Date('2026-10-24T10:00:00'); // 10:00 AM

  describe('calculateDailySummary', () => {
    it('quando não há eventos, retorna estado elegante sem fallback mockado de Almoço', () => {
      const summary = calculateDailySummary([], [], REF_NOW);
      assert.equal(summary.metrics.eventsCount, 0);
      assert.equal(summary.metrics.committedHours, '0.0');
      assert.equal(summary.metrics.freeHours, '12.0');
      assert.equal(summary.nextEventTitle, undefined);
      assert.ok(summary.focusBlocks.length >= 1);
      assert.equal(summary.focusBlocks[0].label, 'Foco 08:00–20:00 · 12h');
      assert.equal(summary.timelineSegments.length, 1);
      assert.equal(summary.timelineSegments[0].type, 'free');
      assert.equal(summary.timelineSegments[0].flex, 12);
      assert.ok(summary.synthesisText.includes('livres hoje'));
    });

    it('quando há evento hoje, extrai o próximo evento real e blocos de foco calculados', () => {
      const events: Event[] = [
        {
          id: 'ev-1',
          user_id: 'u1',
          title: 'Reunião de Diretoria',
          start_at: '2026-10-24T14:00:00',
          end_at: '2026-10-24T15:30:00',
          category: 'work',
          created_at: '2026-10-20T00:00:00',
          updated_at: '2026-10-20T00:00:00',
        },
      ];

      const todos: Todo[] = [
        {
          id: 't-1',
          user_id: 'u1',
          title: 'Enviar relatório financeiro',
          priority: 'medium',
          status: 'pending',
          due_date: '2026-10-24T18:00:00',
          created_at: '2026-10-24T08:00:00',
          updated_at: '2026-10-24T08:00:00',
        },
      ];

      const summary = calculateDailySummary(events, todos, REF_NOW);
      assert.equal(summary.metrics.eventsCount, 1);
      assert.equal(summary.metrics.committedHours, '1.5');
      assert.equal(summary.metrics.freeHours, '10.5');
      assert.equal(summary.metrics.totalTodos, 1);
      assert.equal(summary.metrics.completedTodos, 0);

      // Próximo evento real (não mockado)
      assert.ok(summary.nextEventTitle?.includes('Reunião de Diretoria'));
      assert.ok(summary.nextEventTitle?.includes('14:00'));

      // Blocos de foco livres reais: antes (08:00–14:00: 6h) e depois (15:30–20:00: 4.5h)
      assert.equal(summary.focusBlocks.length, 2);
      assert.equal(summary.focusBlocks[0].label, 'Foco 08:00–14:00 · 6h');
      assert.equal(summary.focusBlocks[1].label, 'Foco 15:30–20:00 · 4.5h');

      // Timeline segments: free 6h, committed 1.5h, free 4.5h
      assert.equal(summary.timelineSegments.length, 3);
      assert.equal(summary.timelineSegments[0].type, 'free');
      assert.equal(summary.timelineSegments[0].flex, 6);
      assert.equal(summary.timelineSegments[1].type, 'committed');
      assert.equal(summary.timelineSegments[1].flex, 1.5);
      assert.equal(summary.timelineSegments[2].type, 'free');
      assert.equal(summary.timelineSegments[2].flex, 4.5);
    });

    it('ignora feriados e eventos de 24h na contagem de carga de trabalho', () => {
      const events: Event[] = [
        {
          id: 'ev-holiday',
          user_id: 'u1',
          title: 'Feriado Nacional',
          start_at: '2026-10-24T00:00:00',
          end_at: '2026-10-24T23:59:59',
          category: 'holiday',
          created_at: '2026-10-20T00:00:00',
          updated_at: '2026-10-20T00:00:00',
        },
      ];

      const summary = calculateDailySummary(events, [], REF_NOW);
      assert.equal(summary.metrics.committedHours, '0.0');
      assert.equal(summary.metrics.freeHours, '12.0');
    });
  });

  describe('calculateMonthWeeks e calculateMonthlyMetrics', () => {
    it('quando não há eventos no mês, calcula total 0 e hasData = false sem forçar fallback de 24h', () => {
      const metrics = calculateMonthlyMetrics([], [], REF_NOW);
      assert.equal(metrics.totalHours, '0');
      assert.equal(metrics.totalEvents, 0);
      assert.equal(metrics.hasData, false);

      const weeks = calculateMonthWeeks([], REF_NOW);
      assert.equal(weeks.length, 4);
      assert.deepEqual(weeks.map((w) => w.h), [0, 0, 0, 0]);
      assert.equal(weeks[3].cur, true); // Dia 24 cai na Sem 4
    });

    it('calcula a soma real de horas por semana para os eventos do mês', () => {
      const events: Event[] = [
        // Sem 1: dia 3, 2h
        {
          id: 'e1',
          user_id: 'u1',
          title: 'Planejamento',
          start_at: '2026-10-03T10:00:00',
          end_at: '2026-10-03T12:00:00',
          category: 'work',
          created_at: '',
          updated_at: '',
        },
        // Sem 2: dia 10, 3h
        {
          id: 'e2',
          user_id: 'u1',
          title: 'Workshop',
          start_at: '2026-10-10T14:00:00',
          end_at: '2026-10-10T17:00:00',
          category: 'work',
          created_at: '',
          updated_at: '',
        },
        // Sem 4: dia 24, 1.5h
        {
          id: 'e3',
          user_id: 'u1',
          title: 'Alinhamento',
          start_at: '2026-10-24T09:00:00',
          end_at: '2026-10-24T10:30:00',
          category: 'personal',
          created_at: '',
          updated_at: '',
        },
      ];

      const metrics = calculateMonthlyMetrics(events, [], REF_NOW);
      assert.equal(metrics.totalHours, '7'); // 2 + 3 + 1.5 = 6.5 -> round to 7 or 6.5
      assert.equal(metrics.totalEvents, 3);
      assert.equal(metrics.hasData, true);

      const weeks = calculateMonthWeeks(events, REF_NOW);
      assert.equal(weeks[0].h, 2);
      assert.equal(weeks[1].h, 3);
      assert.equal(weeks[2].h, 0);
      assert.equal(weeks[3].h, 1.5);
      assert.equal(weeks[3].cur, true);
    });
  });
});
