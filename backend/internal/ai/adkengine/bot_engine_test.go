package adkengine_test

import (
	"context"
	"encoding/json"
	"github.com/andrevmp/vito/backend/internal/calendar"
	"github.com/andrevmp/vito/backend/internal/tasks"
	"github.com/andrevmp/vito/backend/internal/whatsapp"
	"strings"
	"testing"

	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

type stubDomainToolset struct {
	name domain.ToolsetName
	ops  []string
}

func (s *stubDomainToolset) Name() domain.ToolsetName { return s.name }
func (s *stubDomainToolset) Description() string      { return "stub " + string(s.name) }
func (s *stubDomainToolset) JSONSchema() json.RawMessage {
	return json.RawMessage(`{"type":"object"}`)
}
func (s *stubDomainToolset) IsWriteOperation(op string, raw json.RawMessage) (bool, bool, map[string]any) {
	isW := op == "create_event" || op == "send_message" || op == "create_todo"
	return isW, false, map[string]any{"op": op}
}
func (s *stubDomainToolset) Execute(ctx context.Context, execCtx *domain.ToolExecutionContext, op string, raw json.RawMessage) (*domain.ToolExecutionResult, error) {
	return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "ok:" + op}, nil
}

func TestAC04_ToolsForBotContext_And_DefinitionsForContext(t *testing.T) {
	reg := toolsets.NewToolsetsRegistry()
	reg.Register(&stubDomainToolset{name: domain.ToolsetWebSearch})
	reg.Register(&stubDomainToolset{name: domain.ToolsetCalendar})
	reg.Register(&stubDomainToolset{name: domain.ToolsetWhatsApp})

	execCtx := &domain.ToolExecutionContext{
		UserID:          "u1",
		BotID:           "bot-1",
		AllowedToolsets: []domain.ToolsetName{domain.ToolsetWebSearch, domain.ToolsetCalendar},
		AllowedOperations: map[domain.ToolsetName][]string{
			domain.ToolsetWebSearch: {"search"},
			domain.ToolsetCalendar:  {"list_events"},
		},
		ActionPolicies: map[string]domain.ActionPolicy{
			"web:search": domain.ActionPolicyAuto,
			"gcal:free":  domain.ActionPolicyAuto,
			"gcal:evt":   domain.ActionPolicyOff,
		},
	}

	defs := reg.DefinitionsForContext(execCtx)
	if len(defs) != 2 {
		t.Fatalf("esperava 2 definitions no escopo, obteve %d", len(defs))
	}
	for _, d := range defs {
		if d.Name == string(domain.ToolsetWhatsApp) {
			t.Fatalf("AC-04 violado: WhatsApp não está em AllowedToolsets")
		}
	}

	bridge := adkengine.NewToolsetBridge(reg)
	tools := bridge.ToolsForBotContext(execCtx)
	if len(tools) != 2 {
		t.Fatalf("esperava 2 tools filtradas (web_search, calendar_list_events), obteve %d", len(tools))
	}
	for _, tl := range tools {
		if tl.Name() != "web_search" && tl.Name() != "calendar_list_events" {
			t.Errorf("tool fora do escopo exposta ao bot: %s", tl.Name())
		}
	}
}

