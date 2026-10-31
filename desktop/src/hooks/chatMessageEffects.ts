import type { ChatMessage } from '../types';

export const buildAssistantMessage = (
  idPrefix: string,
  res: any,
  defaultReply: string
): ChatMessage => ({
  id: `${idPrefix}-${Date.now()}`,
  sender: 'vito',
  text: res.reply || res.message || defaultReply,
  timestamp: new Date().toISOString(),
  event: res.event,
  todo: res.todo,
  trigger: res.trigger,
  booking: res.booking,
  meeting: res.meeting,
  whatsapp_message: res.whatsapp_message,
  gmail_message: res.gmail_message,
});

export const notifyAssistantResult = (res: any) => {
  if (typeof window === 'undefined') return;
  const event = new CustomEvent('vito:datasync', {
    detail: { action: res.action_performed, result: res },
  });
  window.dispatchEvent(event);
};

export const handleAssistantSideEffects = (
  res: any,
  onDataChanged?: () => void
) => {
  notifyAssistantResult(res);
  onDataChanged?.();
};
