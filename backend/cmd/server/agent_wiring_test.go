package main

import (
	"context"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/config"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

type mockEvoClientWiring struct {
	sentInstance string
	sentTo       string
	sentText     string
}

func (m *mockEvoClientWiring) CreateInstance(ctx context.Context, instanceName, phone string) error {
	return nil
}
func (m *mockEvoClientWiring) SetWebhook(ctx context.Context, instanceName, webhookURL string) error {
	return nil
}
func (m *mockEvoClientWiring) SetSettings(ctx context.Context, instanceName string, settings map[string]interface{}) error {
	return nil
}
func (m *mockEvoClientWiring) GetPairingCode(ctx context.Context, instanceName, phone string) (string, error) {
	return "1234", nil
}
func (m *mockEvoClientWiring) GetConnectionState(ctx context.Context, instanceName string) (string, error) {
	return "open", nil
}
func (m *mockEvoClientWiring) DeleteInstance(ctx context.Context, instanceName string) error {
	return nil
}
func (m *mockEvoClientWiring) Logout(ctx context.Context, instanceName string) error {
	return nil
}
func (m *mockEvoClientWiring) SendText(ctx context.Context, instanceName, to, text string) error {
	m.sentInstance = instanceName
	m.sentTo = to
	m.sentText = text
	return nil
}
func (m *mockEvoClientWiring) SendTextWithQuoted(ctx context.Context, instanceName, to, text, quotedID string) error {
	return m.SendText(ctx, instanceName, to, text)
}
func (m *mockEvoClientWiring) GetMediaBase64(ctx context.Context, instanceName string, messagePayload interface{}) (string, error) {
	return "", nil
}
func (m *mockEvoClientWiring) FindContacts(ctx context.Context, instanceName string) ([]service.WhatsAppContact, error) {
	return nil, nil
}
func (m *mockEvoClientWiring) SendReaction(ctx context.Context, instanceName, remoteJid, messageID, reaction string, fromMe bool) error {
	return nil
}
func (m *mockEvoClientWiring) FindMessages(ctx context.Context, in service.EvolutionFindMessagesInput) ([]service.WhatsAppChatMessage, error) {
	return nil, nil
}
func (m *mockEvoClientWiring) FindGroups(ctx context.Context, instanceName string) ([]service.WhatsAppGroup, error) {
	return nil, nil
}
func (m *mockEvoClientWiring) FindParticipants(ctx context.Context, instanceName, groupJid string) ([]string, error) {
	return nil, nil
}
func (m *mockEvoClientWiring) FindOwnerJID(ctx context.Context, instanceName string) (string, error) {
	return "5511988887777@s.whatsapp.net", nil
}

type mockSyncedRepoWiring struct {
	contacts []domain.SyncedContact
}

func (m *mockSyncedRepoWiring) UpsertBatch(ctx context.Context, contacts []domain.SyncedContact) (int64, error) {
	m.contacts = append(m.contacts, contacts...)
	return int64(len(contacts)), nil
}
func (m *mockSyncedRepoWiring) ListByUserID(ctx context.Context, userID string) ([]domain.SyncedContact, error) {
	return m.contacts, nil
}
func (m *mockSyncedRepoWiring) ListAll(ctx context.Context) ([]domain.SyncedContact, error) {
	return m.contacts, nil
}
func (m *mockSyncedRepoWiring) FindByNameOrPhone(ctx context.Context, userID, query string) ([]domain.SyncedContact, error) {
	var out []domain.SyncedContact
	for _, c := range m.contacts {
		if strings.Contains(strings.ToLower(c.SavedName), strings.ToLower(query)) ||
			(c.PhoneDigits != "" && strings.Contains(c.PhoneDigits, query)) {
			out = append(out, c)
		}
	}
	return out, nil
}
func (m *mockSyncedRepoWiring) GetByJIDOrLID(ctx context.Context, userID, identifier string) (*domain.SyncedContact, error) {
	if len(m.contacts) > 0 {
		return &m.contacts[0], nil
	}
	return nil, nil
}

func TestWhatsAppServiceAdapter_SendMessage_ResolvesContactName(t *testing.T) {
	tmpDir := t.TempDir()
	db, err := database.Open(filepath.Join(tmpDir, "wiring_test.db"))
	if err != nil {
		t.Fatalf("falha ao abrir db: %v", err)
	}
	defer db.Close()

	userID := "user-wire-1"
	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{
		ID:           userID,
		Name:         "Usuário Teste",
		Email:        "user-wire@example.com",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	})

	waRepo := repository.NewWhatsAppRepository(db)
	now := time.Now().UTC()
	_ = waRepo.Upsert(context.Background(), &domain.WhatsAppIntegration{
		UserID:          userID,
		InstanceName:    "inst-test",
		Phone:           "5511988887777",
		Status:          domain.WhatsAppStatusConnected,
		LastConnectedAt: &now,
		CreatedAt:       now,
		UpdatedAt:       now,
	})

	mockClient := &mockEvoClientWiring{}
	waSvc := service.NewWhatsAppService(service.WhatsAppServiceConfig{
		WebhookBaseURL: "https://vito.rasppi.cloud",
	}, waRepo, mockClient, nil)

	contactRepo := &mockSyncedRepoWiring{
		contacts: []domain.SyncedContact{
			{
				UserID:      userID,
				SavedName:   "Carlos Silva",
				Phone:       "+5511999998888",
				PhoneDigits: "5511999998888",
			},
		},
	}
	dir := service.NewWhatsAppDirectoryService(nil, service.DefaultWhatsAppContextConfig(), nil)
	dir.SetContactRepository(contactRepo)

	adapter := &whatsAppServiceAdapter{
		svc: waSvc,
		dir: dir,
	}

	// 1. Envio por nome de contato ("Carlos")
	err = adapter.SendMessage(context.Background(), userID, "Carlos", "Olá Carlos!")
	if err != nil {
		t.Fatalf("falha ao enviar para Carlos por nome: %v", err)
	}
	if mockClient.sentTo != "5511999998888@s.whatsapp.net" {
		t.Errorf("esperava destino resolvido 5511999998888@s.whatsapp.net, obteve %q", mockClient.sentTo)
	}
	if mockClient.sentText != "Olá Carlos!" {
		t.Errorf("texto incorreto: %q", mockClient.sentText)
	}

	// 2. Envio por telefone com pontuação ("(11) 98765-4321")
	err = adapter.SendMessage(context.Background(), userID, "(11) 98765-4321", "Teste telefone")
	if err != nil {
		t.Fatalf("falha ao enviar por telefone com DDD: %v", err)
	}
	if mockClient.sentTo != "5511987654321@s.whatsapp.net" {
		t.Errorf("esperava normalização para 5511987654321@s.whatsapp.net, obteve %q", mockClient.sentTo)
	}

	// 3. Contato inexistente
	err = adapter.SendMessage(context.Background(), userID, "Fantasma Desconhecido", "Oi")
	if err == nil {
		t.Fatal("esperava erro ao tentar enviar para contato inexistente")
	}
	if !strings.Contains(err.Error(), "não encontrado") {
		t.Errorf("esperava mensagem amigável de contato não encontrado, obteve: %v", err)
	}
}

