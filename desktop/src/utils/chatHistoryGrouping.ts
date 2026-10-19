import type { ConversationSession } from '../types';

export interface ChatHistoryGroup {
  key: string;
  title: string;
  sessions: ConversationSession[];
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

export function formatShortDate(date: Date): string {
  return date
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .replace(/\./g, '')
    .replace(/\sde\s/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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

export function groupSessionsByDate(
  sessions: ConversationSession[],
  now: Date = new Date()
): ChatHistoryGroup[] {
  const groupsMap = new Map<string, { title: string; sessions: ConversationSession[] }>();

  // Ordena decrescente por timestamp
  const sorted = [...sessions].sort((a, b) => {
    const ta = new Date(a.timestamp || 0).getTime();
    const tb = new Date(b.timestamp || 0).getTime();
    return tb - ta;
  });

  for (const s of sorted) {
    const d = new Date(s.timestamp);
    let key: string;
    let title: string;

    if (Number.isNaN(d.getTime())) {
      key = 'recente';
      title = 'RECENTE';
    } else if (isSameDay(d, now)) {
      key = 'hoje';
      title = 'HOJE';
    } else if (isYesterday(d, now)) {
      key = 'ontem';
      title = 'ONTEM';
    } else {
      key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      title = formatShortDate(d).toUpperCase();
    }

    if (!groupsMap.has(key)) {
      groupsMap.set(key, { title, sessions: [] });
    }
    groupsMap.get(key)!.sessions.push(s);
  }

  return Array.from(groupsMap.entries()).map(([key, val]) => ({
    key,
    title: val.title,
    sessions: val.sessions,
  }));
}
