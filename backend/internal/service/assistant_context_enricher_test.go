package service_test

import (
	"context"
	"github.com/andrevmp/vito/backend/internal/bots"
	"github.com/andrevmp/vito/backend/internal/calendar"
	"github.com/andrevmp/vito/backend/internal/tasks"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/google/uuid"
)

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

	eventRepo := calendar.NewEventRepository(db)
	calSvc := calendar.NewCalendarService(eventRepo)
	now := time.Now()
	_, _, _ = calSvc.CreateEvent(userID, "Reunião de Arquitetura", "Alinhamento com time", "Sala 2", now.Add(2*time.Hour), now.Add(3*time.Hour))

	todoRepo := tasks.NewTodoRepository(db)
	todoSvc := tasks.NewTodoService(todoRepo)
	_, _ = todoSvc.CreateTodo(userID, "Revisar PR de IA", "high", nil)

	triggerRepo := bots.NewTriggerRepository(db)
	triggerSvc := bots.NewTriggerService(triggerRepo)
	_ = triggerRepo.Create(&domain.Trigger{
		ID:        uuid.New().String(),
		UserID:    userID,
		Title:     "Cotação Dólar",
		Category:  domain.CategoryFinance,
		Status:    domain.TriggerStatusActive,
		Frequency: domain.FrequencyDailyMorning,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
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

	enricherEngine := &mockEnricherEngine{
		enricher: enricher,
	}

	req := domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: "thread-enrich-1",
		Channel:  "app_mobile",
		Message:  "Olá Vito",
	}

	res, err := enricherEngine.Run(context.Background(), req)
	if err != nil {
		t.Fatalf("falha ao rodar engine: %v", err)
	}
	if res.Text != "Entendido perfeitamente." {
		t.Errorf("resposta inesperada: %s", res.Text)
	}

	if len(enricherEngine.capturedPrompts) == 0 {
		t.Fatalf("nenhum prompt capturado na engine")
	}

	sysPrompt := enricherEngine.capturedPrompts[0]
	if !strings.Contains(sysPrompt, "CONTEXTO PESSOAL E OPERACIONAL DO USUÁRIO (NÍVEL 1)") {
		t.Errorf("SystemPrompt deve conter o contexto de Nível 1: %s", sysPrompt)
	}
	if !strings.Contains(sysPrompt, "Engenheiro Chefe") {
		t.Errorf("SystemPrompt deve conter o perfil injetado: %s", sysPrompt)
	}
}

type mockEnricherEngine struct {
	enricher        *service.AssistantContextEnricher
	capturedPrompts []string
}

func (m *mockEnricherEngine) Run(ctx context.Context, req domain.UnifiedAssistantRequest) (*domain.UnifiedAssistantResponse, error) {
	lvl1 := m.enricher.BuildLevel1Context(ctx, req.UserID, req.Message, time.Now())
	m.capturedPrompts = append(m.capturedPrompts, lvl1)
	const reply = "Entendido perfeitamente."
	return &domain.UnifiedAssistantResponse{
		ThreadID: req.ThreadID,
		Text:     reply,
		Reply:    reply,
		Message:  reply,
	}, nil
}

func (m *mockEnricherEngine) RunStream(ctx context.Context, req domain.UnifiedAssistantRequest, _ func(ai.StreamDelta) error) (*domain.UnifiedAssistantResponse, error) {
	return m.Run(ctx, req)
}
