import type { Todo, PendingItem } from '../types';

export type UnifiedKind = 'todo' | 'pending';

export interface UnifiedRow {
  kind: UnifiedKind;
  id: string;
  title: string;
  detail: string;
  /** Epoch ms para ordenação, ou null (sem data). */
  sortKey: number | null;
  overdue: boolean;
  done: boolean;
  sourceTodo?: Todo;
  sourcePending?: PendingItem;
}

function startOfToday(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function toMs(dateStr?: string): number | null {
  if (!dateStr) return null;
  const t = new Date(dateStr.length === 10 ? `${dateStr}T23:59:59` : dateStr).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Une tarefas e pendências ativas/concluídas em linhas uniformes. */
export function toUnifiedRows(todos: Todo[], pendings: PendingItem[], now: number): UnifiedRow[] {
  const today = startOfToday(now);
  const rows: UnifiedRow[] = [];

  for (const t of todos || []) {
    const key = toMs(t.due_date);
    rows.push({
      kind: 'todo',
      id: t.id,
      title: t.title,
      detail: t.priority === 'high' ? 'Prioridade alta' : t.event_title ? `Evento: ${t.event_title}` : 'Tarefa',
      sortKey: key,
      overdue: t.status !== 'completed' && key !== null && key < today,
      done: t.status === 'completed',
      sourceTodo: t,
    });
  }

  for (const p of pendings || []) {
    const key = toMs(p.scheduled_date);
    rows.push({
      kind: 'pending',
      id: p.id,
      title: p.title,
      detail: p.category ? `Pendência · ${p.category}` : 'Pendência',
      sortKey: key,
      overdue: p.status !== 'done' && key !== null && key < today,
      done: p.status === 'done',
      sourcePending: p,
    });
  }

  return rows;
}

/** Ordena ativas por urgência: atrasadas → hoje/próximas → sem data. */
export function sortUnifiedRows(rows: UnifiedRow[]): UnifiedRow[] {
  const active = rows.filter((r) => !r.done);
  return [...active].sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.sortKey === null && b.sortKey === null) return a.title.localeCompare(b.title);
    if (a.sortKey === null) return 1;
    if (b.sortKey === null) return -1;
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    return a.title.localeCompare(b.title);
  });
}
