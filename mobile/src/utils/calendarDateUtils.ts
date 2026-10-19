import { Event } from '../types';

/**
 * Utilitários canônicos de datas para o Calendário Vito (padrão Noctalia / RFC 5545).
 * Resolve incompatibilidades com o motor Hermes no Android e divergências de fuso horário.
 */

export const parseSafeDate = (dStr?: string): Date => {
  if (!dStr) return new Date();
  let sanitized = dStr.includes(' ') && !dStr.includes('T') ? dStr.replace(' ', 'T') : dStr;
  
  // Trunca frações de segundos para 3 dígitos (milissegundos), evitando que o Hermes RN quebre com 9 dígitos do Go
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

/**
 * Dia/mês do badge para eventos de dia inteiro (P2): usa o dia civil em UTC,
 * imune ao fuso do aparelho. Cobre linhas legadas 00:00Z e novas 03:00Z.
 */
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

/** Feriados (qualquer origem) são somente-leitura (P3). */
export const isHolidayReadOnly = (event?: Partial<Event> | null): boolean => {
  return event?.category === 'holiday';
};

export const createDateKey = (year: number, month: number, day: number): string => {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
};

/**
 * Detecta se o evento é de dia inteiro (ex: 00:00 às 23:59 ou 12:00:00Z sem horário específico).
 */
export const isAllDayEvent = (event?: Partial<Event> | null): boolean => {
  if (!event || !event.start_at) return false;

  // 1. Categoria explícita de feriado
  if (event.category === 'holiday') return true;

  // 2. Se gravado explicitamente com 00:00:00 ou 03:00:00Z (início do dia civil em UTC ou BRT)
  if ((event.start_at.includes('00:00:00') || event.start_at.includes('03:00:00')) && (!event.end_at || event.end_at.includes('23:59:59') || event.end_at.includes('00:00:00'))) {
    return true;
  }

  const start = parseSafeDate(event.start_at);
  const end = event.end_at ? parseSafeDate(event.end_at) : start;
  const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

  // 3. Eventos com duração de 20h ou mais (cobre 24h, feriados, multi-dias e all-day 03:00Z..23:59Z)
  if (diffHours >= 20) return true;

  // 4. Reconhecimento contextual de feriados nacionais e religiosos (ex: Nossa Senhora Aparecida)
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
    // Se o evento é feriado e não é uma reunião com minutos específicos (ex: 14:30)
    const startHour = start.getHours();
    const startMin = start.getMinutes();
    // 00:00 UTC vira 21:00 no fuso de Brasília com 0 minutos
    if (diffHours >= 12 || (startMin === 0 && (startHour === 0 || startHour === 21))) {
      return true;
    }
  }

  return false;
};

export const isEventOnDate = (event: Event, targetDate: Date): boolean => {
  try {
    const targetStr = toLocalDateString(targetDate);

    // Eventos de dia inteiro / feriados (Floating Dates RFC 5545):
    // As datas representam dias civis reais (ex: 2026-10-12 a 2026-10-12).
    // Ancorados na data civil sem conversão que desloque para o dia anterior no fuso local.
    if (isAllDayEvent(event)) {
      const startUtcStr = event.start_at.substring(0, 10);
      const endUtcStr = event.end_at ? event.end_at.substring(0, 10) : startUtcStr;
      return targetStr >= startUtcStr && targetStr <= endUtcStr;
    }

    const start = parseSafeDate(event.start_at);
    const end = event.end_at ? parseSafeDate(event.end_at) : start;

    const startStr = toLocalDateString(start);
    let endStr = toLocalDateString(end);

    // Ajuste para término exclusivo à meia-noite (Google Calendar RFC 5545)
    if (endStr > startStr && end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0) {
      const adj = new Date(end.getTime() - 1000);
      endStr = toLocalDateString(adj);
    }

    return targetStr >= startStr && targetStr <= endStr;
  } catch {
    return false;
  }
};

/**
 * Retorna todos os dias civis (YYYY-MM-DD) abrangidos por um evento.
 */
export const getEventDays = (event: Event): string[] => {
  const days: string[] = [];
  try {
    // Eventos de dia inteiro / feriados (Floating Dates RFC 5545):
    // Utilizam diretamente as datas civis YYYY-MM-DD gravadas no evento.
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

    // Se termina exatamente à meia-noite do dia seguinte, não inclui o dia seguinte
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

/**
 * Formata o horário do evento (ex: "14:00 - 15:30" ou "Dia Inteiro").
 */
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

/**
 * Próximos eventos a partir de hoje em ordem cronológica (com agrupamento inteligente de séries recorrentes).
 * Filtra estritamente apenas compromissos futuros pertencentes ao mesmo mês da data de referência para evitar poluição visual.
 */
export const getUpcomingGroupedEvents = (events: Event[], referenceDate?: Date): Event[] => {
  const ref = referenceDate || new Date();
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  today.setHours(0, 0, 0, 0);

  // Fim do mês da data de referência (ex.: 31 de Outubro às 23:59:59.999)
  const endOfMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);

  const futureEvents = events
    .filter((ev) => {
      try {
        const start = parseSafeDate(ev.start_at);
        const end = ev.end_at ? parseSafeDate(ev.end_at) : start;
        // O evento não terminou ainda em relação a hoje e começa/termina no mesmo mês
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
    const isSeries = (titleCounts.get(key) || 0) > 1 || !!ev.recurrence;

    if (isSeries) {
      if (!seenSeries.has(key)) {
        seenSeries.add(key);
        grouped.push({
          ...ev,
          is_recurring: true,
        });
      }
    } else {
      grouped.push(ev);
    }
  }

  return grouped;
};
