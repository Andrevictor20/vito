import { describe, it, expect } from 'vitest';
import { calculateWeeklySummaries, plural } from './weeklySummaryCalculator';
import { CalendarEvent, Todo } from '../types';

describe('weeklySummaryCalculator', () => {
  it('should pluralize words correctly', () => {
    expect(plural(1, 'tarefa', 'tarefas')).toBe('1 tarefa');
    expect(plural(2, 'tarefa', 'tarefas')).toBe('2 tarefas');
    expect(plural(0, 'tarefa', 'tarefas')).toBe('0 tarefas');
  });

  it('should calculate weekly summaries from events and todos', () => {
    const now = new Date();
    const event1: CalendarEvent = {
      id: 'ev-1',
      title: 'Reunião de Alinhamento',
      category: 'work',
      start_at: now.toISOString(),
      end_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(), // 1 hora
    };
    const todo1: Todo = {
      id: 'td-1',
      title: 'Entregar relatório',
      status: 'completed',
      priority: 'high',
      due_date: now.toISOString(),
    };

    const summaries = calculateWeeklySummaries([event1], [todo1], 2);
    expect(summaries).toHaveLength(2);
    const currentWeek = summaries[0];
    expect(currentWeek.isCurrentWeek).toBe(true);
    expect(currentWeek.eventsCount).toBe(1);
    expect(currentWeek.hours).toBe(1);
    expect(currentWeek.completedTodosCount).toBe(1);
    expect(currentWeek.dailyActivity).toHaveLength(7);
  });
});
