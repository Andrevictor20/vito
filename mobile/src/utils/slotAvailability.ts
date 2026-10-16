import { Event } from '../types';

export interface ProposedSlot {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMinutes: number;
}

export interface SlotAvailabilityResult {
  available: boolean;
  conflictingEvent?: Event;
}

/**
 * Converte data e hora para timestamp milissegundos em UTC para comparação precisa.
 */
function toSlotTimestamp(date: string, time: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return Date.UTC(year, month - 1, day, hour, minute, 0);
}

function toEventTimestamp(isoStr: string): number {
  const d = new Date(isoStr);
  return d.getTime();
}

/**
 * Verifica se o horário proposto tem conflito com eventos do calendário.
 */
export function checkSlotAvailability(
  slot: ProposedSlot,
  events: Event[]
): SlotAvailabilityResult {
  if (!events || events.length === 0) {
    return { available: true };
  }

  const slotStart = toSlotTimestamp(slot.date, slot.time);
  const slotEnd = slotStart + slot.durationMinutes * 60000;

  for (const ev of events) {
    if (!ev.start_at || !ev.end_at) continue;
    const evStart = toEventTimestamp(ev.start_at);
    const evEnd = toEventTimestamp(ev.end_at);

    // Conflito ocorre se houver sobreposição nos intervalos:
    // slotStart < evEnd && slotEnd > evStart
    if (slotStart < evEnd && slotEnd > evStart) {
      return {
        available: false,
        conflictingEvent: ev,
      };
    }
  }

  return { available: true };
}

/**
 * Formata mensagem amigável de aviso de conflito para o usuário.
 */
export function formatSlotConflictMessage(conflictingEvent: Event): string {
  const title = conflictingEvent.title || 'Compromisso';
  let timeStr = '';
  try {
    const start = new Date(conflictingEvent.start_at);
    const end = new Date(conflictingEvent.end_at);
    const startH = String(start.getUTCHours()).padStart(2, '0');
    const startM = String(start.getUTCMinutes()).padStart(2, '0');
    const endH = String(end.getUTCHours()).padStart(2, '0');
    const endM = String(end.getUTCMinutes()).padStart(2, '0');
    timeStr = ` (${startH}:${startM} às ${endH}:${endM})`;
  } catch {
    timeStr = '';
  }

  return `Ocupado: Conflito com "${title}"${timeStr}`;
}
