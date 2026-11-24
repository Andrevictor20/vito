package adkengine

import (
	"encoding/json"

	"google.golang.org/adk/v2/agent"
	"google.golang.org/adk/v2/tool"
	"google.golang.org/adk/v2/tool/functiontool"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// --- Schemas tipados para Calendar ---

type CalendarListEventsArgs struct {
	StartTime string `json:"start_time,omitempty" jsonschema:"Data/hora inicial opcional (ISO 8601 ou YYYY-MM-DD)."`
	EndTime   string `json:"end_time,omitempty" jsonschema:"Data/hora final opcional (ISO 8601 ou YYYY-MM-DD)."`
}

type CalendarCreateEventArgs struct {
	Title       string `json:"title" jsonschema:"Título do compromisso ou reunião."`
	Description string `json:"description,omitempty" jsonschema:"Descrição ou pauta opcional do evento."`
	StartTime   string `json:"start_time" jsonschema:"Data e hora de início (ISO 8601 com fuso horário, ex.: 2026-11-24T15:00:00-03:00)."`
	EndTime     string `json:"end_time,omitempty" jsonschema:"Data e hora de término opcional (ISO 8601)."`
}

type CalendarDeleteEventArgs struct {
	EventID string `json:"event_id" jsonschema:"Identificador único do evento a ser removido."`
}

// --- Schemas tipados para Tarefas & Pendências ---

type TodoListArgs struct {
	Category string `json:"category,omitempty" jsonschema:"Categoria opcional para filtrar tarefas."`
}

type TodoCreateArgs struct {
	Title       string `json:"title" jsonschema:"Título claro da tarefa ou pendência."`
	Description string `json:"description,omitempty" jsonschema:"Detalhes adicionais da tarefa."`
	Category    string `json:"category,omitempty" jsonschema:"Categoria da tarefa (ex.: geral, trabalho, casa)."`
	Priority    string `json:"priority,omitempty" jsonschema:"Prioridade opcional da tarefa (low, medium, high)."`
	DueDate     string `json:"due_date,omitempty" jsonschema:"Prazo opcional em ISO 8601 ou YYYY-MM-DD."`
}

type TodoIDArgs struct {
	TodoID string `json:"todo_id" jsonschema:"Identificador único da tarefa."`
}

// --- Schemas tipados para Booking ---

type BookingListTypesArgs struct{}

type BookingCreateLinkArgs struct {
	Title           string `json:"title" jsonschema:"Título público do tipo de agendamento."`
	DurationMinutes int    `json:"duration_minutes,omitempty" jsonschema:"Duração em minutos (padrão 30)."`
}

// --- Schemas tipados para WhatsApp ---

type WhatsAppSearchArgs struct {
	Query string `json:"query" jsonschema:"Termo, assunto ou nome do contato para buscar no histórico do WhatsApp."`
}

type WhatsAppRecentChatsArgs struct {
	Query string `json:"query,omitempty" jsonschema:"Filtro opcional por nome de contato ou grupo."`
}

type WhatsAppSendMessageArgs struct {
	Recipient string `json:"recipient" jsonschema:"Nome do contato, número em E.164 ou JID do destinatário."`
	Message   string `json:"message" jsonschema:"Conteúdo exato da mensagem a ser enviada."`
}

// --- Schemas tipados para Gmail ---

type GmailSearchEmailsArgs struct {
	Query string `json:"query" jsonschema:"Consulta de busca no Gmail (remetente, assunto ou palavra-chave)."`
}

type GmailSendOrDraftArgs struct {
	To      string `json:"to" jsonschema:"Endereço de e-mail do destinatário."`
	Subject string `json:"subject" jsonschema:"Assunto do e-mail."`
	Body    string `json:"body" jsonschema:"Corpo completo do e-mail."`
}

// --- Schemas tipados para Pesquisa Web ---

type WebSearchArgs struct {
	Query    string `json:"query" jsonschema:"Termos de pesquisa factual na web."`
	Category string `json:"category,omitempty" jsonschema:"Categoria opcional (general, news, finance)."`
}

type WebReadPageArgs struct {
	URL string `json:"url" jsonschema:"URL completa da página web a ser lida."`
}

// --- Schemas tipados para Memória e Perfil ---

type MemorySearchArgs struct {
	Query string `json:"query" jsonschema:"Tema ou palavra-chave para buscar nas memórias de longo prazo."`
}

type MemoryGetProfileArgs struct{}

type MemoryUpdateProfileArgs struct {
	Preferences string `json:"preferences" jsonschema:"Fato permanente ou preferência explícita do usuário a salvar."`
}

// --- Schemas tipados para Bots / Gatilhos ---

type BotListArgs struct{}

type BotCreateArgs struct {
	Title          string   `json:"title" jsonschema:"Nome curto do bot proativo."`
	Goal           string   `json:"goal" jsonschema:"Objetivo ou instrução de monitoramento do bot."`
	TemplateKey    string   `json:"template_key,omitempty" jsonschema:"Chave opcional de template pronto do catálogo."`
	SuggestedSkill string   `json:"suggested_skill,omitempty" jsonschema:"Habilidade sugerida para o bot."`
	Actions        []string `json:"actions,omitempty" jsonschema:"Lista de action_keys permitidas para o bot."`
}

type BotDeleteArgs struct {
	BotID     string `json:"bot_id,omitempty" jsonschema:"ID do bot a remover."`
	TriggerID string `json:"trigger_id,omitempty" jsonschema:"ID alternativo do gatilho/bot a remover."`
}

// --- Schemas tipados para Finanças ---

type FinanceSummaryArgs struct {
	Period   string `json:"period,omitempty" jsonschema:"Período opcional (ex.: month, week, safe_to_spend)."`
	Category string `json:"category,omitempty" jsonschema:"Categoria opcional de gasto para filtrar o resumo."`
}

type FinanceTransactionsArgs struct {
	Query    string `json:"query,omitempty" jsonschema:"Filtro opcional por estabelecimento ou descrição."`
	Category string `json:"category,omitempty" jsonschema:"Categoria opcional de gasto."`
	Limit    int    `json:"limit,omitempty" jsonschema:"Quantidade máxima de transações (padrão 15)."`
}

func newTypedAtomicTool[T any](b *ToolsetBridge, spec AtomicToolSpec, ts domain.DomainToolset) (tool.Tool, error) {
	return functiontool.New(functiontool.Config{
		Name:        spec.AtomicName,
		Description: spec.Description,
	}, func(ctx agent.Context, args T) (map[string]any, error) {
		raw, err := json.Marshal(args)
		if err != nil || len(raw) == 0 || string(raw) == "null" {
			raw = json.RawMessage(`{}`)
		}
		return b.executeResolved(ctx, ts, spec.Operation, raw)
	})
}

func (b *ToolsetBridge) buildTypedAtomicFunctionTool(spec AtomicToolSpec, ts domain.DomainToolset) (tool.Tool, error) {
	switch spec.AtomicName {
	case "calendar_list_events":
		return newTypedAtomicTool[CalendarListEventsArgs](b, spec, ts)
	case "calendar_create_event":
		return newTypedAtomicTool[CalendarCreateEventArgs](b, spec, ts)
	case "calendar_delete_event":
		return newTypedAtomicTool[CalendarDeleteEventArgs](b, spec, ts)
	case "todo_list_todos":
		return newTypedAtomicTool[TodoListArgs](b, spec, ts)
	case "todo_create_todo":
		return newTypedAtomicTool[TodoCreateArgs](b, spec, ts)
	case "todo_complete_todo", "todo_delete_todo":
		return newTypedAtomicTool[TodoIDArgs](b, spec, ts)
	case "booking_list_types":
		return newTypedAtomicTool[BookingListTypesArgs](b, spec, ts)
	case "booking_create_link":
		return newTypedAtomicTool[BookingCreateLinkArgs](b, spec, ts)
	case "whatsapp_search_messages":
		return newTypedAtomicTool[WhatsAppSearchArgs](b, spec, ts)
	case "whatsapp_recent_chats":
		return newTypedAtomicTool[WhatsAppRecentChatsArgs](b, spec, ts)
	case "whatsapp_send_message":
		return newTypedAtomicTool[WhatsAppSendMessageArgs](b, spec, ts)
	case "gmail_search_emails":
		return newTypedAtomicTool[GmailSearchEmailsArgs](b, spec, ts)
	case "gmail_create_draft", "gmail_send_email":
		return newTypedAtomicTool[GmailSendOrDraftArgs](b, spec, ts)
	case "web_search":
		return newTypedAtomicTool[WebSearchArgs](b, spec, ts)
	case "web_read_page":
		return newTypedAtomicTool[WebReadPageArgs](b, spec, ts)
	case "memory_search":
		return newTypedAtomicTool[MemorySearchArgs](b, spec, ts)
	case "memory_get_profile":
		return newTypedAtomicTool[MemoryGetProfileArgs](b, spec, ts)
	case "memory_update_profile":
		return newTypedAtomicTool[MemoryUpdateProfileArgs](b, spec, ts)
	case "bot_list_bots", "radar_list_triggers":
		return newTypedAtomicTool[BotListArgs](b, spec, ts)
	case "bot_create_bot", "radar_create_trigger":
		return newTypedAtomicTool[BotCreateArgs](b, spec, ts)
	case "bot_delete_bot", "radar_delete_trigger":
		return newTypedAtomicTool[BotDeleteArgs](b, spec, ts)
	case "finance_get_summary", "finance_get_budgets", "finance_get_cards":
		return newTypedAtomicTool[FinanceSummaryArgs](b, spec, ts)
	case "finance_list_transactions":
		return newTypedAtomicTool[FinanceTransactionsArgs](b, spec, ts)
	default:
		return newTypedAtomicTool[map[string]any](b, spec, ts)
	}
}
