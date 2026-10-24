package ai

// buildBookingSchemaBlock gera o bloco JSON de schema com suporte a todas as ações e CRUDs do Vito.
func buildBookingSchemaBlock(timezone string) string {
	return `{
  "thought": "1. Verificar fuso/data atual; 2. Checar memórias relevantes; 3. Verificar conflitos; 4. Definir ação",
  "context_used": ["[categoria] trecho usado"],
  "action": "CREATE_EVENT" | "UPDATE_EVENT" | "DELETE_EVENT" | "CREATE_TODO" | "UPDATE_TODO" | "COMPLETE_TODO" | "DELETE_TODO" | "CREATE_PENDING_ITEM" | "CONVERT_PENDING_TO_EVENT" | "QUERY_SCHEDULE" | "QUERY_TODOS" | "CREATE_TRIGGER" | "UPDATE_TRIGGER" | "DELETE_TRIGGER" | "QUERY_TRIGGERS" | "CREATE_BOOKING_LINK" | "UPDATE_BOOKING" | "DELETE_BOOKING" | "LIST_BOOKINGS" | "CANCEL_BOOKING_APPOINTMENT" | "CREATE_MEETING" | "UPDATE_MEETING" | "DELETE_MEETING" | "LIST_MEETINGS" | "UPDATE_PROFILE" | "SAVE_MEMORY" | "QUERY_MEMORY" | "UPDATE_MEMORY" | "DELETE_MEMORY" | "QUERY_CONVERSATION" | "SEARCH_CONVERSATIONS" | "LIST_PENDING_CONVERSATIONS" | "DRAFT_REPLY" | "SEND_WHATSAPP_MESSAGE" | "CREATE_REPLY_REMINDER" | "DRAFT_EMAIL" | "SEND_EMAIL" | "REFINE_MESSAGE" | "NEEDS_CLARIFICATION" | "GENERAL_CHAT",
  "event": {
    "title": "Título conciso do evento",
    "description": "Detalhes mencionados se houver",
    "location": "Local se houver",
    "start_at": "YYYY-MM-DDTHH:MM:SS" (hora LOCAL, SEM offset/Z; fuso ` + timezone + ` pelo sistema; "" se n/a),
    "end_at": "YYYY-MM-DDTHH:MM:SS" (hora LOCAL, SEM offset/Z; fuso ` + timezone + `; "" se n/a),
    "recurrence": "WEEKLY" | "DAILY" | "MONTHLY" (ou vazio),
    "recurrence_until": "YYYY-MM-DD" (fim inclusivo; "" sem data final),
    "target_query": "ID exato [ID: ...] (preferencial) ou título para localizar o evento ao editar/excluir"
  },
  "todo": {
    "title": "Descrição da tarefa",
    "priority": "low" | "medium" | "high",
    "due_date": "YYYY-MM-DDTHH:MM:SS" (hora LOCAL; fuso ` + timezone + `) ou null,
    "remind_at": "YYYY-MM-DDTHH:MM:SS" (hora LOCAL se pedir lembrete) ou null,
    "remind_repeat": "none" | "daily" | "weekly",
    "remind_advance_minutes": número (aviso prévio em minutos),
    "target_query": "ID exato [ID: ...] ou título ao concluir/excluir tarefa"
  },
  "todo_update": {
    "target_query": "ID exato [ID: ...] ou título da tarefa a alterar",
    "title": "Novo título se for alterado (opcional)",
    "priority": "low" | "medium" | "high" (opcional),
    "due_date": "YYYY-MM-DDTHH:MM:SS" (nova data/hora local; opcional),
    "remind_at": "YYYY-MM-DDTHH:MM:SS" (novo lembrete se solicitado; opcional),
    "remind_repeat": "none" | "daily" | "weekly" (opcional),
    "remind_advance_minutes": número (opcional)
  },
  "trigger": {
    "title": "Título do disparador",
    "category": "finance" | "taxes_docs" | "real_estate" | "automotive" | "career" | "news" | "tech" | "travel" | "shopping" | "events_sports" | "entertainment" | "weather" | "custom",
    "query": "Instrução de monitoramento",
    "target_value": "Alvo/limite se aplicável",
    "condition_type": "daily_brief" | "price_above" | "price_below" | "event_upcoming" | "change_detected",
    "frequency": "daily_morning" | "hourly" | "daily_evening" | "immediate",
    "scheduled_time": "HH:MM" (hora local exata se pedida; senão ""),
    "days_of_week": "DAILY" | "MON-FRI" | "SAT,SUN" (ou vazio)
  },
  "trigger_update": {
    "target_query": "ID exato [ID: ...] ou título do radar/vigília",
    "title": "Novo título (opcional)",
    "scheduled_time": "HH:MM (nova hora diária da checagem, ex: 07:30)",
    "frequency": "daily_morning | daily_evening | hourly | immediate (opcional)",
    "is_active": true | false (true = retoma/ativa, false = pausa vigília),
    "target_value": "Novo valor alvo se aplicável"
  },
  "trigger_delete": {
    "target_query": "ID exato [ID: ...] ou título da vigília a excluir"
  },
  "pending": {
    "title": "Título da pendência",
    "description": "Detalhes se houver",
    "category": "geral" | "trabalho" | "estudos" | "financas" | "saude" | "pessoal",
    "scheduled_date": "YYYY-MM-DD" (data futura ou vazio),
    "remind_at": "YYYY-MM-DDTHH:MM:SS" (hora LOCAL se pedir lembrete) ou null,
    "remind_repeat": "none" | "daily" | "weekly",
    "remind_advance_minutes": número
  },
  "booking": {
    "title": "Título do tipo de reunião",
    "slug": "slug customizado ou vazio",
    "description": "Descrição do encontro",
    "duration_minutes": 15 | 30 | 45 | 60,
    "buffer_minutes": 0 | 10 | 15,
    "start_hour": "09:00",
    "end_hour": "18:00",
    "days_of_week": "[1,2,3,4,5,6,7]",
    "valid_until": "YYYY-MM-DD",
    "target_query": "Nome, slug ou ID para cancelar"
  },
  "booking_query": {
    "target_query": "Nome, slug ou ID para filtrar bookings (opcional)",
    "status": "active | paused | all"
  },
  "booking_update": {
    "target_query": "Nome, slug ou ID do booking para atualizar",
    "title": "Novo título (opcional)",
    "description": "Nova descrição (opcional)",
    "duration_minutes": 15 | 30 | 45 | 60 (opcional),
    "buffer_minutes": 0 | 10 | 15 (opcional),
    "start_hour": "09:00 (opcional)",
    "end_hour": "18:00 (opcional)",
    "days_of_week": "[1,2,3,4,5,6,7] (opcional)",
    "is_active": true | false (opcional),
    "valid_until": "YYYY-MM-DD (opcional)"
  },
  "booking_delete": {
    "target_query": "Nome, slug ou ID do link de agendamento a excluir"
  },
  "meeting": {
    "title": "Título da reunião (ex: Alinhamento de Projeto)",
    "description": "Pauta ou detalhes da reunião",
    "duration_minutes": 30 | 45 | 60 (padrão 45),
    "mode": "group_consensus" | "one_on_one",
    "slots": [
      {
        "start_at": "YYYY-MM-DDTHH:MM:SS",
        "end_at": "YYYY-MM-DDTHH:MM:SS"
      }
    ]
  },
  "meeting_query": {
    "target_query": "Nome ou ID da reunião (opcional)",
    "status": "open | confirmed | expired | cancelled | all"
  },
  "meeting_update": {
    "target_query": "Nome ou ID da reunião para atualizar",
    "title": "Novo título (opcional)",
    "description": "Nova descrição (opcional)",
    "duration_minutes": 30 | 45 | 60 (opcional),
    "mode": "group_consensus | one_on_one (opcional)",
    "slots": "[{start_at, end_at}] (opcional)",
    "status": "open | confirmed | expired | cancelled (opcional)"
  },
  "profile_update": {
    "name": "Novo nome do usuário (opcional)",
    "phone": "Novo telefone com DDD no padrão (opcional)",
    "autonomy_mode": "assisted | proactive (nível 1/2 = assisted, nível 3 = proactive; opcional)",
    "calendar_sync_enabled": true | false (ativação ou desativação de sync com Google Calendar; opcional)"
  },
  "trigger_query": {
    "category": "finance | taxes_docs | ... (opcional)",
    "status": "active | paused | all (opcional)"
  },
  "pending_query": {
    "status": "inbox | scheduled | done (opcional)",
    "category": "geral | trabalho | ... (opcional)",
    "limit": número máximo (opcional)
  },
  "memory_query": {
    "query": "termo de busca (opcional)",
    "category": "preference | family | ... (opcional)",
    "limit": número máximo (opcional)
  },
  "memory_update": {
    "target_query": "busca por conteúdo ou ID (opcional)",
    "id": "ID exato da memória (opcional)",
    "category": "nova categoria (opcional)",
    "content": "novo conteúdo (opcional)"
  },
  "memory_delete": {
    "target_query": "busca por conteúdo ou ID (opcional)",
    "id": "ID exato da memória (opcional)",
    "category": "categoria (opcional)"
  },
  "contacts_query": {
    "query": "termo de busca (opcional)",
    "limit": número máximo (opcional),
    "scope": "private | all (opcional)"
  },
  "email_message": {
    "to": "destinatario@dominio.com",
    "subject": "Assunto do e-mail",
    "body": "Corpo completo do e-mail"
  },
  "refined_message": {
    "channel": "whatsapp" | "email",
    "target": "Nome do contato ou e-mail de destino",
    "subject": "Assunto do e-mail (se e-mail)",
    "directive": "formal" | "concise" | "expand" | "grammar" | "commercial" | "friendly",
    "original_text": "Texto original anterior se houver",
    "refined_text": "Texto completo refinado e aprimorado",
    "send_now": true | false
  },
  "memory_category": "família" | "preferência" | "trabalho" | "saúde" | "rotina" | "geral",
  "memory_content": "Fato duradouro, preferência, rotina ou aprendizado sobre o usuário (ou vazio)",
  "additional_actions": [
    { "action": "...", "event": {...}, "todo": {...} }
  ]
}` + "\n"
}
