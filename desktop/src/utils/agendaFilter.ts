import type { CalendarEvent as Event } from '../types';
import { isAllDayEvent } from './calendarDateUtils';

export type AgendaPeriod = 'all' | 'today' | 'tomorrow' | 'week' | 'month' | 'past';
export type AgendaSource = 'all' | 'google' | 'local';
export type AgendaCategory =
  | 'all'
  | 'work'
  | 'study'
  | 'holiday'
  | 'personal'
  | 'finance'
  | 'health'
  | 'leisure';
export type AgendaFormat = 'all' | 'timed' | 'allday' | 'recurring';

export interface AgendaFilterState {
  query: string;
  period: AgendaPeriod;
  source: AgendaSource;
  category: AgendaCategory;
  format: AgendaFormat;
}

export const DEFAULT_AGENDA_FILTER: AgendaFilterState = {
  query: '',
  period: 'all',
  source: 'all',
  category: 'all',
  format: 'all',
};

export const AGENDA_PERIOD_OPTIONS: Array<{ id: AgendaPeriod; label: string }> = [
  { id: 'all', label: 'Tudo' },
  { id: 'today', label: 'Hoje' },
  { id: 'tomorrow', label: 'Amanhã' },
  { id: 'week', label: '7 dias' },
  { id: 'month', label: 'Este mês' },
  { id: 'past', label: 'Passados' },
];

export const AGENDA_SOURCE_OPTIONS: Array<{ id: AgendaSource; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'google', label: 'Google Calendar' },
  { id: 'local', label: 'Vito / Manual' },
];

export const AGENDA_CATEGORY_OPTIONS: Array<{ id: AgendaCategory; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'work', label: 'Trabalho / Reuniões' },
  { id: 'study', label: 'Estudo' },
  { id: 'holiday', label: 'Feriados' },
  { id: 'personal', label: 'Pessoal' },
  { id: 'finance', label: 'Finanças' },
  { id: 'health', label: 'Saúde' },
  { id: 'leisure', label: 'Lazer' },
];

export const AGENDA_FORMAT_OPTIONS: Array<{ id: AgendaFormat; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'timed', label: 'Com horário' },
  { id: 'allday', label: 'Dia inteiro' },
  { id: 'recurring', label: 'Recorrentes' },
];

export function countActiveAgendaFilters(filters: AgendaFilterState): number {
  let count = 0;
  if (filters.period !== 'all') count++;
  if (filters.source !== 'all') count++;
  if (filters.category !== 'all') count++;
  if (filters.format !== 'all') count++;
  return count;
}

export function matchesAgendaQuery(event: Event, query: string): boolean {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  const title = (event.title || '').toLowerCase();
  const desc = (event.description || '').toLowerCase();
  const loc = (event.location || '').toLowerCase();
  return title.includes(q) || desc.includes(q) || loc.includes(q);
}

export function matchesAgendaPeriod(event: Event, period: AgendaPeriod, now: Date = new Date()): boolean {
  if (period === 'all') return true;
  const ms = new Date(event.start_at).getTime();
  if (Number.isNaN(ms)) return false;

  const evDate = new Date(ms);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  if (period === 'today') {
    return (
      evDate.getFullYear() === now.getFullYear() &&
      evDate.getMonth() === now.getMonth() &&
      evDate.getDate() === now.getDate()
    );
  }

  if (period === 'tomorrow') {
    const tomorrow = new Date(startOfToday.getTime() + 24 * 3600 * 1000);
    return (
      evDate.getFullYear() === tomorrow.getFullYear() &&
      evDate.getMonth() === tomorrow.getMonth() &&
      evDate.getDate() === tomorrow.getDate()
    );
  }

  if (period === 'week') {
    const startMs = startOfToday.getTime();
    const endMs = startMs + 7 * 24 * 3600 * 1000;
    return ms >= startMs && ms < endMs;
  }

  if (period === 'month') {
    return (
      evDate.getFullYear() === now.getFullYear() &&
      evDate.getMonth() === now.getMonth()
    );
  }

  if (period === 'past') {
    const endMs = event.end_at ? new Date(event.end_at).getTime() : ms;
    return endMs < startOfToday.getTime();
  }

  return true;
}

export function inferEventCategory(event: Event): string {
  if (event.category) return event.category.toLowerCase();
  const text = `${event.title || ''} ${event.description || ''}`.toLowerCase();
  const isAllDay = isAllDayEvent(event);

  if (
    isAllDay &&
    (text.includes('feriado') ||
      text.includes('finados') ||
      text.includes('natal') ||
      text.includes('páscoa') ||
      text.includes('tiradentes') ||
      text.includes('república') ||
      text.includes('independência'))
  ) {
    return 'holiday';
  }
  if (
    text.includes('reunião') ||
    text.includes('meeting') ||
    text.includes('sync') ||
    text.includes('alinhamento') ||
    text.includes('planejamento') ||
    text.includes('call')
  ) {
    return 'work';
  }
  if (
    text.includes('aula') ||
    text.includes('estudo') ||
    text.includes('curso') ||
    text.includes('inglês') ||
    text.includes('prova')
  ) {
    return 'study';
  }
  if (
    text.includes('médic') ||
    text.includes('consulta') ||
    text.includes('dentista') ||
    text.includes('exame') ||
    text.includes('terapia')
  ) {
    return 'health';
  }
  if (
    text.includes('fatura') ||
    text.includes('pagamento') ||
    text.includes('banco') ||
    text.includes('investimento')
  ) {
    return 'finance';
  }
  if (
    text.includes('churras') ||
    text.includes('festa') ||
    text.includes('anivers') ||
    text.includes('viagem')
  ) {
    return 'leisure';
  }
  return 'personal';
}

export function matchesAgendaCategory(event: Event, category: AgendaCategory): boolean {
  if (category === 'all') return true;
  const inferred = inferEventCategory(event);
  if (category === 'work') {
    return inferred === 'work' || inferred === 'meeting';
  }
  return inferred === category;
}

export function matchesAgendaSource(event: Event, source: AgendaSource): boolean {
  if (source === 'all') return true;
  if (source === 'google') return event.source === 'google';
  if (source === 'local') return event.source !== 'google';
  return true;
}

export function matchesAgendaFormat(event: Event, format: AgendaFormat): boolean {
  if (format === 'all') return true;
  const isAllDay = isAllDayEvent(event);
  if (format === 'allday') return isAllDay;
  if (format === 'timed') return !isAllDay;
  if (format === 'recurring') return Boolean((event as any).is_recurring || (event as any).recurrence);
  return true;
}

export function filterAgendaEvents(
  events: Event[],
  filters: AgendaFilterState,
  now: Date = new Date()
): Event[] {
  return events.filter((ev) => {
    if (!matchesAgendaQuery(ev, filters.query)) return false;
    if (!matchesAgendaPeriod(ev, filters.period, now)) return false;
    if (!matchesAgendaSource(ev, filters.source)) return false;
    if (!matchesAgendaCategory(ev, filters.category)) return false;
    if (!matchesAgendaFormat(ev, filters.format)) return false;
    return true;
  });
}
