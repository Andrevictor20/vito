package service_test

import (
	"context"
	"path/filepath"
	"strings"
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
	responses   []*ai.AgentChatResponse
	index       int
	historyReqs []ai.AgentChatRequest
}

func (m *mockLoopProvider) Name() string             { return "mock-gemini" }
func (m *mockLoopProvider) ModelName() string        { return "gemini-2.5-flash" }
func (m *mockLoopProvider) SupportsTools() bool      { return true }
func (m *mockLoopProvider) SupportsVision() bool     { return true }
func (m *mockLoopProvider) QualityTier() int         { return 3 }
func (m *mockLoopProvider) MaxContextTokens() int    { return 1000000 }
func (m *mockLoopProvider) Chat(ctx context.Context, req ai.AgentChatRequest) (*ai.AgentChatResponse, error) {
	m.historyReqs = append(m.historyReqs, req)
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

// TestAgentLoop_MultiStepToolCall_AppendsAssistantTurnBeforeToolResult valida o protocolo ReAct estrito (AC-1).
func TestAgentLoop_MultiStepToolCall_AppendsAssistantTurnBeforeToolResult(t *testing.T) {
	tmpDir := t.TempDir()
	db, err := database.Open(filepath.Join(tmpDir, "test_multistep.db"))
	if err != nil {
		t.Fatalf("falha ao abrir db: %v", err)
	}
	defer db.Close()

	userRepo := repository.NewUserRepository(db)
	userID := "user-multistep-1"
	_ = userRepo.Create(&domain.User{
		ID:        userID,
		Name:      "André Teste",
		Email:     "andre@example.com",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})

	convRepo := repository.NewConversationStoreRepository(db)
	thread, _ := convRepo.GetOrCreateThread(context.Background(), userID, "app_mobile", "conv-thread-1")

	// Passo 0: Modelo retorna tool call com thoughtSignature
	resp0 := &ai.AgentChatResponse{
		Text:    "",
		Thought: "Buscando compromissos do dia",
		ToolCalls: []ai.ToolCall{
			{
				ID:               "call_cal_1",
				Name:             "calendar_manager",
				Arguments:        []byte(`{"operation":"list_events","params":{"date":"2026-10-31"}}`),
				ThoughtSignature: "sig-react-test",
			},
		},
		ProviderName: "mock-gemini",
		ModelName:    "gemini-2.5-flash",
	}
	// Passo 1: Modelo recebe resultado da tool e responde com texto final
	resp1 := &ai.AgentChatResponse{
		Text:         "Você tem 1 reunião marcada hoje às 15h.",
		ProviderName: "mock-gemini",
		ModelName:    "gemini-2.5-flash",
	}

	mockProv := &mockLoopProvider{responses: []*ai.AgentChatResponse{resp0, resp1}}
	router := ai.NewModelRouter(mockProv)
	guard := service.NewScopeGuard()
	gate := service.NewConfirmationGateService(db)

	registry := toolsets.NewToolsetsRegistry()
	registry.Register(toolsets.NewCalendarToolset(nil))

	loop := service.NewAgentLoop(router, registry, guard, gate, convRepo, nil)

	req := domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: thread.ID,
		Channel:  "app_mobile",
		Message:  "Quais são meus eventos de hoje?",
	}

	res, err := loop.Run(context.Background(), req)
	if err != nil {
		t.Fatalf("falha no loop ReAct multi-step: %v", err)
	}

	if res.Text != "Você tem 1 reunião marcada hoje às 15h." {
		t.Errorf("texto inesperado: %q", res.Text)
	}

	if len(mockProv.historyReqs) < 2 {
		t.Fatalf("esperava ao menos 2 requisições no histórico do mock, obteve %d", len(mockProv.historyReqs))
	}

	step1Req := mockProv.historyReqs[1]
	msgs := step1Req.Messages
	if len(msgs) < 3 {
		t.Fatalf("esperava ao menos 3 mensagens no passo 1 (user, assistant, tool), obteve %d", len(msgs))
	}

	// Localiza o turno RoleTool e verifica que o imediatamente anterior é RoleAssistant
	toolIdx := -1
	for i, m := range msgs {
		if m.Role == ai.RoleTool {
			toolIdx = i
			break
		}
	}
	if toolIdx == -1 {
		t.Fatalf("turno RoleTool não encontrado no passo 1")
	}
	if toolIdx == 0 {
		t.Fatalf("RoleTool não pode ser o primeiro turno")
	}

	prevMsg := msgs[toolIdx-1]
	if prevMsg.Role != ai.RoleAssistant {
		t.Fatalf("esperava que o turno anterior a RoleTool fosse RoleAssistant, obteve %s", prevMsg.Role)
	}
	if len(prevMsg.ToolCalls) == 0 {
		t.Fatalf("RoleAssistant deve conter as ToolCalls invocadas")
	}
	if prevMsg.ToolCalls[0].ThoughtSignature != "sig-react-test" {
		t.Errorf("ThoughtSignature não preservado: %q", prevMsg.ToolCalls[0].ThoughtSignature)
	}
}

