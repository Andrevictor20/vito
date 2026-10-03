package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/integrations/calendar"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

type mockProvider struct {
	name                  string
	fetchResult           *calendar.SyncResult
	fetchErr              error
	createdItems          []*domain.Event
	updatedItems          []*domain.Event
	deletedEvents         []string
	lastCreatedExternalID string
}

func (m *mockProvider) Name() string { return m.name }
func (m *mockProvider) FetchEvents(ctx context.Context, credentials, calendarID, syncToken string, from, to time.Time) (*calendar.SyncResult, error) {
	if m.fetchErr != nil {
		return nil, m.fetchErr
	}
	if m.fetchResult != nil {
		return m.fetchResult, nil
	}
	return &calendar.SyncResult{Items: []calendar.SyncItem{}}, nil
}
func (m *mockProvider) CreateEvent(ctx context.Context, credentials, calendarID string, event *domain.Event) (*calendar.SyncItem, error) {
	m.createdItems = append(m.createdItems, event)
	m.lastCreatedExternalID = "ext-" + uuid.New().String()
	return &calendar.SyncItem{
		ExternalID: m.lastCreatedExternalID,
		ETag:       `"mock-etag"`,
		Title:      event.Title,
		StartAt:    event.StartAt,
		EndAt:      event.EndAt,
		Status:     "confirmed",
	}, nil
}
func (m *mockProvider) UpdateEvent(ctx context.Context, credentials, calendarID, externalID string, event *domain.Event) (*calendar.SyncItem, error) {
	m.updatedItems = append(m.updatedItems, event)
	return &calendar.SyncItem{
		ExternalID: externalID,
		ETag:       `"mock-etag-updated"`,
		Title:      event.Title,
		StartAt:    event.StartAt,
		EndAt:      event.EndAt,
		Status:     "confirmed",
	}, nil
}
func (m *mockProvider) DeleteEvent(ctx context.Context, credentials, calendarID, externalID string) error {
	m.deletedEvents = append(m.deletedEvents, externalID)
	return nil
}
func (m *mockProvider) RefreshToken(ctx context.Context, credentials string) (string, error) {
	return credentials, nil
}

