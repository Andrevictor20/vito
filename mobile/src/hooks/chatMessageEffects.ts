import type { AssistantChatResponse, ChatMessage } from '../types';
import { notificationService } from '../services/notificationService';
import { dataSync } from '../services/dataSync';
import { toChatMeeting, toChatBooking } from '../utils/chatCards';

export const buildAssistantMessage = (
  idPrefix: string,
  res: AssistantChatResponse,
  defaultReply: string
): ChatMessage => ({
  id: `${idPrefix}-${Date.now()}`,
  sender: 'vito',
  text: res.reply || res.message || defaultReply,
  timestamp: new Date().toISOString(),
  action_performed: res.action_performed,
  event: res.event,
  todo: res.todo,
  trigger: res.trigger,
  pending: res.pending,
  booking: toChatBooking(res),
  meeting: toChatMeeting(res),
  conflict: res.conflict,
  pending_confirmation: res.pending_confirmation,
});

export const notifyAssistantResult = (res: AssistantChatResponse) => {
  const action = res.action_performed?.toLowerCase() || '';
  if (res.event || action.includes('event')) {
    dataSync.notify('refresh_events');
  }
  if (res.todo || action.includes('todo')) {
    dataSync.notify('refresh_todos');
  }
  if (res.trigger || action.includes('trigger')) {
    dataSync.notify('refresh_triggers');
  }
  if (res.booking || action.includes('booking')) {
    dataSync.notify('refresh_bookings');
  }
  if (res.pending || action.includes('pending')) {
    dataSync.notify('refresh_pending');
  }
  dataSync.notify('refresh_all');
};

export const handleAssistantSideEffects = (
  res: AssistantChatResponse,
  onDataChanged?: () => void
) => {
  if (res.event) {
    notificationService.scheduleEventDualReminders(res.event).catch(() => {});
  }
  if (res.todo) {
    notificationService.scheduleTodoReminder(res.todo).catch(() => {});
  }
  if (res.pending) {
    notificationService.schedulePendingReminder(res.pending).catch(() => {});
    dataSync.notify('refresh_pending');
  }
  if (res.action_performed === 'delete_event' && res.event?.id) {
    notificationService.cancelEventReminder(res.event.id).catch(() => {});
  }
  if (res.action_performed === 'delete_todo' && res.todo?.id) {
    notificationService.cancelTodoReminder(res.todo.id).catch(() => {});
  }
  notifyAssistantResult(res);
  onDataChanged?.();
};
