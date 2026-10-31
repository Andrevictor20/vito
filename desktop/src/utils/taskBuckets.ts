import type { UnifiedRow } from './unifiedTasks';

export type TaskBucket = 'atr' | 'hoje' | 'sem7' | 'dep' | 'sem';
export type TaskFilterType = 'all' | 'hoje' | 'atr' | 'sem';

export const TASK_BUCKET_LABELS: Record<TaskBucket, string> = {
  atr: 'Atrasadas',
  hoje: 'Hoje',
  sem7: 'Próximos 7 dias',
  dep: 'Depois',
  sem: 'Sem data',
};

export const TASK_FILTER_CHIPS: Array<{ id: TaskFilterType; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'hoje', label: 'Hoje' },
  { id: 'atr', label: 'Atrasadas' },
  { id: 'sem', label: 'Sem data' },
];

const MONTH_NAMES_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const WEEKDAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function getTaskDiffDays(dateStr?: string | null, nowMs: number = Date.now()): number | null {
  if (!dateStr) return null;
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let targetYear: number;
  let targetMonth: number;
  let targetDay: number;

  if (isoMatch) {
    targetYear = parseInt(isoMatch[1], 10);
    targetMonth = parseInt(isoMatch[2], 10) - 1;
    targetDay = parseInt(isoMatch[3], 10);
  } else {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    targetYear = d.getFullYear();
    targetMonth = d.getMonth();
    targetDay = d.getDate();
  }

  const targetDate = new Date(targetYear, targetMonth, targetDay, 0, 0, 0, 0);
  const nowDate = new Date(nowMs);
  const todayDate = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), 0, 0, 0, 0);

  return Math.round((targetDate.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000));
}

export function getTaskBucket(dateStr?: string | null, nowMs: number = Date.now()): TaskBucket {
  const diff = getTaskDiffDays(dateStr, nowMs);
  if (diff === null) return 'sem';
  if (diff < 0) return 'atr';
  if (diff === 0) return 'hoje';
  if (diff <= 7) return 'sem7';
  return 'dep';
}

export function formatRelativeTaskDate(dateStr?: string | null, nowMs: number = Date.now()): string | null {
  const diff = getTaskDiffDays(dateStr, nowMs);
  if (diff === null) return null;

  const isoMatch = dateStr?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let dt: Date;
  if (isoMatch) {
    dt = new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
  } else {
    dt = new Date(dateStr!);
  }

  const day = dt.getDate();
  const month = MONTH_NAMES_SHORT[dt.getMonth()];
  const formattedDayMonth = `${day} ${month}`;

  if (diff < 0) {
    if (diff === -1) return 'Ontem';
    return `Há ${-diff} dias · ${formattedDayMonth}`;
  }
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';

  const weekday = WEEKDAY_NAMES_SHORT[dt.getDay()];
  return `${weekday}, ${formattedDayMonth}`;
}

export function getRowDateStr(row: UnifiedRow): string | undefined {
  return row.sourceTodo?.due_date || (row.sourcePending as any)?.scheduled_date || undefined;
}

export interface TaskBucketGroup {
  bucket: TaskBucket;
  label: string;
  rows: UnifiedRow[];
}

export function groupTasksByBucket(
  rows: UnifiedRow[],
  activeFilter: TaskFilterType = 'all',
  searchQuery: string = '',
  nowMs: number = Date.now(),
): TaskBucketGroup[] {
  const activeRows = rows.filter((r) => !r.done);
  const q = searchQuery.trim().toLowerCase();

  const BUCKETS: TaskBucket[] = ['atr', 'hoje', 'sem7', 'dep', 'sem'];
  const groups: TaskBucketGroup[] = [];

  for (const b of BUCKETS) {
    if (activeFilter === 'hoje' && b !== 'hoje') continue;
    if (activeFilter === 'atr' && b !== 'atr') continue;
    if (activeFilter === 'sem' && b !== 'sem') continue;

    const bucketRows = activeRows.filter((r) => {
      const dateStr = getRowDateStr(r);
      const rowBucket = getTaskBucket(dateStr, nowMs);
      if (rowBucket !== b) return false;
      if (q) {
        return (
          r.title.toLowerCase().includes(q) ||
          r.detail.toLowerCase().includes(q)
        );
      }
      return true;
    });

    if (bucketRows.length > 0) {
      groups.push({
        bucket: b,
        label: TASK_BUCKET_LABELS[b],
        rows: bucketRows,
      });
    }
  }

  return groups;
}

export function computeChipCounts(
  rows: UnifiedRow[],
  nowMs: number = Date.now(),
): Record<TaskFilterType, number> {
  const activeRows = rows.filter((r) => !r.done);
  let hoje = 0;
  let atr = 0;
  let sem = 0;

  for (const r of activeRows) {
    const dateStr = getRowDateStr(r);
    const b = getTaskBucket(dateStr, nowMs);
    if (b === 'hoje') hoje++;
    else if (b === 'atr') atr++;
    else if (b === 'sem') sem++;
  }

  return {
    all: activeRows.length,
    hoje,
    atr,
    sem,
  };
}
