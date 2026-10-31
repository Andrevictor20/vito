import type { CalendarEvent as Event, Todo } from '../types';
import { isAllDayEvent } from './calendarDateUtils';

export interface DailyMetrics {
  eventsCount: number;
  committedHours: string;
  freeHours: string;
  totalTodos: number;
  completedTodos: number;
}

export interface FocusBlock {
  label: string;
  duration: string;
  startMinutes: number;
  endMinutes: number;
}

export interface TimelineSegment {
  flex: number;
  type: 'free' | 'committed';
}

export interface DailySummaryData {
  metrics: DailyMetrics;
  hasFreeWindow: boolean;
  nextEventTitle?: string;
  focusBlocks: FocusBlock[];
  timelineSegments: TimelineSegment[];
  synthesisText: string;
  todayFormatted: string;
}

export interface MonthWeekItem {
  l: string;
  h: number;
  cur?: boolean;
}

export interface MonthlyMetricsData {
  totalHours: string;
  totalEvents: number;
  totalTodos: number;
  completionRate: number;
  workRatio: number;
  personalRatio: number;
  weeks: MonthWeekItem[];
  hasData: boolean;
}

const WORKDAY_START_MIN = 8 * 60; // 08:00
const WORKDAY_END_MIN = 20 * 60;   // 20:00
const TOTAL_WORKDAY_HOURS = 12;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatMinutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isValidWorkEvent(e: Event): boolean {
  if (isAllDayEvent(e)) return false;
  const cat = (e.category || '').toLowerCase();
  if (cat === 'holiday' || cat === 'feriado') return false;
  const start = new Date(e.start_at).getTime();
  const end = new Date(e.end_at).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return false;
  if ((end - start) / (1000 * 60 * 60) >= 23) return false;
  return true;
}

export function calculateDailySummary(
  events: Event[],
  todos: Todo[],
  now: Date = new Date()
): DailySummaryData {
  const weekdays = [
    'domingo',
    'segunda-feira',
    'terça-feira',
    'quarta-feira',
    'quinta-feira',
    'sexta-feira',
    'sábado',
  ];
  const months = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];
  const todayFormatted = `Hoje · ${weekdays[now.getDay()]}, ${now.getDate()} de ${months[now.getMonth()]}`;

  const todayEvents = events.filter((e) => {
    try {
      const d = new Date(e.start_at);
      return isSameDay(d, now);
    } catch {
      return false;
    }
  });

  const validEvents = todayEvents.filter(isValidWorkEvent);

  const todayTodos = todos.filter((t) => {
    try {
      if (!t.due_date) return true;
      const d = new Date(t.due_date);
      return isSameDay(d, now);
    } catch {
      return true;
    }
  });

  const completedTodos = todayTodos.filter((t) => t.status === 'completed');

  let totalMinutes = 0;
  validEvents.forEach((e) => {
    const s = new Date(e.start_at).getTime();
    const end = new Date(e.end_at).getTime();
    totalMinutes += Math.round((end - s) / (1000 * 60));
  });

  const committedHours = (totalMinutes / 60).toFixed(1);
  const committedNum = parseFloat(committedHours);
  const freeHours = Math.max(0, TOTAL_WORKDAY_HOURS - committedNum).toFixed(1);
  const hasFreeWindow = parseFloat(freeHours) >= 2;

  let nextEventTitle: string | undefined = undefined;
  if (validEvents.length > 0) {
    const nowMs = now.getTime();
    const sorted = [...validEvents].sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );
    const upcoming = sorted.find((e) => new Date(e.end_at).getTime() >= nowMs) || sorted[0];
    if (upcoming) {
      const startD = new Date(upcoming.start_at);
      const timeStr = `${pad2(startD.getHours())}:${pad2(startD.getMinutes())}`;
      nextEventTitle = `${upcoming.title} · ${timeStr}`;
    }
  }

  const intervals: Array<{ start: number; end: number }> = validEvents
    .map((e) => {
      const s = new Date(e.start_at);
      const end = new Date(e.end_at);
      const startMin = s.getHours() * 60 + s.getMinutes();
      const endMin = end.getHours() * 60 + end.getMinutes();
      return {
        start: Math.max(WORKDAY_START_MIN, Math.min(WORKDAY_END_MIN, startMin)),
        end: Math.max(WORKDAY_START_MIN, Math.min(WORKDAY_END_MIN, endMin)),
      };
    })
    .filter((iv) => iv.end > iv.start)
    .sort((a, b) => a.start - b.start);

  const mergedCommitments: Array<{ start: number; end: number }> = [];
  intervals.forEach((iv) => {
    if (mergedCommitments.length === 0) {
      mergedCommitments.push({ ...iv });
    } else {
      const last = mergedCommitments[mergedCommitments.length - 1];
      if (iv.start <= last.end) {
        last.end = Math.max(last.end, iv.end);
      } else {
        mergedCommitments.push({ ...iv });
      }
    }
  });

  const focusBlocks: FocusBlock[] = [];
  const timelineSegments: TimelineSegment[] = [];

  let cursor = WORKDAY_START_MIN;
  mergedCommitments.forEach((cm) => {
    if (cm.start > cursor) {
      const freeDur = (cm.start - cursor) / 60;
      timelineSegments.push({ flex: Number(freeDur.toFixed(1)), type: 'free' });
      if (freeDur >= 1) {
        focusBlocks.push({
          label: `Foco ${formatMinutesToTime(cursor)}–${formatMinutesToTime(cm.start)} · ${Number(freeDur.toFixed(1))}h`,
          duration: `${Number(freeDur.toFixed(1))}h`,
          startMinutes: cursor,
          endMinutes: cm.start,
        });
      }
    }
    const commDur = (cm.end - cm.start) / 60;
    timelineSegments.push({ flex: Number(commDur.toFixed(1)), type: 'committed' });
    cursor = cm.end;
  });

  if (cursor < WORKDAY_END_MIN) {
    const freeDur = (WORKDAY_END_MIN - cursor) / 60;
    timelineSegments.push({ flex: Number(freeDur.toFixed(1)), type: 'free' });
    if (freeDur >= 1) {
      focusBlocks.push({
        label: `Foco ${formatMinutesToTime(cursor)}–${formatMinutesToTime(WORKDAY_END_MIN)} · ${Number(freeDur.toFixed(1))}h`,
        duration: `${Number(freeDur.toFixed(1))}h`,
        startMinutes: cursor,
        endMinutes: WORKDAY_END_MIN,
      });
    }
  }

  if (timelineSegments.length === 0) {
    timelineSegments.push({ flex: TOTAL_WORKDAY_HOURS, type: 'free' });
  }

  const openTodos = todayTodos.length - completedTodos.length;
  let synthesisText = '';
  if (todayEvents.length === 0 && todayTodos.length === 0) {
    synthesisText =
      'Sua agenda e lista de tarefas estão totalmente livres hoje. Momento propício para descanso, planejamento estratégico ou adiantar projetos.';
  } else if (todayEvents.length === 0) {
    const pendentes = openTodos === 1 ? '1 tarefa pendente' : `${openTodos} tarefas pendentes`;
    synthesisText = `Dia sem compromissos fixos agendados. Você possui ${pendentes} — boa hora para avançar nas tarefas.`;
  } else {
    const compromissos = todayEvents.length === 1 ? '1 compromisso' : `${todayEvents.length} compromissos`;
    synthesisText = `Dia com ${compromissos} (${committedHours}h) e ${freeHours}h livres. Boa hora para avançar nas ${openTodos} tarefas que faltam.`;
  }

  return {
    metrics: {
      eventsCount: todayEvents.length,
      committedHours,
      freeHours,
      totalTodos: todayTodos.length,
      completedTodos: completedTodos.length,
    },
    hasFreeWindow,
    nextEventTitle,
    focusBlocks,
    timelineSegments,
    synthesisText,
    todayFormatted,
  };
}

