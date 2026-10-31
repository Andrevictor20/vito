package service_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

type mockLoopProvider struct {
	responses []*ai.AgentChatResponse
	index     int
}

func (m *mockLoopProvider) Name() string             { return "mock-gemini" }
func (m *mockLoopProvider) ModelName() string        { return "gemini-2.5-flash" }
func (m *mockLoopProvider) SupportsTools() bool      { return true }
func (m *mockLoopProvider) SupportsVision() bool     { return true }
func (m *mockLoopProvider) QualityTier() int         { return 3 }
func (m *mockLoopProvider) MaxContextTokens() int    { return 1000000 }
func (m *mockLoopProvider) Chat(ctx context.Context, req ai.AgentChatRequest) (*ai.AgentChatResponse, error) {
	if m.index < len(m.responses) {
		resp := m.responses[m.index]
		m.index++
		return resp, nil
	}
	return &ai.AgentChatResponse{Text: "Resposta final default", ProviderName: "mock-gemini", ModelName: "gemini-2.5-flash"}, nil
}
func (m *mockLoopProvider) StreamChat(ctx context.Context, req ai.AgentChatRequest, onDelta func(ai.StreamDelta) error) (*ai.AgentChatResponse, error) {
	return m.Chat(ctx, req)
}

func setupAgentLoopTest(t *testing.T, responses []*ai.AgentChatResponse) (*service.AgentLoop, string, string) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_loop.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("falha ao abrir db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	userID := "user-loop-1"
	_ = userRepo.Create(&domain.User{
		ID:        userID,
		Name:      "User Agent Loop",
		Email:     "agentloop@example.com",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})

	convRepo := repository.NewConversationStoreRepository(db)
	thread, _ := convRepo.GetOrCreateThread(context.Background(), userID, "app_mobile", "")

	mockProv := &mockLoopProvider{responses: responses}
	router := ai.NewModelRouter(mockProv)
	guard := service.NewScopeGuard()
	gate := service.NewConfirmationGateService(db)

	registry := toolsets.NewToolsetsRegistry()
	registry.Register(toolsets.NewCalendarToolset(nil))
	registry.Register(toolsets.NewTaskPendingToolset(nil))
	registry.Register(toolsets.NewWhatsAppToolset(nil))
	registry.Register(toolsets.NewGmailToolset(nil))
	registry.Register(toolsets.NewSearchToolset())

	loop := service.NewAgentLoop(router, registry, guard, gate, convRepo, nil)
	return loop, userID, thread.ID
}

// TestAgentLoop_PureChat valida conversa livre sem tools gerando resposta natural.
func TestAgentLoop_PureChat(t *testing.T) {
	mockResp := &ai.AgentChatResponse{
		Text:         "Olá! Como posso te ajudar hoje?",
		ProviderName: "mock-gemini",
		ModelName:    "gemini-2.5-flash",
	}
	loop, userID, threadID := setupAgentLoopTest(t, []*ai.AgentChatResponse{mockResp})

	req := domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: threadID,
		Channel:  "app_mobile",
		Message:  "Bom dia!",
	}

	resp, err := loop.Run(context.Background(), req)
	if err != nil {
		t.Fatalf("erro inesperado no Run: %v", err)
	}

	if resp.Text != "Olá! Como posso te ajudar hoje?" {
		t.Errorf("texto esperado não bate: %s", resp.Text)
	}
	if resp.RequiresConfirmation {
		t.Error("chat puro não deve requerer confirmação")
	}
	if len(resp.ToolCalls) > 0 {
		t.Errorf("esperava 0 tools executadas, obteve %d", len(resp.ToolCalls))
	}
}

// TestAgentLoop_ToolCallSuspension valida interrupção determinística de escrita no Confirmation Gate.
func TestAgentLoop_ToolCallSuspension(t *testing.T) {
	mockResp := &ai.AgentChatResponse{
		Text: "Vou criar o evento para você.",
		ToolCalls: []ai.ToolCall{
			{
				ID:   "call-1",
				Name: "calendar_manager",
				Arguments: []byte(`{
					"operation": "create_event",
					"params": {"title": "Reunião Diretoria", "start_time": "2026-11-02T14:00:00Z"}
				}`),
			},
		},
		ProviderName: "mock-gemini",
		ModelName:    "gemini-2.5-flash",
	}

	loop, userID, threadID := setupAgentLoopTest(t, []*ai.AgentChatResponse{mockResp})

	req := domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: threadID,
		Channel:  "app_mobile",
		Message:  "Marca reunião de diretoria segunda às 14h",
	}

	resp, err := loop.Run(context.Background(), req)
	if err != nil {
		t.Fatalf("erro ao executar tool call: %v", err)
	}

	if !resp.RequiresConfirmation {
		t.Fatal("esperava requires_confirmation=true para escrita na agenda")
	}
	if resp.PendingConfirmationID == "" {
		t.Fatal("esperava PendingConfirmationID preenchido")
	}
	if len(resp.Cards) == 0 || !resp.Cards[0].Confirm {
		t.Fatal("esperava ChatCard de confirmação gerado")
	}
}
