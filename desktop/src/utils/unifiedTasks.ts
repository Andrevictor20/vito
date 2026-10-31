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
  priority: 'low' | 'medium' | 'high' | 'urgent';
  sourceTodo?: Todo;
  sourcePending?: PendingItem;
}

export type TaskFilter = 'all' | 'today' | 'overdue' | 'nodate';
export type TaskSort = 'date' | 'alpha' | 'priority';

const PRIORITY_W: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

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

  const seen = new Set<string>();
  for (const t of todos || []) {
    const key = toMs(t.due_date);
    seen.add(t.id);
    const cat = (t as Todo).category || '';
    rows.push({
      kind: 'todo',
      id: t.id,
      title: t.title,
      detail: (t.priority === 'high' || t.priority === 'urgent') ? 'Prioridade alta' : cat ? `Tarefa · ${cat}` : 'Tarefa',
      sortKey: key,
      overdue: t.status !== 'completed' && key !== null && key < today,
      done: t.status === 'completed',
      priority: t.priority || 'medium',
      sourceTodo: t,
    });
  }

  // Dedupe: ids já migrados para todos não aparecem duas vezes.
  for (const p of pendings || []) {
    if (seen.has(p.id)) continue;
    const key = toMs(p.scheduled_date);
    rows.push({
      kind: 'pending',
      id: p.id,
      title: p.title,
      detail: p.category ? `Pendência · ${p.category}` : 'Pendência',
      sortKey: key,
      overdue: p.status !== 'completed' && key !== null && key < today,
      done: p.status === 'completed',
      priority: 'medium',
      sourcePending: p,
    });
  }

  return rows;
}

function isTodayKey(key: number | null, now: number): boolean {
  if (key === null) return false;
  const d = new Date(key);
  const n = new Date(now);
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

/** Filtra ativas: todas, hoje, atrasadas ou sem data. */
export function filterUnifiedRows(rows: UnifiedRow[], filter: TaskFilter, now: number): UnifiedRow[] {
  const active = rows.filter((r) => !r.done);
  switch (filter) {
    case 'today':
      return active.filter((r) => isTodayKey(r.sortKey, now));
    case 'overdue':
      return active.filter((r) => r.overdue);
    case 'nodate':
      return active.filter((r) => r.sortKey === null);
    default:
      return active;
  }
}

/** Ordena ativas: data (atrasadas → próximas → sem data), A–Z ou prioridade. */
export function sortUnifiedRows(rows: UnifiedRow[], sort: TaskSort = 'date'): UnifiedRow[] {
  const active = rows.filter((r) => !r.done);
  return [...active].sort((a, b) => {
    if (sort === 'alpha') return a.title.localeCompare(b.title, 'pt-BR');
    if (sort === 'priority') {
      const pa = PRIORITY_W[a.priority] ?? 1;
      const pb = PRIORITY_W[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      if (a.sortKey === null && b.sortKey === null) return a.title.localeCompare(b.title, 'pt-BR');
      if (a.sortKey === null) return 1;
      if (b.sortKey === null) return -1;
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
      return a.title.localeCompare(b.title, 'pt-BR');
    }
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.sortKey === null && b.sortKey === null) return a.title.localeCompare(b.title, 'pt-BR');
    if (a.sortKey === null) return 1;
    if (b.sortKey === null) return -1;
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    return a.title.localeCompare(b.title, 'pt-BR');
  });
}