func setupServiceTest(t *testing.T) (*service.CalendarSyncService, domain.EventRepository, domain.CalendarSyncRepository, string) {
	t.Helper()
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("falha ao abrir banco in-memory: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	eventRepo := repository.NewEventRepository(db)
	syncRepo := repository.NewCalendarSyncRepository(db)
	encKey := "test-encryption-key-32-chars-long"

	userID := uuid.New().String()
	now := time.Now().UTC()
	_, _ = db.Exec("INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		userID, "User", userID+"@test.com", "hash", now, now)

	svc := service.NewCalendarSyncService(syncRepo, eventRepo, encKey)
	return svc, eventRepo, syncRepo, userID
}

func TestCalendarSyncService_ConnectAndList(t *testing.T) {
	svc, _, _, userID := setupServiceTest(t)

	integ, err := svc.ConnectIntegration(context.Background(), userID, domain.ProviderGoogle, "user@gmail.com", "raw-token", "primary", "Agenda Principal")
	if err != nil {
		t.Fatalf("falha ao conectar integração: %v", err)
	}

	if integ.AccountEmail != "user@gmail.com" || integ.Status != domain.IntegrationStatusActive {
		t.Fatalf("integração incorreta: %+v", integ)
	}

	list, err := svc.ListIntegrations(context.Background(), userID)
	if err != nil {
		t.Fatalf("falha ao listar integrações: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("esperava 1 integração, obteve %d", len(list))
	}
}

func TestCalendarSyncService_InboundSync_ImportsNewEvent(t *testing.T) {
	svc, eventRepo, _, userID := setupServiceTest(t)

	mockG := &mockProvider{
		name: domain.ProviderGoogle,
		fetchResult: &calendar.SyncResult{
			NewSyncToken: "tok-v2",
			Items: []calendar.SyncItem{
				{
					ExternalID:  "remote-evt-100",
					Title:       "Reunião com Investidor",
					Description: "Apresentar métricas Q4",
					Location:    "Zoom",
					StartAt:     time.Date(2026, 10, 8, 10, 0, 0, 0, time.UTC),
					EndAt:       time.Date(2026, 10, 8, 11, 0, 0, 0, time.UTC),
					Status:      "confirmed",
				},
			},
		},
	}
	svc.RegisterProvider(mockG)

	_, _ = svc.ConnectIntegration(context.Background(), userID, domain.ProviderGoogle, "user@gmail.com", "tok", "primary", "Principal")

	if err := svc.SyncIntegration(context.Background(), userID, domain.ProviderGoogle); err != nil {
		t.Fatalf("falha ao sincronizar: %v", err)
	}

	events, err := eventRepo.ListByUser(userID, time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, 10, 31, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("falha ao listar eventos do usuário: %v", err)
	}

	if len(events) != 1 {
		t.Fatalf("esperava 1 evento importado, obteve %d", len(events))
	}
	if events[0].Title != "Reunião com Investidor" || events[0].Source != domain.ProviderGoogle {
		t.Errorf("dados de evento importado incorretos: %+v", events[0])
	}
}

func TestCalendarSyncService_EchoSuppression_IgnoresIdenticalPayload(t *testing.T) {
	svc, eventRepo, _, userID := setupServiceTest(t)

	mockG := &mockProvider{name: domain.ProviderGoogle}
	svc.RegisterProvider(mockG)

	_, _ = svc.ConnectIntegration(context.Background(), userID, domain.ProviderGoogle, "user@gmail.com", "tok", "primary", "Principal")

	// 1. Vito cria e faz push do evento
	startAt := time.Date(2026, 10, 9, 14, 0, 0, 0, time.UTC)
	endAt := time.Date(2026, 10, 9, 15, 0, 0, 0, time.UTC)
	evt := &domain.Event{
		ID:        uuid.New().String(),
		UserID:    userID,
		Title:     "Almoço com Time",
		StartAt:   startAt,
		EndAt:     endAt,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	_ = eventRepo.Create(evt)

	if err := svc.PushEvent(context.Background(), userID, evt); err != nil {
		t.Fatalf("falha ao fazer push de evento: %v", err)
	}

	if len(mockG.createdItems) != 1 {
		t.Fatalf("esperava 1 evento criado no mock, obteve %d", len(mockG.createdItems))
	}

	// 2. Simula retorno do webhook/pull trazendo exatamente o mesmo evento
	extID := mockG.lastCreatedExternalID
	mockG.fetchResult = &calendar.SyncResult{
		Items: []calendar.SyncItem{
			{
				ExternalID: extID,
				Title:      "Almoço com Time",
				StartAt:    startAt,
				EndAt:      endAt,
				Status:     "confirmed",
			},
		},
	}

	// 3. Executa SyncIntegration e verifica que o evento NÃO foi re-escrito/duplicado
	if err := svc.SyncIntegration(context.Background(), userID, domain.ProviderGoogle); err != nil {
		t.Fatalf("falha na sincronização: %v", err)
	}

	events, _ := eventRepo.ListByUser(userID, startAt.Add(-time.Hour), endAt.Add(time.Hour))
	if len(events) != 1 {
		t.Fatalf("esperava manter exatamente 1 evento (sem duplicação por eco), obteve %d", len(events))
	}
}

func TestCalendarSyncService_DeletePropagation(t *testing.T) {
	svc, eventRepo, syncRepo, userID := setupServiceTest(t)

	mockG := &mockProvider{name: domain.ProviderGoogle}
	svc.RegisterProvider(mockG)

	_, _ = svc.ConnectIntegration(context.Background(), userID, domain.ProviderGoogle, "user@gmail.com", "tok", "primary", "Principal")

	evt := &domain.Event{
		ID:        uuid.New().String(),
		UserID:    userID,
		Title:     "Reunião a ser Deletada",
		StartAt:   time.Now().UTC(),
		EndAt:     time.Now().Add(time.Hour).UTC(),
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	_ = eventRepo.Create(evt)
	_ = svc.PushEvent(context.Background(), userID, evt)

	// Deleta o evento pelo Vito
	if err := svc.DeleteEvent(context.Background(), userID, evt.ID); err != nil {
		t.Fatalf("falha ao deletar evento pelo serviço: %v", err)
	}

	if len(mockG.deletedEvents) != 1 {
		t.Fatalf("esperava deleção propagada para o Google, obteve %d", len(mockG.deletedEvents))
	}

	// Verifica se mapping foi removido
	_, err := syncRepo.GetMappingByEventID(evt.ID, domain.ProviderGoogle)
	if err != domain.ErrMappingNotFound {
		t.Fatalf("mapping deveria ter sido removido, obteve: %v", err)
	}
}