func TestProductionCognitiveWiring_Onda2AndOnda3(t *testing.T) {
	ctx := context.Background()
	db, err := database.Open(filepath.Join(t.TempDir(), "prod_wiring.db"))
	if err != nil {
		t.Fatalf("database.Open: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()
	userRepo := repository.NewUserRepository(db)
	userID := "u-prod-wire-1"
	_ = userRepo.Create(&domain.User{
		ID: userID, Name: "Prod Wire", Email: "prodwire@vito.test", CreatedAt: now, UpdatedAt: now,
	})

	eventRepo := repository.NewEventRepository(db)
	todoRepo := repository.NewTodoRepository(db)
	memoryRepo := repository.NewMemoryRepository(db)
	aiSettingsRepo := repository.NewAISettingsRepository(db)
	triggerRepo := repository.NewTriggerRepository(db)
	briefingRepo := repository.NewBriefingRepository(db)
	pendingRepo := repository.NewPendingRepository(db)
	notifRepo := repository.NewDeviceTokenRepository(db)
	finRepo := repository.NewFinanceRepository(db)
	waRepo := repository.NewWhatsAppRepository(db)

	calSvc := service.NewCalendarService(eventRepo)
	todoSvc := service.NewTodoService(todoRepo)
	triggerSvc := service.NewTriggerService(triggerRepo)
	pendingSvc := service.NewPendingService(pendingRepo)
	notifSvc := service.NewNotificationService(notifRepo)
	waSvc := service.NewWhatsAppService(service.WhatsAppServiceConfig{}, waRepo, &mockEvoClientWiring{}, nil)

	agentSys := setupAgentSubsystem(
		&config.Config{}, db, calSvc, todoSvc, waSvc, nil,
		userRepo, aiSettingsRepo, triggerSvc, nil, memoryRepo,
	)
	if agentSys == nil || agentSys.ADKFacade == nil || agentSys.EntityLinkRepo == nil || agentSys.ContextEnricher == nil || agentSys.AIProviderHandler == nil || agentSys.AIProviderSvc == nil {
		t.Fatalf("setupAgentSubsystem não inicializou dependências esperadas: %+v", agentSys)
	}
	defer agentSys.TraceRecorder.Close()
	defer agentSys.ConsolidationWorker.Stop()

	reminderWorker := service.NewReminderWorker(eventRepo, notifSvc, 15*time.Minute)
	triggerWorker := service.NewTriggerWorker(triggerRepo, notifSvc, &service.DefaultTriggerEvaluator{}, time.Minute)
	morningWorker := service.NewMorningBriefingWorker(briefingRepo, eventRepo, todoRepo, userRepo, notifSvc, time.Minute)
	behavioralWorker := service.NewBehavioralWorker(todoRepo, eventRepo, memoryRepo)

	cogRes := wireCognitiveRuntime(CognitiveRuntimeConfig{
		DB: db, EventRepo: eventRepo, NotifSvc: notifSvc, PendingSvc: pendingSvc,
		ReminderWorker: reminderWorker, TriggerWorker: triggerWorker,
		MorningBriefingWorker: morningWorker, BehavioralWorker: behavioralWorker, AgentSys: agentSys,
	})
	if cogRes.BudgetSvc == nil || cogRes.WorkflowRunner == nil {
		t.Fatalf("wireCognitiveRuntime deveria inicializar BudgetSvc e WorkflowRunner: %+v", cogRes)
	}

	// Verifica que FinanceSnapshotProvider e EntityLinkRepository estão conectados em produção
	_ = finRepo.UpsertConnection(ctx, &domain.FinanceConnection{
		ID: "c-wire", UserID: userID, PluggyItemID: "item-wire", ConnectorID: 200, InstitutionName: "Itaú", Status: domain.ConnectionStatusUpdated,
	})
	_ = finRepo.UpsertAccountsBatch(ctx, userID, []domain.FinanceAccount{
		{ID: "a-wire", UserID: userID, ConnectionID: "c-wire", PluggyAccountID: "pa-w", AccountType: domain.AccountTypeBank, Name: "Conta Itaú", InstitutionName: "Itaú", Balance: 4200.00},
	})

	if _, err := todoSvc.CreateTodoWithOptions(userID, domain.CreateTodoInput{
		Title: "Preparar apresentação", EventID: "evt-wire-1", EventTitle: "Board Review",
	}); err != nil {
		t.Fatalf("CreateTodoWithOptions: %v", err)
	}
	if _, err := pendingSvc.CreatePending(userID, domain.CreatePendingInput{
		Title: "Revisar contrato", ScheduledDate: "2026-12-05",
	}); err != nil {
		t.Fatalf("CreatePending: %v", err)
	}

	agentSys.ContextEnricher.SetLevel1Timeout(3 * time.Second)
	lvl1 := agentSys.ContextEnricher.BuildLevel1Context(ctx, userID, "Qual meu saldo para o Board Review?", now)
	if !strings.Contains(lvl1, "Conta Itaú: R$ 4200.00") {
		t.Errorf("esperava FinanceSnapshotProvider conectado no BuildLevel1Context, obteve:\n%s", lvl1)
	}
	if !strings.Contains(lvl1, "Board Review") {
		t.Errorf("esperava EntityLinkRepository conectado no BuildLevel1Context, obteve:\n%s", lvl1)
	}
}
