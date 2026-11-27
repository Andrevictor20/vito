package adkengine_test

import (
	"context"
	"encoding/json"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/bots"
	"github.com/andrevmp/vito/backend/internal/bots/catalog"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

func setupBotCreationHITLFixture(t *testing.T, provider *fakeADKLLM) (*adkengine.ADKLoopFacade, *bots.BotRepositorySQLite, *service.ConfirmationGateService, *repository.ConversationStoreRepository, string) {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "bot_hitl_reg.db"))
	if err != nil {
		t.Fatalf("falha ao abrir banco: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userID := "user-bot-hitl"
	userRepo := repository.NewUserRepository(db)
	if err := userRepo.Create(&domain.User{
		ID:        userID,
		Name:      "André",
		Email:     "bothitl@vito.local",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}); err != nil {
		t.Fatalf("falha ao criar usuário: %v", err)
	}

	aiSettingsRepo := repository.NewAISettingsRepository(db)
	_ = aiSettingsRepo.UpsertSettings(&domain.AISettings{
		UserID:       userID,
		AutonomyMode: domain.AutonomyModeAssisted,
	})

	convRepo := repository.NewConversationStoreRepository(db)
	confGate := service.NewConfirmationGateService(db)
	scopeGuard := service.NewScopeGuard()
	botRepo := bots.NewBotRepository(db)
	cat, _ := catalog.LoadDefaultCatalog()
	triggerSvc := bots.NewTriggerService(bots.NewTriggerRepository(db))

	botTS := bots.NewBotTriggerToolset(&testAC03TriggerSvc{svc: triggerSvc})
	botTS.SetBotRepository(botRepo, cat)

	reg := toolsets.NewToolsetsRegistry()
	reg.Register(botTS)

	facade, err := adkengine.NewADKLoopFacade(adkengine.FacadeConfig{
		ServerPool:       testServerPool("Fake-HITL-Bot", "gemini-2.5-flash", provider),
		Registry:         reg,
		ScopeGuard:       scopeGuard,
		ConfirmationGate: confGate,
		ConvRepo:         convRepo,
		UserRepo:         userRepo,
		AISettingsRepo:   aiSettingsRepo,
	})
	if err != nil {
		t.Fatalf("falha ao criar ADKLoopFacade: %v", err)
	}
	return facade, botRepo, confGate, convRepo, userID
}

// TestBotCreationHITL_RepeatedAttemptAndNaturalReplyPersistsNewBot garante que tentativas repetidas
// de criar bot sem confirmação prévia não sofrem colisão de idempotency_key e que resposta curta "beleza"
// confirma e persiste o bot mais recente via BotRepositorySQLite real.
func TestBotCreationHITL_RepeatedAttemptAndNaturalReplyPersistsNewBot(t *testing.T) {
	provider := &fakeADKLLM{
		model: "gemini-2.5-flash",
		responses: []scriptedModelResponse{
			{ToolCalls: []ai.ToolCall{{ID: "b1", Name: "bot_create_bot", Arguments: json.RawMessage(`{"title":"Bot Antigo","goal":"Dólar"}`)}}},
			{ToolCalls: []ai.ToolCall{{ID: "b2", Name: "bot_create_bot", Arguments: json.RawMessage(`{"title":"Monitor Poco X8 Pro","goal":"Acompanhar preço do Poco X8 Pro"}`)}}},
		},
	}

	facade, botRepo, _, convRepo, userID := setupBotCreationHITLFixture(t, provider)
	ctx := context.Background()
	threadID := "thread-bot-hitl-repeat"

	// Turno 1: cria 1ª pendência e não confirma (simula abandono anterior)
	r1, err := facade.Run(ctx, domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: threadID,
		Channel:  "app_mobile",
		Message:  "Crie um bot para monitorar dólar",
	})
	if err != nil {
		t.Fatalf("turno 1 falhou: %v", err)
	}
	if !r1.RequiresConfirmation || r1.PendingConfirmationID == "" {
		t.Fatalf("turno 1 deveria suspender com pending_confirmation_id preenchido, obteve %+v", r1)
	}

	// Turno 2: segunda tentativa na mesma thread — antes quebrava com UNIQUE constraint failed
	r2, err := facade.Run(ctx, domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: threadID,
		Channel:  "app_mobile",
		Message:  "Crie um bot para monitorar Poco X8 Pro",
	})
	if err != nil {
		t.Fatalf("turno 2 falhou: %v", err)
	}
	if !r2.RequiresConfirmation || r2.PendingConfirmationID == "" {
		t.Fatalf("turno 2 deveria suspender com novo pending_confirmation_id, obteve %+v", r2)
	}
	if r2.PendingConfirmationID == r1.PendingConfirmationID {
		t.Fatalf("turno 2 reutilizou o mesmo pending_confirmation_id antigo (%s)", r2.PendingConfirmationID)
	}
	var confirmCardID string
	for _, c := range r2.Cards {
		if c.Type == "confirm" {
			confirmCardID = c.ID
		}
	}
	if confirmCardID != r2.PendingConfirmationID {
		t.Fatalf("card confirm deveria carregar id=%q, obteve %q", r2.PendingConfirmationID, confirmCardID)
	}

	turns, err := convRepo.ListTurnsByThread(ctx, threadID, 10)
	if err != nil {
		t.Fatalf("falha ao listar turnos: %v", err)
	}
	if len(turns) < 4 {
		t.Fatalf("esperava turnos suspensos persistidos em conversation_turns (>=4), obteve %d", len(turns))
	}

	// Turno 3: confirmação natural curta "beleza" deve criar "Monitor Poco X8 Pro"
	r3, err := facade.Run(ctx, domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: threadID,
		Channel:  "app_mobile",
		Message:  "beleza",
	})
	if err != nil {
		t.Fatalf("turno 3 (confirmação 'beleza') falhou: %v", err)
	}
	if r3.Trigger == nil || r3.Trigger.Title != "Monitor Poco X8 Pro" {
		t.Fatalf("esperava Trigger criado para 'Monitor Poco X8 Pro', obteve %+v (resp=%+v)", r3.Trigger, r3)
	}

	persisted, err := botRepo.ListByUser(ctx, userID)
	if err != nil {
		t.Fatalf("ListByUser falhou: %v", err)
	}
	if len(persisted) != 1 || persisted[0].Title != "Monitor Poco X8 Pro" || len(persisted[0].Actions) == 0 {
		t.Fatalf("esperava 1 bot persistido chamado 'Monitor Poco X8 Pro' com actions, obteve %+v", persisted)
	}
}

