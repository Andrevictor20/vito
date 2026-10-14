import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toUnifiedRows, sortUnifiedRows, filterUnifiedRows } from './unifiedTasks';
import type { Todo, PendingItem } from '../types';

// W1: página única "Tarefas e Pendências" — lista mista ordenada por urgência:
// atrasadas → hoje → próximas → sem data. Concluídas ficam separadas.

const NOW = new Date('2026-10-13T12:00:00').getTime();

const todo = (over: Partial<Todo>): Todo => ({
  id: 't', user_id: 'u', title: 'T', priority: 'medium',
  status: 'pending', created_at: '', ...over,
} as Todo);

const pending = (over: Partial<PendingItem>): PendingItem => ({
  id: 'p', user_id: 'u', title: 'P', category: 'geral',
  status: 'inbox', created_at: '', updated_at: '', ...over,
} as PendingItem);

describe('unifiedTasks', () => {
  it('ordena: atrasada, hoje, futura, sem data', () => {
    const rows = toUnifiedRows(
      [
        todo({ id: 'nodate', title: 'Sem data' }),
        todo({ id: 'future', title: 'Futura', due_date: '2026-10-20T10:00:00' }),
        todo({ id: 'today', title: 'Hoje', due_date: '2026-10-13T18:00:00' }),
        todo({ id: 'late', title: 'Atrasada', due_date: '2026-10-10T10:00:00' }),
      ],
      [pending({ id: 'psched', title: 'Agendada', status: 'scheduled', scheduled_date: '2026-10-14' })],
      NOW,
    );
    const sorted = sortUnifiedRows(rows).map((r) => r.id);
    assert.deepEqual(sorted, ['late', 'today', 'psched', 'future', 'nodate']);
  });

  it('marca overdue e separa concluídas', () => {
    const rows = toUnifiedRows(
      [
        todo({ id: 'late', due_date: '2026-10-10T10:00:00' }),
        todo({ id: 'donet', status: 'completed' }),
      ],
      [pending({ id: 'donep', status: 'done' })],
      NOW,
    );
    const late = rows.find((r) => r.id === 'late')!;
    assert.equal(late.overdue, true);
    assert.deepEqual(
      rows.filter((r) => r.done).map((r) => r.id).sort(),
      ['donep', 'donet'],
    );
  });

  it('pendência sem data entra no grupo sem data com badge de categoria', () => {
    const rows = toUnifiedRows([], [pending({ id: 'p1', category: 'saude' })], NOW);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].kind, 'pending');
    assert.equal(rows[0].sortKey, null);
    assert.match(rows[0].detail || '', /saude/i);
  });

  it('dedupe: pendência já migrada (mesmo id) não duplica', () => {
    const rows = toUnifiedRows(
      [todo({ id: 'same', title: 'Migrada' })],
      [pending({ id: 'same', title: 'Legada' })],
      NOW,
    );
    assert.equal(rows.filter((r) => r.id === 'same').length, 1);
  });

  it('filtra hoje/atrasadas/sem data e ordena por prioridade e A–Z', () => {
    const rows = toUnifiedRows(
      [
        todo({ id: 'late', title: 'Zeta', priority: 'low', due_date: '2026-10-10T10:00:00' }),
        todo({ id: 'today', title: 'Alfa', priority: 'high', due_date: '2026-10-13T18:00:00' }),
        todo({ id: 'nodate', title: 'Beta', priority: 'high' }),
      ],
      [],
      NOW,
    );
    assert.deepEqual(filterUnifiedRows(rows, 'overdue', NOW).map((r) => r.id), ['late']);
    assert.deepEqual(filterUnifiedRows(rows, 'today', NOW).map((r) => r.id), ['today']);
    assert.deepEqual(filterUnifiedRows(rows, 'nodate', NOW).map((r) => r.id), ['nodate']);
    assert.deepEqual(sortUnifiedRows(rows, 'priority').map((r) => r.id), ['today', 'nodate', 'late']);
    assert.deepEqual(sortUnifiedRows(rows, 'alpha').map((r) => r.id), ['today', 'nodate', 'late']);
  });
});
