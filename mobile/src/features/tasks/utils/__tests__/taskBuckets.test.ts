import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getTaskDiffDays,
  getTaskBucket,
  formatRelativeTaskDate,
  groupTasksByBucket,
  computeChipCounts,
} from '../taskBuckets';
import type { UnifiedRow } from '../unifiedTasks';

// Data de referência fixada: 2026-10-23T12:00:00Z
const REF_NOW = new Date('2026-10-23T12:00:00').getTime();

const createMockRow = (id: string, dateStr?: string, done = false): UnifiedRow => ({
  kind: 'todo',
  id,
  title: `Tarefa ${id}`,
  detail: 'Detalhe',
  sortKey: dateStr ? new Date(dateStr).getTime() : null,
  overdue: false,
  done,
  priority: 'medium',
  sourceTodo: {
    id,
    user_id: 'u1',
    title: `Tarefa ${id}`,
    status: done ? 'completed' : 'pending',
    due_date: dateStr,
    created_at: '',
  } as any,
});

describe('taskBuckets — lógica de agrupamento fiel a vito-telas.html', () => {
  it('calcula getTaskDiffDays corretamente', () => {
    assert.equal(getTaskDiffDays(undefined, REF_NOW), null);
    assert.equal(getTaskDiffDays(null, REF_NOW), null);
    // Hoje: 2026-10-23
    assert.equal(getTaskDiffDays('2026-10-23', REF_NOW), 0);
    // Ontem: 2026-10-22
    assert.equal(getTaskDiffDays('2026-10-22', REF_NOW), -1);
    // Há 3 dias: 2026-10-20
    assert.equal(getTaskDiffDays('2026-10-20', REF_NOW), -3);
    // Amanhã: 2026-10-24
    assert.equal(getTaskDiffDays('2026-10-24', REF_NOW), 1);
    // Em 5 dias: 2026-10-28
    assert.equal(getTaskDiffDays('2026-10-28', REF_NOW), 5);
    // Em 10 dias: 2026-11-02
    assert.equal(getTaskDiffDays('2026-11-02', REF_NOW), 10);
  });

  it('determina o bucket correto', () => {
    assert.equal(getTaskBucket(undefined, REF_NOW), 'sem');
    assert.equal(getTaskBucket('2026-10-20', REF_NOW), 'atr');
    assert.equal(getTaskBucket('2026-10-23', REF_NOW), 'hoje');
    assert.equal(getTaskBucket('2026-10-26', REF_NOW), 'sem7');
    assert.equal(getTaskBucket('2026-11-05', REF_NOW), 'dep');
  });

  it('formata prazos relativos fiéis ao protótipo', () => {
    assert.equal(formatRelativeTaskDate(undefined, REF_NOW), null);
    assert.equal(formatRelativeTaskDate('2026-10-22', REF_NOW), 'Ontem');
    assert.equal(formatRelativeTaskDate('2026-10-20', REF_NOW), 'Há 3 dias · 20 out');
    assert.equal(formatRelativeTaskDate('2026-10-23', REF_NOW), 'Hoje');
    assert.equal(formatRelativeTaskDate('2026-10-24', REF_NOW), 'Amanhã');
    // 2026-10-25 é domingo
    assert.equal(formatRelativeTaskDate('2026-10-25', REF_NOW), 'Dom, 25 out');
  });

  it('computa contagens rápidas para os chips', () => {
    const rows: UnifiedRow[] = [
      createMockRow('1', '2026-10-20'), // atr
      createMockRow('2', '2026-10-21'), // atr
      createMockRow('3', '2026-10-23'), // hoje
      createMockRow('4', '2026-10-26'), // sem7
      createMockRow('5', undefined),     // sem
      createMockRow('6', '2026-10-20', true), // concluída (não conta)
    ];

    const counts = computeChipCounts(rows, REF_NOW);
    assert.equal(counts.all, 5);
    assert.equal(counts.atr, 2);
    assert.equal(counts.hoje, 1);
    assert.equal(counts.sem, 1);
  });

  it('agrupa tarefas por bucket e respeita filtros e busca', () => {
    const rows: UnifiedRow[] = [
      createMockRow('1', '2026-10-20'),
      createMockRow('2', '2026-10-23'),
      createMockRow('3', '2026-10-25'),
      createMockRow('4', undefined),
    ];

    // Com filtro 'all'
    const groupsAll = groupTasksByBucket(rows, 'all', '', REF_NOW);
    assert.equal(groupsAll.length, 4);
    assert.deepEqual(groupsAll.map((g) => g.bucket), ['atr', 'hoje', 'sem7', 'sem']);

    // Com filtro 'atr'
    const groupsAtr = groupTasksByBucket(rows, 'atr', '', REF_NOW);
    assert.equal(groupsAtr.length, 1);
    assert.equal(groupsAtr[0].bucket, 'atr');
    assert.equal(groupsAtr[0].rows.length, 1);

    // Com busca 'Tarefa 2'
    const groupsSearch = groupTasksByBucket(rows, 'all', 'Tarefa 2', REF_NOW);
    assert.equal(groupsSearch.length, 1);
    assert.equal(groupsSearch[0].bucket, 'hoje');
    assert.equal(groupsSearch[0].rows[0].id, '2');
  });
});
