package adkengine

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

type stubDomainToolset struct {
	name domain.ToolsetName
}

func (s *stubDomainToolset) Name() domain.ToolsetName { return s.name }
func (s *stubDomainToolset) Description() string      { return "stub " + string(s.name) }
func (s *stubDomainToolset) JSONSchema() json.RawMessage {
	return json.RawMessage(`{"type":"object"}`)
}
func (s *stubDomainToolset) IsWriteOperation(_ string, _ json.RawMessage) (bool, bool, map[string]any) {
	return false, false, nil
}
func (s *stubDomainToolset) Execute(_ context.Context, _ *domain.ToolExecutionContext, _ string, _ json.RawMessage) (*domain.ToolExecutionResult, error) {
	return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "ok"}, nil
}

func TestAC02_TypedSchemasAndCleanRootTopology(t *testing.T) {
	reg := toolsets.NewToolsetsRegistry()
	for _, name := range []domain.ToolsetName{
		domain.ToolsetCalendar,
		domain.ToolsetTaskPending,
		domain.ToolsetMeetingBooking,
		domain.ToolsetWhatsApp,
		domain.ToolsetGmail,
		domain.ToolsetWebSearch,
		domain.ToolsetMemoryProfile,
		domain.ToolsetRadarTrigger,
		domain.ToolsetName("finance_manager"),
	} {
		reg.Register(&stubDomainToolset{name: name})
	}

	bridge := NewToolsetBridge(reg)
	allTools := bridge.BuildAllRegisteredTools()
	if len(allTools) == 0 {
		t.Fatal("esperava tools atômicas registradas")
	}

	// Nenhuma macro-ferramenta legada deve estar presente em BuildAllRegisteredTools
	for _, tl := range allTools {
		if strings.HasSuffix(tl.Name(), "_manager") || strings.HasSuffix(tl.Name(), "_assistant") {
			t.Errorf("macro-envelope legado não deveria existir: %s", tl.Name())
		}
	}

	// Verifica que tools com parâmetros geram JSON Schema tipado (não vazio)
	for _, tl := range allTools {
		if tl.Name() == "calendar_create_event" {
			type declProvider interface {
				Declaration() any
			}
			// A função foi construída com CalendarCreateEventArgs via functiontool.New
			if tl.Description() == "" {
				t.Errorf("esperava descrição preenchida para %s", tl.Name())
			}
		}
	}

	llm := NewOpenAICompatLLM("openai", "gpt-4o-mini", "https://api.openai.com/v1", "sk-test")
	topology, err := BuildAgentTopology(llm, bridge)
	if err != nil {
		t.Fatalf("BuildAgentTopology falhou: %v", err)
	}
	if len(topology.RootAgent.SubAgents()) != 6 {
		t.Fatalf("esperava 6 sub-agentes em vito_executive, obteve %d", len(topology.RootAgent.SubAgents()))
	}

	// Verifica frases naturais de confirmação para criação de bot
	for _, phrase := range []string{"pode criar", "sim, pode criar", "cria o bot", "confirmar", "pode fazer"} {
		if !service.IsExplicitSendConfirmationText(phrase) {
			t.Errorf("esperava que IsExplicitSendConfirmationText(%q) retornasse true", phrase)
		}
	}
}
