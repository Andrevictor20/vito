import type { AssistantChatResponse, ChatMessage } from '../types';
import type { ChatHistoryItem } from '../services/api/types';
import { formatModelDisplayName } from '../services/ai/aiProviderCatalog';
import {
  toChatMeeting,
  toChatBooking,
  toChatWhatsAppMessage,
  toChatGmailMessage,
} from './chatCards';

export function formatHistoryForStream(historySource: ChatMessage[]): ChatHistoryItem[] {
  return historySource.slice(-12).map((m) => ({
    role: m.sender === 'user' ? 'user' : 'assistant',
    content: m.text,
  }));
}

export function formatToolCallStepLabel(tc: {
  tool?: string;
  operation?: string;
  status?: string;
}): string {
  if (tc.status === 'AWAITING_USER_CONFIRMATION') {
    return 'Aguardando sua confirmação';
  }
  const opMap: Record<string, string> = {
    create_todo: 'Criando tarefa',
    list_todos: 'Consultando tarefas',
    complete_todo: 'Concluindo tarefa',
    delete_todo: 'Excluindo tarefa',
    create_event: 'Agendando compromisso',
    list_events: 'Consultando agenda',
    delete_event: 'Removendo compromisso',
    create_booking_link: 'Criando link de agendamento',
    list_booking_types: 'Consultando links de agendamento',
    create_bot: 'Criando bot',
    create_trigger: 'Criando bot',
    list_bots: 'Consultando bots',
    send_message: 'Preparando mensagem de WhatsApp',
    send_email: 'Preparando e-mail',
    search_messages: 'Pesquisando conversas',
    search_emails: 'Pesquisando e-mails',
    search: 'Pesquisando na web',
    get_summary: 'Analisando finanças',
  };
  if (tc.operation && opMap[tc.operation]) {
    return opMap[tc.operation];
  }
  return tc.operation || tc.tool || '';
}

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
    requires_confirmation: res.requires_confirmation,
    pending_confirmation_id: res.pending_confirmation_id,
    cards: res.cards,
    confirmationStatus: res.requires_confirmation ? 'pending' : undefined,
    pending_confirmation: res.pending_confirmation,
    modelUsed,
    byokWarning,
  };
};
