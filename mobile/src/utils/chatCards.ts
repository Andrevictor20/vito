import type { ChatBooking, ChatMeeting, AssistantChatResponse } from '../types';

// Helpers puros de formatação para os cards inline do chat (testáveis).

// Duração entre dois ISO datetimes: "45 min", "1h", "1h30", "2h05".
export const formatEventDuration = (startAt: string, endAt: string): string => {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return '';
  const mins = Math.round((end - start) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
};

// "Vence 20/10 14:00" ou "Sem prazo".
export const formatTodoDue = (dueDate?: string): string => {
  if (!dueDate) return 'Sem prazo';
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return 'Sem prazo';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `Vence ${day}/${month} ${hh}:${mm}`;
};

// "20/10" ou "Sem data" (para scheduled_date YYYY-MM-DD ou ISO).
export const formatScheduledDate = (scheduledDate?: string): string => {
  if (!scheduledDate) return 'Sem data';
  const m = scheduledDate.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}`;
  const d = new Date(scheduledDate);
  if (Number.isNaN(d.getTime())) return 'Sem data';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// "[1,2,3,4,5,6,7]" -> "todos os dias" | "dias úteis" | "fim de semana".
export const formatBookingDays = (daysOfWeek?: string): string => {
  if (!daysOfWeek) return 'todos os dias';
  const nums = daysOfWeek.match(/\d/g)?.map(Number) ?? [];
  if (nums.length === 0) return 'todos os dias';
  const set = new Set(nums);
  const all = [1, 2, 3, 4, 5, 6, 7].every((d) => set.has(d));
  if (all) return 'todos os dias';
  const weekdays = [1, 2, 3, 4, 5].every((d) => set.has(d)) && !set.has(6) && !set.has(7);
  if (weekdays) return 'dias úteis';
  const weekend = set.has(6) && set.has(7) && ![1, 2, 3, 4, 5].some((d) => set.has(d));
  if (weekend) return 'fim de semana';
  const names = ['', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
  return [...set].sort().map((d) => names[d] ?? d).join(' · ');
};

// "30 min · 09:00–18:00 · todos os dias".
export const formatBookingWindow = (booking: ChatBooking): string => {
  const parts: string[] = [];
  if (booking.duration_minutes) parts.push(`${booking.duration_minutes} min`);
  if (booking.start_hour && booking.end_hour) {
    parts.push(`${booking.start_hour}–${booking.end_hour}`);
  }
  parts.push(formatBookingDays(booking.days_of_week));
  return parts.join(' · ');
};

// Link preferencial para exibir/copiar: short primeiro.
export const bookingDisplayLink = (booking: ChatBooking): string =>
  booking.short_url || booking.public_url || '';

// Frequência do radar em PT-BR: "Diário de manhã · 08:30".
export const formatTriggerSchedule = (frequency?: string, scheduledTime?: string): string => {
  const freqMap: Record<string, string> = {
    daily_morning: 'Diário de manhã',
    daily_evening: 'Diário à noite',
    hourly: 'De hora em hora',
    immediate: 'Imediato',
  };
  const freq = (frequency && freqMap[frequency]) || 'Diário de manhã';
  if (scheduledTime) return `${freq} · ${scheduledTime}`;
  return freq;
};
export const formatRecurrenceLabel = (recurrence?: string): string | null => {
  switch ((recurrence || '').toUpperCase()) {
    case 'DAILY':
      return 'Repete diariamente';
    case 'WEEKLY':
      return 'Repete semanalmente';
    case 'MONTHLY':
      return 'Repete mensalmente';
    default:
      return null;
  }
};

export const formatMeetingMode = (mode?: string): string => {
  if (mode === 'group_consensus') return 'Enquete em Grupo (Consenso)';
  if (mode === 'one_on_one') return 'Reunião 1-on-1';
  return 'Reunião';
};

export const meetingDisplayLink = (meeting: ChatMeeting): string =>
  meeting.short_url || meeting.public_url || '';

export const toChatMeeting = (res: AssistantChatResponse): ChatMeeting | undefined => {
  if (!res.meeting) return undefined;
  const m = res.meeting;
  const slotsCount = Array.isArray((m as any).slots) ? (m as any).slots.length : undefined;

  return {
    id: m.id,
    title: m.title,
    description: m.description,
    duration_minutes: m.duration_minutes,
    mode: m.mode,
    status: m.status,
    short_url: (m as any).short_url || res.meeting_short_url || undefined,
    public_url: (m as any).public_url || res.meeting_url || undefined,
    whatsapp_url: res.meeting_whatsapp_url || undefined,
    slots_count: slotsCount,
  };
};