// TestAgentLoop_NewSessionThreadIsolation_ZeroOldContext valida o isolamento estrito de conversas (AC-3).
func TestAgentLoop_NewSessionThreadIsolation_ZeroOldContext(t *testing.T) {
	tmpDir := t.TempDir()
	db, err := database.Open(filepath.Join(tmpDir, "test_isolation.db"))
	if err != nil {
		t.Fatalf("falha ao abrir db: %v", err)
	}
	defer db.Close()

	userRepo := repository.NewUserRepository(db)
	userID := "user-iso-1"
	_ = userRepo.Create(&domain.User{
		ID:        userID,
		Name:      "André",
		Email:     "andre@example.com",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})

	convRepo := repository.NewConversationStoreRepository(db)
	oldThread, _ := convRepo.GetOrCreateThread(context.Background(), userID, "app_mobile", "conv-old-100")
	// Popula a thread antiga com conversa sobre Poco X8 Pro Max
	_ = convRepo.CreateTurn(context.Background(), &repository.ConversationTurn{
		ID:        "turn-old-1",
		ThreadID:  oldThread.ID,
		UserID:    userID,
		Channel:   "app_mobile",
		Role:      "user",
		Content:   "Avaliação Poco X8 Pro Max",
		CreatedAt: time.Now().UTC().Add(-10 * time.Minute),
	})
	_ = convRepo.CreateTurn(context.Background(), &repository.ConversationTurn{
		ID:        "turn-old-2",
		ThreadID:  oldThread.ID,
		UserID:    userID,
		Channel:   "app_mobile",
		Role:      "assistant",
		Content:   "Existem vários blocos de foco agendados para amanhã.",
		CreatedAt: time.Now().UTC().Add(-9 * time.Minute),
	})

	mockResp := &ai.AgentChatResponse{
		Text:         "Olá! Em que posso te ajudar?",
		ProviderName: "mock-gemini",
		ModelName:    "gemini-2.5-flash",
	}
	mockProv := &mockLoopProvider{responses: []*ai.AgentChatResponse{mockResp}}
	router := ai.NewModelRouter(mockProv)
	guard := service.NewScopeGuard()
	gate := service.NewConfirmationGateService(db)
	registry := toolsets.NewToolsetsRegistry()

	loop := service.NewAgentLoop(router, registry, guard, gate, convRepo, nil)

	// Nova sessão com ID exclusivo "conv-new-200"
	req := domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: "conv-new-200",
		Channel:  "app_mobile",
		Message:  "Oi!",
	}

	_, err = loop.Run(context.Background(), req)
	if err != nil {
		t.Fatalf("falha ao rodar loop na nova sessão: %v", err)
	}

	if len(mockProv.historyReqs) == 0 {
		t.Fatal("esperava requisição gravada no mock")
	}

	sentMsgs := mockProv.historyReqs[0].Messages
	if len(sentMsgs) != 1 {
		t.Fatalf("nova sessão deve ter exatamente 1 mensagem (user), obteve %d", len(sentMsgs))
	}
	if sentMsgs[0].Content != "Oi!" {
		t.Errorf("mensagem incorreta: %s", sentMsgs[0].Content)
	}
}

// TestAgentLoop_PersonaRulesAndUserName valida o primeiro nome real e trava anti-chatbot (AC-5).
func TestAgentLoop_PersonaRulesAndUserName(t *testing.T) {
	tmpDir := t.TempDir()
	db, err := database.Open(filepath.Join(tmpDir, "test_persona.db"))
	if err != nil {
		t.Fatalf("falha ao abrir db: %v", err)
	}
	defer db.Close()

	userRepo := repository.NewUserRepository(db)
	userID := "user-persona-1"
	_ = userRepo.Create(&domain.User{
		ID:        userID,
		Name:      "André Victor Silva",
		Email:     "andre@example.com",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})

	aiSettingsRepo := repository.NewAISettingsRepository(db)
	_ = aiSettingsRepo.UpsertSettings(&domain.AISettings{
		UserID:       userID,
		AutonomyMode: domain.AutonomyModeAssisted,
		PersonaStyle: "direct",
	})

	convRepo := repository.NewConversationStoreRepository(db)
	mockResp := &ai.AgentChatResponse{
		Text:         "Resposta direta e concisa.",
		ProviderName: "mock-gemini",
		ModelName:    "gemini-2.5-flash",
	}
	mockProv := &mockLoopProvider{responses: []*ai.AgentChatResponse{mockResp}}
	router := ai.NewModelRouter(mockProv)
	guard := service.NewScopeGuard()
	gate := service.NewConfirmationGateService(db)
	registry := toolsets.NewToolsetsRegistry()

	loop := service.NewAgentLoop(router, registry, guard, gate, convRepo, nil)
	loop.SetUserRepositories(userRepo, aiSettingsRepo)

	req := domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: "conv-persona-100",
		Channel:  "app_mobile",
		Message:  "Notícias do dia",
	}

	res, err := loop.Run(context.Background(), req)
	if err != nil {
		t.Fatalf("falha ao rodar loop com persona: %v", err)
	}

	sysPrompt := mockProv.historyReqs[0].SystemPrompt
	if !strings.Contains(sysPrompt, "André") {
		t.Errorf("SystemPrompt deve conter o primeiro nome do usuário: %s", sysPrompt)
	}
	if !strings.Contains(sysPrompt, "Direto") {
		t.Errorf("SystemPrompt deve conter o estilo Direto configurado: %s", sysPrompt)
	}
	if !strings.Contains(sysPrompt, "ZERO CONTEXT DUMPING") {
		t.Errorf("SystemPrompt deve conter a diretriz de Zero Context Dumping")
	}
	if !strings.Contains(sysPrompt, "Anti-Chatbot") {
		t.Errorf("SystemPrompt deve conter a trava Anti-Chatbot")
	}
	if len(res.SuggestedActions) > 0 {
		t.Errorf("SuggestedActions não deve conter ações fixas hardcoded, obteve %v", res.SuggestedActions)
	}
}
