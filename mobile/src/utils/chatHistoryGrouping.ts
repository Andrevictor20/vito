import type { ConversationSession } from '../types';

export interface ChatHistoryGroup {
  /** Chave estável do grupo (para `key`). Ex: 'hoje' | 'ontem' | '2026-10-10'. */
  key: string;
  /** Rótulo de seção. Ex: 'Hoje' | 'Ontem' | '11 out'. */
  title: string;
  sessions: ConversationSession[];
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isYesterday(date: Date, now: Date): boolean {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return isSameDay(date, yesterday);
}

/**
 * Data curta pt-BR no formato `11 out` (timezone do device).
 * `toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })` devolve
 * "11 de out." — removemos ponto e o "de" para chegar a "11 out".
 */
export function formatShortDate(date: Date): string {
  return date
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .replace(/\./g, '')
    .replace(/\sde\s/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function timeOf(ts: Date): number {
  const t = ts.getTime();
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

/**
 * Timestamp da linha: `Hoje, 18:10` / `Ontem` / `11 out`.
 * Timezone do device, pt-BR. Entrada inválida → 'Recente'.
 */
export function formatGroupTimestamp(ts: string, now: Date = new Date()): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return 'Recente';
  if (isSameDay(d, now)) {
    const hhmm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `Hoje, ${hhmm}`;
  }
  if (isYesterday(d, now)) return 'Ontem';
  return formatShortDate(d);
}

/**
 * Agrupa sessões por HOJE / ONTEM / data curta (`11 out`).
 * Grupos ordenados por recência (timestamp máx desc) e itens por timestamp desc.
 * Sessões com timestamp inválido vão para o fim, no grupo da data mais antiga válida
 * (ou em grupo próprio 'Recente' se nenhuma data válida existir).
 */
export function groupSessionsByDate(
  sessions: ConversationSession[],
  now: Date = new Date(),
): ChatHistoryGroup[] {
  const todayStart = startOfDay(now).getTime();
  const groups = new Map<string, ChatHistoryGroup>();

  const sorted = [...sessions].sort((a, b) => timeOf(new Date(b.timestamp)) - timeOf(new Date(a.timestamp)));

  for (const s of sorted) {
    const d = new Date(s.timestamp);
    let key: string;
    let title: string;
    if (Number.isNaN(d.getTime())) {
      key = 'sem-data';
      title = 'Recente';
    } else if (isSameDay(d, now)) {
      key = `hoje-${todayStart}`;
      title = 'Hoje';
    } else if (isYesterday(d, now)) {
      key = 'ontem';
      title = 'Ontem';
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      title = formatShortDate(d);
    }
    const g = groups.get(key);
    if (g) g.sessions.push(s);
    else groups.set(key, { key, title, sessions: [s] });
  }

  // Grupos já nascem na ordem de recência porque iteramos `sorted` desc;
  // reforça ordenando pelo timestamp máx de cada grupo (inválidos por último).
  return [...groups.values()].sort((a, b) => {
    const maxA = Math.max(...a.sessions.map((s) => timeOf(new Date(s.timestamp))));
    const maxB = Math.max(...b.sessions.map((s) => timeOf(new Date(s.timestamp))));
    return maxB - maxA;
  });
}