export function calculateMonthWeeks(events: Event[], now: Date = new Date()): MonthWeekItem[] {
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentDate = now.getDate();

  const monthEvents = events.filter((e) => {
    try {
      const d = new Date(e.start_at);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && isValidWorkEvent(e);
    } catch {
      return false;
    }
  });

  const weekRanges = [
    { label: 'Sem 1', start: 1, end: 7 },
    { label: 'Sem 2', start: 8, end: 14 },
    { label: 'Sem 3', start: 15, end: 21 },
    { label: 'Sem 4', start: 22, end: 31 },
  ];

  return weekRanges.map((w) => {
    let weekMinutes = 0;
    monthEvents.forEach((e) => {
      const d = new Date(e.start_at);
      const day = d.getDate();
      if (day >= w.start && day <= w.end) {
        const s = d.getTime();
        const end = new Date(e.end_at).getTime();
        weekMinutes += Math.round((end - s) / (1000 * 60));
      }
    });

    const isCurrent = currentDate >= w.start && currentDate <= w.end;
    return {
      l: w.label,
      h: Number((weekMinutes / 60).toFixed(1)),
      cur: isCurrent,
    };
  });
}

export function calculateMonthlyMetrics(
  events: Event[],
  todos: Todo[],
  now: Date = new Date()
): MonthlyMetricsData {
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthEvents = events.filter((e) => {
    try {
      const d = new Date(e.start_at);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    } catch {
      return false;
    }
  });

  const monthTodos = todos.filter((t) => {
    try {
      const d = new Date(t.due_date || t.created_at || now);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    } catch {
      return false;
    }
  });

  const completedCount = monthTodos.filter((t) => t.status === 'completed').length;
  const taskCompletionRate =
    monthTodos.length > 0 ? Math.round((completedCount / monthTodos.length) * 100) : 100;

  let totalMonthMinutes = 0;
  let workMinutes = 0;
  let personalMinutes = 0;

  monthEvents.forEach((e) => {
    if (!isValidWorkEvent(e)) return;
    const s = new Date(e.start_at).getTime();
    const end = new Date(e.end_at).getTime();
    const dur = end > s ? Math.round((end - s) / (1000 * 60)) : 60;
    totalMonthMinutes += dur;

    const cat = (e.category || '').toLowerCase();
    if (cat.includes('trab') || cat.includes('work') || cat.includes('reuni')) {
      workMinutes += dur;
    } else {
      personalMinutes += dur;
    }
  });

  const workRatio =
    totalMonthMinutes > 0 ? Math.round((workMinutes / totalMonthMinutes) * 100) : 50;
  const personalRatio = 100 - workRatio;

  const weeks = calculateMonthWeeks(events, now);
  const hasData = totalMonthMinutes > 0 || monthEvents.length > 0;

  return {
    totalHours: (totalMonthMinutes / 60).toFixed(0),
    totalEvents: monthEvents.length,
    totalTodos: monthTodos.length,
    completionRate: taskCompletionRate,
    workRatio,
    personalRatio,
    weeks,
    hasData,
  };
}
