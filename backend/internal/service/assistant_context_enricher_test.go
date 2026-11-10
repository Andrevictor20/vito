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
	"github.com/google/uuid"
)

type mockLoopEnricherProvider struct {
	historyReqs []ai.AgentChatRequest
}

func (m *mockLoopEnricherProvider) Name() string          { return "mock-enricher-provider" }
func (m *mockLoopEnricherProvider) ModelName() string     { return "gemini-2.5-flash" }
func (m *mockLoopEnricherProvider) QualityTier() int      { return 3 }
func (m *mockLoopEnricherProvider) SupportsTools() bool   { return true }
func (m *mockLoopEnricherProvider) SupportsVision() bool  { return true }
func (m *mockLoopEnricherProvider) MaxContextTokens() int { return 8192 }

func (m *mockLoopEnricherProvider) Chat(ctx context.Context, req ai.AgentChatRequest) (*ai.AgentChatResponse, error) {
	m.historyReqs = append(m.historyReqs, req)
	return &ai.AgentChatResponse{
		Text:         "Entendido perfeitamente.",
		ProviderName: m.Name(),
		ModelName:    m.ModelName(),
	}, nil
}

func (m *mockLoopEnricherProvider) StreamChat(ctx context.Context, req ai.AgentChatRequest, onDelta func(ai.StreamDelta) error) (*ai.AgentChatResponse, error) {
	return m.Chat(ctx, req)
}

func TestAssistantContextEnricher_BuildLevel1Context(t *testing.T) {
	tmpDir := t.TempDir()
	db, err := database.Open(filepath.Join(tmpDir, "enricher_test.db"))
	if err != nil {
		t.Fatalf("falha ao abrir db: %v", err)
	}
	defer db.Close()

	userID := "user-enricher-1"
	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{
		ID:        userID,
		Name:      "André Victor",
		Email:     "andre@example.com",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})

	coreProfileRepo := repository.NewCoreProfileRepository(db)
	_ = coreProfileRepo.Set(userID, "Profissão", "Arquiteto de Software na Helical")
	_ = coreProfileRepo.Set(userID, "Preferência Café", "Sem açúcar")

	memRepo := repository.NewMemoryRepository(db)
	_ = memRepo.Create(&domain.Memory{
		ID:         uuid.New().String(),
		UserID:     userID,
		Category:   "hábito",
		Content:    "Costuma treinar às 18h de segunda a sexta",
		Importance: 4,
		Confidence: 1.0,
		CreatedAt:  time.Now().UTC(),
		UpdatedAt:  time.Now().UTC(),
	})

	eventRepo := repository.NewEventRepository(db)
	calSvc := service.NewCalendarService(eventRepo)
	now := time.Now()
	_, _, _ = calSvc.CreateEvent(userID, "Reunião de Arquitetura", "Alinhamento com time", "Sala 2", now.Add(2*time.Hour), now.Add(3*time.Hour))

	todoRepo := repository.NewTodoRepository(db)
	todoSvc := service.NewTodoService(todoRepo)
	_, _ = todoSvc.CreateTodo(userID, "Revisar PR de IA", "high", nil)

	triggerRepo := repository.NewTriggerRepository(db)
	triggerSvc := service.NewTriggerService(triggerRepo)
	_ = triggerRepo.Create(&domain.Trigger{
		ID:         uuid.New().String(),
		UserID:     userID,
		Title:      "Cotação Dólar",
		Category:   domain.CategoryFinance,
		Status:     domain.TriggerStatusActive,
		Frequency:  domain.FrequencyDailyMorning,
		CreatedAt:  time.Now().UTC(),
		UpdatedAt:  time.Now().UTC(),
	})

	aiSettingsRepo := repository.NewAISettingsRepository(db)

	enricher := service.NewAssistantContextEnricher(
		userRepo,
		aiSettingsRepo,
		coreProfileRepo,
		memRepo,
		calSvc,
		todoSvc,
		triggerSvc,
	)

	ctx := context.Background()
	lvl1 := enricher.BuildLevel1Context(ctx, userID, "Como é minha rotina de treinar?", now)

	if !strings.Contains(lvl1, "CONTEXTO PESSOAL E OPERACIONAL DO USUÁRIO (NÍVEL 1)") {
		t.Errorf("deve conter cabeçalho de Nível 1: %s", lvl1)
	}
	if !strings.Contains(lvl1, "Arquiteto de Software") {
		t.Errorf("deve conter profissão do perfil: %s", lvl1)
	}
	if !strings.Contains(lvl1, "treinar às 18h") {
		t.Errorf("deve conter memória relevante sobre treinar: %s", lvl1)
	}
	if !strings.Contains(lvl1, "Reunião de Arquitetura") {
		t.Errorf("deve conter compromisso da agenda: %s", lvl1)
	}
	if !strings.Contains(lvl1, "Revisar PR de IA") {
		t.Errorf("deve conter tarefa pendente prioritária: %s", lvl1)
	}
	if !strings.Contains(lvl1, "Cotação Dólar") {
		t.Errorf("deve conter radar ativo: %s", lvl1)
	}
}

func TestAgentLoop_ContextEnricherInjected(t *testing.T) {
	tmpDir := t.TempDir()
	db, err := database.Open(filepath.Join(tmpDir, "loop_enricher.db"))
	if err != nil {
		t.Fatalf("falha ao abrir db: %v", err)
	}
	defer db.Close()

	userID := "user-loop-enrich-100"
	coreProfileRepo := repository.NewCoreProfileRepository(db)
	_ = coreProfileRepo.Set(userID, "Cargo", "Engenheiro Chefe")

	userRepo := repository.NewUserRepository(db)
	aiSettingsRepo := repository.NewAISettingsRepository(db)
	memRepo := repository.NewMemoryRepository(db)

	enricher := service.NewAssistantContextEnricher(
		userRepo,
		aiSettingsRepo,
		coreProfileRepo,
		memRepo,
		nil,
		nil,
		nil,
	)

	mockProv := &mockLoopEnricherProvider{}
	router := ai.NewModelRouter(mockProv)
	guard := service.NewScopeGuard()
	gate := service.NewConfirmationGateService(db)
	registry := toolsets.NewToolsetsRegistry()
	convRepo := repository.NewConversationStoreRepository(db)

	loop := service.NewAgentLoop(router, registry, guard, gate, convRepo, nil)
	loop.SetContextEnricher(enricher)

	req := domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: "thread-enrich-1",
		Channel:  "app_mobile",
		Message:  "Olá Vito",
	}

	res, err := loop.Run(context.Background(), req)
	if err != nil {
		t.Fatalf("falha ao rodar loop: %v", err)
	}
	if res.Text != "Entendido perfeitamente." {
		t.Errorf("resposta inesperada: %s", res.Text)
	}

	if len(mockProv.historyReqs) == 0 {
		t.Fatalf("nenhuma requisição registrada no provider")
	}

	sysPrompt := mockProv.historyReqs[0].SystemPrompt
	if !strings.Contains(sysPrompt, "CONTEXTO PESSOAL E OPERACIONAL DO USUÁRIO (NÍVEL 1)") {
		t.Errorf("SystemPrompt deve conter o contexto de Nível 1: %s", sysPrompt)
	}
	if !strings.Contains(sysPrompt, "Engenheiro Chefe") {
		t.Errorf("SystemPrompt deve conter o perfil injetado: %s", sysPrompt)
	}
}
