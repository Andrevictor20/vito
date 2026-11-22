package adkengine_test

import (
	"context"
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

func TestAITrace_AgentNameRecordedAndPersisted(t *testing.T) {
	ctx := context.Background()
	db, err := database.Open(filepath.Join(t.TempDir(), "vito_trace_agent_name.db"))
	if err != nil {
		t.Fatalf("falha ao abrir db: %v", err)
	}
	defer db.Close()

	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{
		ID:        "u-trace-1",
		Name:      "Trace User",
		Email:     "trace@vito.test",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})

	convRepo := repository.NewConversationStoreRepository(db)
	registry := toolsets.NewToolsetsRegistry()
	registry.Register(toolsets.NewCalendarToolset(nil))

	argsBytes, _ := json.Marshal(map[string]any{"date": "2026-11-21"})
	prov := &fakeAgentProvider{
		name:          "Gemini-Trace",
		model:         "gemini-2.5-flash",
		tier:          3,
		supportsTools: true,
		responses: []*ai.AgentChatResponse{
			{
				ToolCalls:    []ai.ToolCall{{ID: "call-trace-1", Name: "calendar_list_events", Arguments: argsBytes}},
				ProviderName: "Gemini-Trace",
				ModelName:    "gemini-2.5-flash",
			},
			{
				Text:         "Agenda verificada.",
				ProviderName: "Gemini-Trace",
				ModelName:    "gemini-2.5-flash",
			},
		},
	}

	traceRecorder := ai.NewRingBufferTraceRecorder(db, 10, time.Hour)
	defer traceRecorder.Close()

	facade, err := adkengine.NewADKLoopFacade(adkengine.FacadeConfig{
		Router:           ai.NewModelRouter(prov),
		Registry:         registry,
		ScopeGuard:       service.NewScopeGuard(),
		ConfirmationGate: service.NewConfirmationGateService(db),
		ConvRepo:         convRepo,
		TraceRecorder:    traceRecorder,
	})
	if err != nil {
		t.Fatalf("falha ao criar ADKLoopFacade: %v", err)
	}

	if _, err := facade.Run(ctx, domain.UnifiedAssistantRequest{
		UserID:  "u-trace-1",
		Channel: "app_mobile",
		Message: "Qual minha agenda hoje?",
	}); err != nil {
		t.Fatalf("facade.Run falhou: %v", err)
	}
	if err := traceRecorder.FlushNow(ctx); err != nil {
		t.Fatalf("FlushNow falhou: %v", err)
	}

	var agentName, toolsetCalled string
	if err := db.QueryRow(`SELECT agent_name, toolset_called FROM ai_traces WHERE user_id = ? LIMIT 1`, "u-trace-1").Scan(&agentName, &toolsetCalled); err != nil {
		t.Fatalf("falha ao consultar ai_traces: %v", err)
	}
	if strings.TrimSpace(agentName) == "" {
		t.Errorf("esperava agent_name preenchido em ai_traces, obteve vazio (toolset=%q)", toolsetCalled)
	}
}