// TestBotCreationHITL_ExpiredConfirmPendingIDReturnsErrorNotFallbackLLM garante que clique em card
// expirado retorna ErrConfirmationExpired sem cair no LLM com mensagem vazia ("Olá").
func TestBotCreationHITL_ExpiredConfirmPendingIDReturnsErrorNotFallbackLLM(t *testing.T) {
	provider := &fakeADKLLM{
		model: "gemini-2.5-flash",
	}

	facade, _, confGate, convRepo, userID := setupBotCreationHITLFixture(t, provider)
	ctx := context.Background()
	threadID := "thread-expired-confirm"
	_, _ = convRepo.GetOrCreateThread(ctx, userID, "app_mobile", threadID)

	expired, err := confGate.CreatePending(ctx, &service.CreatePendingRequest{
		UserID:        userID,
		ThreadID:      threadID,
		Channel:       "app_mobile",
		ToolsetName:   string(domain.ToolsetBots),
		Operation:     "create_trigger",
		ArgumentsJSON: `{"title":"Bot Expirado","goal":"Teste"}`,
		TTL:           -1 * time.Second,
	})
	if err != nil {
		t.Fatalf("falha ao criar pendência expirada: %v", err)
	}

	_, runErr := facade.Run(ctx, domain.UnifiedAssistantRequest{
		UserID:           userID,
		ThreadID:         threadID,
		Channel:          "app_mobile",
		ConfirmPendingID: expired.ID,
	})
	if !errors.Is(runErr, service.ErrConfirmationExpired) {
		t.Fatalf("esperava ErrConfirmationExpired ao confirmar pendência expirada, obteve %v", runErr)
	}
	if len(provider.capturedReqs) != 0 {
		t.Fatalf("não deveria ter chamado o LLM após erro em ConfirmPendingID, chamou %d vez(es)", len(provider.capturedReqs))
	}
}
