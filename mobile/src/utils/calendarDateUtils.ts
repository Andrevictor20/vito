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

export const createDateKey = (year: number, month: number, day: number): string => {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
};

/**
 * Detecta se o evento é de dia inteiro (ex: 00:00 às 23:59 ou 12:00:00Z sem horário específico).
 */
export const isAllDayEvent = (event: Event): boolean => {
  if (!event.start_at) return false;
  const start = parseSafeDate(event.start_at);
  const end = event.end_at ? parseSafeDate(event.end_at) : start;
  const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

  // Eventos marcados como 24h ou sem horário de término significativo
  if (diffHours >= 23 && diffHours <= 25) return true;
  
  // Se gravado explicitamente como 00:00:00 UTC até 23:59:59 UTC
  if (event.start_at.includes('00:00:00') && event.end_at?.includes('23:59:59')) {
    return true;
  }

  return false;
};

/**
 * Determina com precisão de fuso horário se um evento ocorre em uma data civil específica.
 */
export const isEventOnDate = (event: Event, targetDate: Date): boolean => {
  try {
    const targetStr = toLocalDateString(targetDate);
    const start = parseSafeDate(event.start_at);
    const end = event.end_at ? parseSafeDate(event.end_at) : start;

    const startStr = toLocalDateString(start);
    let endStr = toLocalDateString(end);

    // Ajuste para término exclusivo à meia-noite (Google Calendar RFC 5545)
    if (endStr > startStr && end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0) {
      const adj = new Date(end.getTime() - 1000);
      endStr = toLocalDateString(adj);
    }

    // Se o evento é de dia inteiro, compara também a data UTC caso haja deslocamento de fuso
    if (isAllDayEvent(event)) {
      const startUtcStr = event.start_at.substring(0, 10);
      const endUtcStr = event.end_at ? event.end_at.substring(0, 10) : startUtcStr;
      if (targetStr >= startUtcStr && targetStr <= endUtcStr) {
        return true;
      }
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

    if (isAllDayEvent(event)) {
      const utcDay = event.start_at.substring(0, 10);
      if (!days.includes(utcDay)) {
        days.push(utcDay);
      }
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
