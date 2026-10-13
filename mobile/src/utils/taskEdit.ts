import type { Todo, PendingItem } from '../types';
import type { RepeatOption } from '../components/pending/ReminderSheet';
import { splitReminderISO } from './reminderInput';

/** Estado inicial do sheet de edição a partir do item salvo. */
export interface EditFormState {
  kind: 'todo' | 'pending';
  title: string;
  /** YYYY-MM-DD (parte data do due_date ou scheduled_date). */
  dateISO: string | null;
  /** HH:MM do lembrete, ou '09:00' quando não há. */
  time: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  useReminder: boolean;
  repeat: RepeatOption;
  advance: number;
}

/** Mapeia tarefa/pendência salva para o formulário de edição. */
export function getEditInitialState(item: Todo | PendingItem, kind: 'todo' | 'pending'): EditFormState {
  const remind = splitReminderISO(item.remind_at);
  const isTodo = kind === 'todo';
  const todo = item as Todo;
  const pending = item as PendingItem;
  const dateISO = isTodo
    ? (todo.due_date ? todo.due_date.split('T')[0] : null)
    : (pending.scheduled_date || null);
  return {
    kind,
    title: item.title || '',
    dateISO,
    time: item.remind_at ? remind.time : '09:00',
    priority: (isTodo && (todo.priority === 'low' || todo.priority === 'high')) ? todo.priority : 'medium',
    category: !isTodo ? pending.category || 'geral' : 'geral',
    useReminder: !!item.remind_at,
    repeat: item.remind_repeat || 'none',
    advance: item.remind_advance_minutes || 0,
  };
}
