import type { AssistantChatResponse } from '../../../types';
import { dataSync } from '../../../services/dataSync';
import { buildAssistantMessage } from '../utils/chatMessageBuilder';

export { buildAssistantMessage };

export const notifyAssistantResult = (res: AssistantChatResponse) => {
  const action = res.action_performed?.toLowerCase() || '';
  if (res.event || action.includes('event')) {
    dataSync.notify('refresh_events');
  }
  if (res.todo || action.includes('todo')) {
    dataSync.notify('refresh_todos');
  }
  if (res.trigger || action.includes('trigger') || action.includes('bot') || res.cards?.some((c) => c.type === 'bot')) {
    dataSync.notify('refresh_triggers');
    dataSync.notify('refresh_bots');
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
  if (res.pending) {
    dataSync.notify('refresh_pending');
  }
  notifyAssistantResult(res);
  onDataChanged?.();
};
