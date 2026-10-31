import type { CalendarEvent as Event } from '../types';

export type { Event };

export const parseSafeDate = (dStr?: string): Date => {
  if (!dStr) return new Date();
  let sanitized = dStr.includes(' ') && !dStr.includes('T') ? dStr.replace(' ', 'T') : dStr;
  sanitized = sanitized.replace(/(\.\d+)/, (match) => match.substring(0, 4));
  const d = new Date(sanitized);
  return isNaN(d.getTime()) ? new Date() : d;
};

export const toLocalDateString = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const MESES_PT_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export const badgeDayMonthUTC = (iso: string, allDay: boolean): { day: string; month: string } => {
  const d = parseSafeDate(iso);
  if (!allDay) {
    return {
      day: String(d.getDate()).padStart(2, '0'),
      month: MESES_PT_CURTO[d.getMonth()],
    };
  }
  return {
    day: String(d.getUTCDate()).padStart(2, '0'),
    month: MESES_PT_CURTO[d.getUTCMonth()],
  };
};

export const isHolidayReadOnly = (event?: Partial<Event> | null): boolean => {
  return event?.category === 'holiday';
};

export const createDateKey = (year: number, month: number, day: number): string => {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
};

export const isAllDayEvent = (event?: Partial<Event> | null): boolean => {
  if (!event || !event.start_at) return false;
  if (event.all_day) return true;
  if (event.category === 'holiday') return true;

  if (
    (event.start_at.includes('00:00:00') || event.start_at.includes('03:00:00')) &&
    (!event.end_at || event.end_at.includes('23:59:59') || event.end_at.includes('00:00:00'))
  ) {
    return true;
  }

  const start = parseSafeDate(event.start_at);
  const end = event.end_at ? parseSafeDate(event.end_at) : start;
  const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

  if (diffHours >= 20) return true;

  const title = (event.title || '').toLowerCase().trim();
  const holidayPatterns = [
    /\bferiado\b/i,
    /\bnossa senhora( aparecida)?\b/i,
    /\bdia das crian[cç]as\b/i,
    /\bano novo\b/i,
    /\bcarnaval\b/i,
    /\bquarta-feira de cinzas\b/i,
    /\bsexta-feira santa\b/i,
    /\bp[aá]scoa\b/i,
    /\btiradentes\b/i,
    /\bdia do trabalh(o|ador)\b/i,
    /\bcorpus christi\b/i,
    /\bindepend[eê]ncia( do brasil)?\b/i,
    /\bfinados\b/i,
    /\bproclama[cç][aã]o da rep[uú]blica\b/i,
    /\bconsci[eê]ncia negra\b/i,
    /\bnatal\b/i,
    /\bv[eé]spera de natal\b/i,
    /\bv[eé]spera de ano novo\b/i,
  ];

  if (holidayPatterns.some((pattern) => pattern.test(title))) {
    const startHour = start.getHours();
    const startMin = start.getMinutes();
    if (diffHours >= 12 || (startMin === 0 && (startHour === 0 || startHour === 21))) {
      return true;
    }
  }

  return false;
};

export const isEventOnDate = (event: Event, targetDate: Date): boolean => {
  try {
    const targetStr = toLocalDateString(targetDate);

    if (isAllDayEvent(event)) {
      const startUtcStr = event.start_at.substring(0, 10);
      const endUtcStr = event.end_at ? event.end_at.substring(0, 10) : startUtcStr;
      return targetStr >= startUtcStr && targetStr <= endUtcStr;
    }

    const start = parseSafeDate(event.start_at);
    const end = event.end_at ? parseSafeDate(event.end_at) : start;

    const startStr = toLocalDateString(start);
    let endStr = toLocalDateString(end);

    if (endStr > startStr && end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0) {
      const adj = new Date(end.getTime() - 1000);
      endStr = toLocalDateString(adj);
    }

    return targetStr >= startStr && targetStr <= endStr;
  } catch {
    return false;
  }
};

export const getEventDays = (event: Event): string[] => {
  const days: string[] = [];
  try {
    if (isAllDayEvent(event)) {
      const startUtcStr = event.start_at.substring(0, 10);
      const endUtcStr = event.end_at ? event.end_at.substring(0, 10) : startUtcStr;
      
      const [sy, sm, sd] = startUtcStr.split('-').map(Number);
      const [ey, em, ed] = endUtcStr.split('-').map(Number);
      
      const cur = new Date(sy, sm - 1, sd);
      const last = new Date(ey, em - 1, ed);

      while (cur <= last) {
        days.push(toLocalDateString(cur));
        cur.setDate(cur.getDate() + 1);
      }
      return days;
    }

    const start = parseSafeDate(event.start_at);
    const end = event.end_at ? parseSafeDate(event.end_at) : start;
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    if (last > cur && end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0) {
      last.setDate(last.getDate() - 1);
    }

    while (cur <= last) {
      days.push(toLocalDateString(cur));
      cur.setDate(cur.getDate() + 1);
    }
  } catch {}
  return days;
};

export const formatEventTimeRange = (event: Event): string => {
  if (isAllDayEvent(event)) {
    return 'Dia Inteiro';
  }

  const start = parseSafeDate(event.start_at);
  const startTime = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (!event.end_at) {
    return startTime;
  }

  const end = parseSafeDate(event.end_at);
  const endTime = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return `${startTime} - ${endTime}`;
};

export const getUpcomingGroupedEvents = (events: Event[], referenceDate?: Date): Event[] => {
  const ref = referenceDate || new Date();
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  today.setHours(0, 0, 0, 0);

  const endOfMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);

  const futureEvents = events
    .filter((ev) => {
      try {
        const start = parseSafeDate(ev.start_at);
        const end = ev.end_at ? parseSafeDate(ev.end_at) : start;
        return end.getTime() >= today.getTime() && start.getTime() <= endOfMonth.getTime();
      } catch {
        return false;
      }
    })
    .sort((a, b) => {
      const tA = parseSafeDate(a.start_at).getTime();
      const tB = parseSafeDate(b.start_at).getTime();
      return tA - tB;
    });

  const titleCounts = new Map<string, number>();
  for (const ev of futureEvents) {
    const key = ev.title.trim().toLowerCase();
    titleCounts.set(key, (titleCounts.get(key) || 0) + 1);
  }

  const seenSeries = new Set<string>();
  const grouped: Event[] = [];

  for (const ev of futureEvents) {
    const key = ev.title.trim().toLowerCase();
    const isSeries = (titleCounts.get(key) || 0) > 1 || Boolean((ev as any).recurrence);

    if (isSeries) {
      if (!seenSeries.has(key)) {
        seenSeries.add(key);
        grouped.push({
          ...ev,
          is_recurring: true,
        } as Event);
      }
    } else {
      grouped.push(ev);
    }
  }

  return grouped;
};
