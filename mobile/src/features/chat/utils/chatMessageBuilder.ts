import type { AssistantChatResponse, ChatMessage } from '../../../types';
import type { ChatHistoryItem } from '../../../services/api/types';
import { formatModelDisplayName } from '../../../services/ai/aiProviderCatalog';
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
    transfer_to_agent: 'Acionando especialista',
    create_todo: 'Criando tarefa',
    todo_create_todo: 'Criando tarefa',
    list_todos: 'Consultando tarefas',
    todo_list_todos: 'Consultando tarefas',
    complete_todo: 'Concluindo tarefa',
    todo_complete_todo: 'Concluindo tarefa',
    delete_todo: 'Excluindo tarefa',
    todo_delete_todo: 'Excluindo tarefa',
    create_event: 'Agendando compromisso',
    calendar_create_event: 'Agendando compromisso',
    list_events: 'Consultando agenda',
    calendar_list_events: 'Consultando agenda',
    delete_event: 'Removendo compromisso',
    calendar_delete_event: 'Removendo compromisso',
    create_booking_link: 'Criando link de agendamento',
    booking_create_link: 'Criando link de agendamento',
    list_booking_types: 'Consultando links de agendamento',
    booking_list_types: 'Consultando links de agendamento',
    create_bot: 'Criando bot',
    bot_create_bot: 'Criando bot',
    create_trigger: 'Criando bot',
    list_bots: 'Consultando bots',
    bot_list_bots: 'Consultando bots',
    delete_bot: 'Removendo bot',
    bot_delete_bot: 'Removendo bot',
    send_message: 'Preparando mensagem de WhatsApp',
    whatsapp_send_message: 'Preparando mensagem de WhatsApp',
    send_email: 'Preparando e-mail',
    gmail_send_email: 'Preparando e-mail',
    create_draft: 'Criando rascunho de e-mail',
    gmail_create_draft: 'Criando rascunho de e-mail',
    search_messages: 'Pesquisando conversas',
    whatsapp_search_messages: 'Pesquisando conversas',
    recent_chats: 'Consultando conversas recentes',
    whatsapp_recent_chats: 'Consultando conversas recentes',
    search_emails: 'Pesquisando e-mails',
    gmail_search_emails: 'Pesquisando e-mails',
    search: 'Pesquisando na web',
    web_search: 'Pesquisando na web',
    read_page: 'Lendo página da web',
    web_read_page: 'Lendo página da web',
    search_memories: 'Consultando memórias',
    memory_search: 'Consultando memórias',
    get_profile: 'Consultando perfil',
    memory_get_profile: 'Consultando perfil',
    update_profile: 'Atualizando preferências',
    memory_update_profile: 'Atualizando preferências',
    get_summary: 'Analisando finanças',
    finance_get_summary: 'Analisando finanças',
    list_transactions: 'Consultando transações',
    finance_list_transactions: 'Consultando transações',
    get_budgets: 'Consultando orçamentos',
    finance_get_budgets: 'Consultando orçamentos',
    get_cards: 'Consultando cartões',
    finance_get_cards: 'Consultando cartões',
    get_spending_by_category: 'Analisando gastos por categoria',
    finance_get_spending_by_category: 'Analisando gastos por categoria',
    detect_subscriptions_and_recurring: 'Verificando assinaturas',
    finance_detect_subscriptions: 'Verificando assinaturas',
    simulate_savings_plan: 'Simulando plano de economia',
    finance_simulate_savings_plan: 'Simulando plano de economia',
    get_spending_limits_status: 'Verificando limites de gastos',
    finance_get_limits_status: 'Verificando limites de gastos',
    upsert_spending_limit: 'Configurando limite de gastos',
    finance_upsert_spending_limit: 'Configurando limite de gastos',
  };
  if (tc.operation && opMap[tc.operation]) {
    return opMap[tc.operation];
  }
  if (tc.tool && opMap[tc.tool]) {
    return opMap[tc.tool];
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
    res.fallback_notice ||
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
