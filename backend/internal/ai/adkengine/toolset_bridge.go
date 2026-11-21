package adkengine

import (
	"encoding/json"
	"fmt"
	"strings"

	"google.golang.org/adk/v2/agent"
	"google.golang.org/adk/v2/tool"
	"google.golang.org/adk/v2/tool/functiontool"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

// ToolResolution descreve como uma tool invocada pela LLM mapeia para um DomainToolset e operação.
type ToolResolution struct {
	Toolset   domain.DomainToolset
	Operation string
	Params    json.RawMessage
}

// AtomicToolSpec especifica uma functiontool atômica derivada de um DomainToolset.
type AtomicToolSpec struct {
	AtomicName  string
	ToolsetName domain.ToolsetName
	Operation   string
	Description string
	ActionKey   string
}

var canonicalAtomicSpecs = []AtomicToolSpec{
	// Rotina: Agenda
	{AtomicName: "calendar_list_events", ToolsetName: domain.ToolsetCalendar, Operation: "list_events", Description: "Lista os compromissos e reuniões na agenda do usuário.", ActionKey: "cal:list"},
	{AtomicName: "calendar_create_event", ToolsetName: domain.ToolsetCalendar, Operation: "create_event", Description: "Cria um novo evento ou reunião na agenda do usuário.", ActionKey: "cal:create"},
	{AtomicName: "calendar_delete_event", ToolsetName: domain.ToolsetCalendar, Operation: "delete_event", Description: "Exclui um compromisso existente da agenda do usuário.", ActionKey: "cal:delete"},
	// Rotina: Tarefas e Pendências
	{AtomicName: "todo_list_todos", ToolsetName: domain.ToolsetTaskPending, Operation: "list_todos", Description: "Lista as tarefas e pendências ativas do usuário.", ActionKey: "todo:list"},
	{AtomicName: "todo_create_todo", ToolsetName: domain.ToolsetTaskPending, Operation: "create_todo", Description: "Cria uma nova tarefa ou pendência para o usuário.", ActionKey: "todo:create"},
	{AtomicName: "todo_complete_todo", ToolsetName: domain.ToolsetTaskPending, Operation: "complete_todo", Description: "Marca uma tarefa existente como concluída.", ActionKey: "todo:complete"},
	{AtomicName: "todo_delete_todo", ToolsetName: domain.ToolsetTaskPending, Operation: "delete_todo", Description: "Remove uma tarefa do usuário.", ActionKey: "todo:delete"},
	// Rotina: Booking e Reuniões
	{AtomicName: "booking_list_types", ToolsetName: domain.ToolsetMeetingBooking, Operation: "list_booking_types", Description: "Lista os links públicos de agendamento (Vito Booking) ativos do usuário.", ActionKey: "book:list"},
	{AtomicName: "booking_create_link", ToolsetName: domain.ToolsetMeetingBooking, Operation: "create_booking_link", Description: "Cria um novo link público de agendamento (Vito Booking).", ActionKey: "book:create"},
	// Comunicações: WhatsApp
	{AtomicName: "whatsapp_search_messages", ToolsetName: domain.ToolsetWhatsApp, Operation: "search_messages", Description: "Pesquisa mensagens no histórico do WhatsApp por termo ou contato.", ActionKey: "wa:waread"},
	{AtomicName: "whatsapp_recent_chats", ToolsetName: domain.ToolsetWhatsApp, Operation: "recent_chats", Description: "Lista as conversas recentes do WhatsApp do usuário.", ActionKey: "wa:waread"},
	{AtomicName: "whatsapp_send_message", ToolsetName: domain.ToolsetWhatsApp, Operation: "send_message", Description: "Envia uma mensagem de WhatsApp para um contato ou número.", ActionKey: "wa:wasend"},
	// Comunicações: Gmail
	{AtomicName: "gmail_search_emails", ToolsetName: domain.ToolsetGmail, Operation: "search_emails", Description: "Pesquisa e-mails, faturas e voos recentes na caixa de entrada do Gmail.", ActionKey: "gmail:mailr"},
	{AtomicName: "gmail_create_draft", ToolsetName: domain.ToolsetGmail, Operation: "create_draft", Description: "Cria um rascunho de e-mail no Gmail.", ActionKey: "gmail:draft"},
	{AtomicName: "gmail_send_email", ToolsetName: domain.ToolsetGmail, Operation: "send_email", Description: "Envia um e-mail pelo Gmail do usuário.", ActionKey: "gmail:mailsend"},
	// Pesquisa Web & Coletores Verticais
	{AtomicName: "web_search", ToolsetName: domain.ToolsetWebSearch, Operation: "search", Description: "Realiza busca factual em tempo real na web, notícias, cotações financeiras e preços de produtos.", ActionKey: "web:search"},
	{AtomicName: "web_read_page", ToolsetName: domain.ToolsetWebSearch, Operation: "read_page", Description: "Lê o conteúdo completo em Markdown de uma URL específica.", ActionKey: "web:read"},
	// Memória e Perfil
	{AtomicName: "memory_search", ToolsetName: domain.ToolsetMemoryProfile, Operation: "search_memories", Description: "Pesquisa fatos e preferências nas memórias de longo prazo do usuário.", ActionKey: "mem:read"},
	{AtomicName: "memory_get_profile", ToolsetName: domain.ToolsetMemoryProfile, Operation: "get_profile", Description: "Obtém o perfil permanente e preferências conhecidas do usuário.", ActionKey: "mem:read"},
	{AtomicName: "memory_update_profile", ToolsetName: domain.ToolsetMemoryProfile, Operation: "update_profile", Description: "Registra uma nova preferência ou fato de longo prazo sobre o usuário.", ActionKey: "mem:write"},
	// Radares e Bots
	{AtomicName: "radar_list_triggers", ToolsetName: domain.ToolsetRadarTrigger, Operation: "list_triggers", Description: "Lista os radares e vigílias proativas ativas do usuário.", ActionKey: "bot:list"},
	{AtomicName: "radar_create_trigger", ToolsetName: domain.ToolsetRadarTrigger, Operation: "create_trigger", Description: "Cria um novo radar ou vigília proativa para monitorar preços, notícias ou mudanças.", ActionKey: "bot:create"},
	{AtomicName: "radar_delete_trigger", ToolsetName: domain.ToolsetRadarTrigger, Operation: "delete_trigger", Description: "Exclui um radar ou vigília proativa existente.", ActionKey: "bot:delete"},
	// Finanças (Plano 05)
	{AtomicName: "finance_get_summary", ToolsetName: domain.ToolsetName("finance_manager"), Operation: "get_summary", Description: "Obtém o resumo financeiro Safe-to-Spend, faturas e despesas por categoria.", ActionKey: "fin:summary"},
}

// ToolsetBridge converte os DomainToolsets do Vito em functiontool.New(...) fortemente tipadas do Google ADK,
// mantendo compatibilidade retroativa com nomes de macro-toolsets legados.
type ToolsetBridge struct {
	registry   *toolsets.ToolsetsRegistry
	atomicMap  map[string]AtomicToolSpec
	actionKeys map[string][]string
}

// NewToolsetBridge cria a ponte de ferramentas para o motor Google ADK.
func NewToolsetBridge(registry *toolsets.ToolsetsRegistry) *ToolsetBridge {
	b := &ToolsetBridge{
		registry:   registry,
		atomicMap:  make(map[string]AtomicToolSpec),
		actionKeys: make(map[string][]string),
	}
	for _, spec := range canonicalAtomicSpecs {
		b.atomicMap[spec.AtomicName] = spec
		b.actionKeys[spec.ActionKey] = append(b.actionKeys[spec.ActionKey], spec.AtomicName)
	}
	return b
}

// ResolveCall resolve o nome da ferramenta e argumentos (seja uma functiontool atômica como "calendar_create_event"
// ou uma macro-ferramenta legada como "calendar_manager" com envelope {"operation": "...", "params": {...}}).
func (b *ToolsetBridge) ResolveCall(toolName string, args map[string]any) (*ToolResolution, bool) {
	if b.registry == nil {
		return nil, false
	}

	// 1. Verifica se é uma functiontool atômica
	if spec, ok := b.atomicMap[toolName]; ok {
		ts, exists := b.registry.Get(spec.ToolsetName)
		if !exists {
			return nil, false
		}
		rawParams := extractCleanParams(args)
		return &ToolResolution{
			Toolset:   ts,
			Operation: spec.Operation,
			Params:    rawParams,
		}, true
	}

	// 2. Verifica se é uma macro-ferramenta legada (compatibilidade retroativa)
	ts, exists := b.registry.Get(domain.ToolsetName(toolName))
	if !exists {
		return nil, false
	}

	op := ""
	if opVal, ok := args["operation"].(string); ok && strings.TrimSpace(opVal) != "" {
		op = strings.TrimSpace(opVal)
	}
	if op == "" {
		op = "default"
	}

	rawParams := extractCleanParams(args)
	return &ToolResolution{
		Toolset:   ts,
		Operation: op,
		Params:    rawParams,
	}, true
}

func extractCleanParams(args map[string]any) json.RawMessage {
	if len(args) == 0 {
		return json.RawMessage(`{}`)
	}
	if nested, ok := args["params"]; ok && nested != nil {
		if b, err := json.Marshal(nested); err == nil && len(b) > 0 && string(b) != "null" {
			return b
		}
	}
	clean := make(map[string]any, len(args))
	for k, v := range args {
		if k == "operation" {
			continue
		}
		clean[k] = v
	}
	if b, err := json.Marshal(clean); err == nil {
		return b
	}
	return json.RawMessage(`{}`)
}

// BuildAtomicTools constrói as functiontool.New(...) atômicas para os toolsets registrados no registry.
func (b *ToolsetBridge) BuildAtomicTools() []tool.Tool {
	return b.buildToolsFiltered(nil)
}

// BuildDomainTools retorna as tools atômicas filtradas para um conjunto específico de DomainToolsets.
func (b *ToolsetBridge) BuildDomainTools(allowedToolsets ...domain.ToolsetName) []tool.Tool {
	filter := make(map[domain.ToolsetName]bool, len(allowedToolsets))
	for _, ts := range allowedToolsets {
		filter[ts] = true
	}
	return b.buildToolsFiltered(filter)
}

// FilterByActionKeys retorna apenas as functiontool.New(...) cujos ActionKeys pertençam à lista permitida (Plano 04 Bots).
func (b *ToolsetBridge) FilterByActionKeys(allowedActionKeys []string) []tool.Tool {
	if b.registry == nil || len(allowedActionKeys) == 0 {
		return nil
	}
	allowed := make(map[string]bool, len(allowedActionKeys))
	for _, k := range allowedActionKeys {
		allowed[strings.TrimSpace(k)] = true
	}
	var out []tool.Tool
	for _, spec := range canonicalAtomicSpecs {
		if !allowed[spec.ActionKey] {
			continue
		}
		ts, exists := b.registry.Get(spec.ToolsetName)
		if !exists {
			continue
		}
		if ft, err := b.newAtomicFunctionTool(spec, ts); err == nil && ft != nil {
			out = append(out, ft)
		}
	}
	return out
}

// SpecForTool retorna a especificação atômica associada ao nome da tool.
func (b *ToolsetBridge) SpecForTool(toolName string) (AtomicToolSpec, bool) {
	spec, ok := b.atomicMap[toolName]
	return spec, ok
}

// BuildAllRegisteredTools retorna tanto as functiontool.New(...) atômicas quanto os adaptadores de macro-toolset
// para manter 100% de compatibilidade com chamadas atômicas e chamadas em formato envelope.
func (b *ToolsetBridge) BuildAllRegisteredTools() []tool.Tool {
	tools := b.BuildAtomicTools()
	if b.registry == nil {
		return tools
	}
	for _, ts := range b.registry.All() {
		if macroTool, err := b.buildLegacyMacroTool(ts); err == nil && macroTool != nil {
			tools = append(tools, macroTool)
		}
	}
	return tools
}

func (b *ToolsetBridge) buildToolsFiltered(allowed map[domain.ToolsetName]bool) []tool.Tool {
	if b.registry == nil {
		return nil
	}
	var out []tool.Tool
	for _, spec := range canonicalAtomicSpecs {
		if allowed != nil && !allowed[spec.ToolsetName] {
			continue
		}
		ts, exists := b.registry.Get(spec.ToolsetName)
		if !exists {
			continue
		}
		ft, err := b.newAtomicFunctionTool(spec, ts)
		if err == nil && ft != nil {
			out = append(out, ft)
		}
	}
	return out
}

func (b *ToolsetBridge) newAtomicFunctionTool(spec AtomicToolSpec, ts domain.DomainToolset) (tool.Tool, error) {
	return functiontool.New(functiontool.Config{
		Name:        spec.AtomicName,
		Description: spec.Description,
	}, func(ctx agent.Context, args map[string]any) (map[string]any, error) {
		return b.executeResolved(ctx, ts, spec.Operation, extractCleanParams(args))
	})
}

func (b *ToolsetBridge) buildLegacyMacroTool(ts domain.DomainToolset) (tool.Tool, error) {
	return functiontool.New(functiontool.Config{
		Name:        string(ts.Name()),
		Description: ts.Description(),
	}, func(ctx agent.Context, args map[string]any) (map[string]any, error) {
		op := "default"
		if opVal, ok := args["operation"].(string); ok && strings.TrimSpace(opVal) != "" {
			op = strings.TrimSpace(opVal)
		}
		return b.executeResolved(ctx, ts, op, extractCleanParams(args))
	})
}

func (b *ToolsetBridge) executeResolved(ctx agent.Context, ts domain.DomainToolset, operation string, rawParams json.RawMessage) (map[string]any, error) {
	execCtx := buildToolExecutionContextFromAgent(ctx)
	res, err := ts.Execute(ctx, execCtx, operation, rawParams)
	if err != nil {
		return map[string]any{
			"status":          "ERROR",
			"summary_for_llm": fmt.Sprintf("Falha ao executar %s (%s): %v", ts.Name(), operation, err),
			"error":           err.Error(),
		}, nil
	}
	if res == nil {
		return map[string]any{
			"status":          "COMPLETED",
			"summary_for_llm": "Operação concluída.",
		}, nil
	}
	return encodeToolExecutionResultMap(res, string(ts.Name()), operation), nil
}

func buildToolExecutionContextFromAgent(ctx agent.Context) *domain.ToolExecutionContext {
	meta := TurnExecutionMetaFromContext(ctx)
	execCtx := &domain.ToolExecutionContext{
		UserID:   ctx.UserID(),
		ThreadID: ctx.SessionID(),
	}
	if meta != nil {
		if execCtx.UserID == "" {
			execCtx.UserID = meta.UserID
		}
		if execCtx.ThreadID == "" {
			execCtx.ThreadID = meta.ThreadID
		}
		execCtx.TurnID = meta.TurnID
		execCtx.Channel = meta.Channel
		execCtx.FocusMode = meta.FocusMode
	}
	if st := ctx.ReadonlyState(); st != nil {
		if tainted, err := st.Get("tainted_by_untrusted_input"); err == nil {
			if tb, ok := tainted.(bool); ok {
				execCtx.TaintedByUntrustedInput = tb
			}
		}
		if aut, err := st.Get("autonomy_level"); err == nil {
			if as, ok := aut.(string); ok {
				execCtx.AutonomyLevel = as
			}
		}
	}
	return execCtx
}

func encodeToolExecutionResultMap(res *domain.ToolExecutionResult, toolsetName, operation string) map[string]any {
	out := map[string]any{
		"status":                   res.Status,
		"summary_for_llm":          res.SummaryForLLM,
		"result":                   res.SummaryForLLM,
		"toolset_name":             toolsetName,
		"operation":                operation,
		"marks_context_as_tainted": res.MarksContextAsTainted,
		"taint_source_label":       res.TaintSourceLabel,
	}
	if len(res.Cards) > 0 {
		out["cards"] = res.Cards
	}
	if len(res.Sources) > 0 {
		out["sources"] = res.Sources
	}
	return out
}