func TestBotMemoryScopeGuard_Policies(t *testing.T) {
	guard := service.NewMemoryScopeGuard()
	ctx := context.Background()

	// 1. off -> bloqueado
	execOff := &domain.ToolExecutionContext{
		BotID:          "b1",
		ActionPolicies: map[string]domain.ActionPolicy{"gcal:evt": domain.ActionPolicyOff},
	}
	if ok, _ := guard.CanExecute(ctx, execOff, "create_event", true); ok {
		t.Fatalf("esperava bloqueio para policy=off")
	}

	// 2. ask -> bloqueado sem confirmação
	execAsk := &domain.ToolExecutionContext{
		BotID:          "b1",
		ActionPolicies: map[string]domain.ActionPolicy{"gcal:evt": domain.ActionPolicyAsk},
	}
	if ok, _ := guard.CanExecute(ctx, execAsk, "create_event", true); ok {
		t.Fatalf("esperava bloqueio para policy=ask")
	}

	// 3. ALWAYS (send_message) -> bloqueado mesmo com policy=auto
	execAlways := &domain.ToolExecutionContext{
		BotID:          "b1",
		ActionPolicies: map[string]domain.ActionPolicy{"wa:wasend": domain.ActionPolicyAuto},
	}
	if ok, _ := guard.CanExecute(ctx, execAlways, "send_message", true); ok {
		t.Fatalf("esperava bloqueio para ação ALWAYS send_message")
	}

	// 4. tainted + write -> bloqueado mesmo com policy=auto
	execTainted := &domain.ToolExecutionContext{
		BotID:                   "b1",
		TaintedByUntrustedInput: true,
		ActionPolicies:          map[string]domain.ActionPolicy{"gcal:evt": domain.ActionPolicyAuto},
	}
	if ok, _ := guard.CanExecute(ctx, execTainted, "create_event", true); ok {
		t.Fatalf("esperava bloqueio para tainted + write")
	}

	// 5. auto (não tainted, não ALWAYS) -> permitido
	execAuto := &domain.ToolExecutionContext{
		BotID:          "b1",
		ActionPolicies: map[string]domain.ActionPolicy{"gcal:evt": domain.ActionPolicyAuto},
	}
	if ok, reason := guard.CanExecute(ctx, execAuto, "create_event", true); !ok {
		t.Fatalf("esperava permissão para policy=auto, obteve false: %s", reason)
	}
}

func TestBuildBotLLMAgent_InstructionAndTools(t *testing.T) {
	reg := toolsets.NewToolsetsRegistry()
	reg.Register(&stubDomainToolset{name: domain.ToolsetWebSearch})
	reg.Register(&stubDomainToolset{name: domain.ToolsetWhatsApp})
	bridge := adkengine.NewToolsetBridge(reg)

	llm := adkengine.NewRoutedLLM(nil)
	cfg := adkengine.BotAgentConfig{
		BotID:             "bot-voo",
		Name:              "Caçador de voos",
		Goal:              "Acompanhar voos para o Rio",
		FiringFrame:       adkengine.DefaultBotFiringFrame,
		Rules:             []string{"Nunca comprar nada"},
		SkillsMarkdown:    []string{"### Comparar preços\n- Pesquisar em 2 fontes"},
		BotMemories:       []string{"Prefiro voos diretos pela manhã"},
		LastRuns:          []string{"r1", "r2", "r3", "r4"},
		AllowedActionKeys: []string{"web:search"},
	}
	ag, tools, err := adkengine.BuildBotLLMAgent(llm, bridge, cfg)
	if err != nil {
		t.Fatalf("BuildBotLLMAgent falhou: %v", err)
	}
	if ag.Name() != "bot_bot-voo" {
		t.Errorf("nome inesperado: %s", ag.Name())
	}
	if len(tools) != 1 || tools[0].Name() != "web_search" {
		t.Errorf("esperava apenas web_search, obteve %d tools", len(tools))
	}
	instr := adkengine.BuildBotInstruction("bot-voo", cfg)
	for _, mustContain := range []string{
		"Eu cuido só desta função",
		"Firing Frame",
		"## Habilidades",
		"## Memória do Bot",
		"Prefiro voos diretos pela manhã",
		"- r3",
	} {
		if !strings.Contains(instr, mustContain) {
			t.Errorf("Instruction faltando %q", mustContain)
		}
	}
	if strings.Contains(instr, "- r4") {
		t.Errorf("Instruction deve limitar últimas execuções a 3 itens")
	}
}

func TestToolsetsRegistry_BotActionSpecs(t *testing.T) {
	reg := toolsets.NewToolsetsRegistry()
	reg.Register(calendar.NewCalendarToolset(nil))
	reg.Register(tasks.NewTaskPendingToolset(nil))
	reg.Register(whatsapp.NewWhatsAppToolset(nil))
	reg.Register(toolsets.NewGmailToolset(nil))
	reg.Register(toolsets.NewSearchToolset(nil))

	specs := reg.BotActionSpecs()
	if len(specs) < 9 {
		t.Fatalf("esperava ao menos 9 BotActionSpecs dos toolsets principais, obteve %d", len(specs))
	}
}
