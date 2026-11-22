import type { AssistantChatResponse, ChatMessage } from '../types';
import { formatModelDisplayName } from '../services/ai/aiProviderCatalog';
import {
  toChatMeeting,
  toChatBooking,
  toChatWhatsAppMessage,
  toChatGmailMessage,
} from './chatCards';

export const buildAssistantMessage = (
  idPrefix: string,
  res: AssistantChatResponse,
  defaultReply: string
): ChatMessage => {
  const rawModel = res.model_used || res.telemetry?.model_used || '';
  const modelUsed = rawModel ? formatModelDisplayName(rawModel) : undefined;
  const fallbackReason = res.telemetry?.fallback_reason || '';
  const byokWarning =
    res.byok_warning ||
    (fallbackReason.startsWith('byok_401') || fallbackReason.startsWith('byok_403')
      ? 'Sua chave própria foi recusada. Usei o servidor nesta resposta.'
      : undefined);

  return {
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
    whatsapp_message: toChatWhatsAppMessage(res),
    gmail_message: toChatGmailMessage(res),
    conflict: res.conflict,
    pending_confirmation: res.pending_confirmation,
    modelUsed,
    byokWarning,
  };
};
