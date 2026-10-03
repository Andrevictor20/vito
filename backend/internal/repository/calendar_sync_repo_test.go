package repository_test

import (
	"database/sql"
	"testing"
	"time"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func setupSyncTestDB(t *testing.T) (*sql.DB, func()) {
	t.Helper()
	dbPath := ":memory:"
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("falha ao inicializar banco de teste: %v", err)
	}

	cleanup := func() {
		_ = db.Close()
	}
	return db, cleanup
}

func createTestUser(t *testing.T, db *sql.DB) string {
	t.Helper()
	userID := uuid.New().String()
	now := time.Now().UTC()
	_, err := db.Exec(
		"INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		userID, "Test User", userID+"@example.com", "hash", now, now,
	)
	if err != nil {
		t.Fatalf("falha ao criar usuário de teste: %v", err)
	}
	return userID
}

func createTestEvent(t *testing.T, db *sql.DB, userID string) string {
	t.Helper()
	eventID := uuid.New().String()
	now := time.Now().UTC()
	_, err := db.Exec(
		"INSERT INTO events (id, user_id, title, start_at, end_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		eventID, userID, "Reunião de Teste", now, now.Add(time.Hour), now, now,
	)
	if err != nil {
		t.Fatalf("falha ao criar evento de teste: %v", err)
	}
	return eventID
}

func TestCalendarSyncRepo_IntegrationLifecycle(t *testing.T) {
	db, cleanup := setupSyncTestDB(t)
	defer cleanup()

	repo := repository.NewCalendarSyncRepository(db)
	userID := createTestUser(t, db)

	now := time.Now().UTC().Truncate(time.Second)
	integration := &domain.CalendarIntegration{
		ID:                   uuid.New().String(),
		UserID:               userID,
		Provider:             domain.ProviderGoogle,
		AccountEmail:         "andre@gmail.com",
		EncryptedCredentials: "encrypted_secret_token",
		CalendarID:           "primary",
		CalendarName:         "Principal",
		SyncToken:            "sync_tok_v1",
		Status:               domain.IntegrationStatusActive,
		CreatedAt:            now,
		UpdatedAt:            now,
	}

	// 1. Inserir
	if err := repo.UpsertIntegration(integration); err != nil {
		t.Fatalf("falha ao inserir integração: %v", err)
	}

	// 2. Buscar
	got, err := repo.GetIntegration(userID, domain.ProviderGoogle)
	if err != nil {
		t.Fatalf("falha ao buscar integração: %v", err)
	}
	if got.AccountEmail != "andre@gmail.com" || got.SyncToken != "sync_tok_v1" {
		t.Fatalf("dados divergentes: %+v", got)
	}

	// 3. Atualizar (Upsert)
	integration.SyncToken = "sync_tok_v2"
	integration.Status = domain.IntegrationStatusReauthRequired
	if err := repo.UpsertIntegration(integration); err != nil {
		t.Fatalf("falha ao atualizar integração: %v", err)
	}

	gotUpdated, err := repo.GetIntegration(userID, domain.ProviderGoogle)
	if err != nil {
		t.Fatalf("falha ao buscar integração atualizada: %v", err)
	}
	if gotUpdated.SyncToken != "sync_tok_v2" || gotUpdated.Status != domain.IntegrationStatusReauthRequired {
		t.Fatalf("atualização não persistida: %+v", gotUpdated)
	}

	// 4. Listar
	list, err := repo.ListIntegrationsByUser(userID)
	if err != nil {
		t.Fatalf("falha ao listar integrações: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("esperava 1 integração, obteve %d", len(list))
	}

	// 5. Deletar
	if err := repo.DeleteIntegration(userID, domain.ProviderGoogle); err != nil {
		t.Fatalf("falha ao remover integração: %v", err)
	}

	_, err = repo.GetIntegration(userID, domain.ProviderGoogle)
	if err != domain.ErrIntegrationNotFound {
		t.Fatalf("esperava ErrIntegrationNotFound após deleção, obteve: %v", err)
	}
}

func TestCalendarSyncRepo_MappingLifecycle(t *testing.T) {
	db, cleanup := setupSyncTestDB(t)
	defer cleanup()

	repo := repository.NewCalendarSyncRepository(db)
	userID := createTestUser(t, db)
	eventID := createTestEvent(t, db, userID)

	now := time.Now().UTC().Truncate(time.Second)
	mapping := &domain.ExternalEventMapping{
		ID:              uuid.New().String(),
		EventID:         eventID,
		UserID:          userID,
		Provider:        domain.ProviderGoogle,
		ExternalEventID: "gcal_evt_998877",
		ExternalETag:    `"etag123"`,
		ContentHash:     "hash_sha256_abcd",
		LastSyncedAt:    now,
		Status:          "synced",
	}

	// 1. Inserir Mapping
	if err := repo.UpsertMapping(mapping); err != nil {
		t.Fatalf("falha ao inserir mapping: %v", err)
	}

	// 2. Buscar por External ID
	byExt, err := repo.GetMappingByExternalID(userID, domain.ProviderGoogle, "gcal_evt_998877")
	if err != nil {
		t.Fatalf("falha ao buscar por external ID: %v", err)
	}
	if byExt.EventID != eventID || byExt.ContentHash != "hash_sha256_abcd" {
		t.Fatalf("mapping divergente: %+v", byExt)
	}

	// 3. Buscar por Event ID
	byEvt, err := repo.GetMappingByEventID(eventID, domain.ProviderGoogle)
	if err != nil {
		t.Fatalf("falha ao buscar por event ID: %v", err)
	}
	if byEvt.ExternalEventID != "gcal_evt_998877" {
		t.Fatalf("external event id divergente: %+v", byEvt)
	}

	// 4. Deletar Mapping
	if err := repo.DeleteMapping(mapping.ID); err != nil {
		t.Fatalf("falha ao deletar mapping: %v", err)
	}

	_, err = repo.GetMappingByExternalID(userID, domain.ProviderGoogle, "gcal_evt_998877")
	if err != domain.ErrMappingNotFound {
		t.Fatalf("esperava ErrMappingNotFound, obteve %v", err)
	}
}

func TestCalendarSyncRepo_Tombstones(t *testing.T) {
	db, cleanup := setupSyncTestDB(t)
	defer cleanup()

	repo := repository.NewCalendarSyncRepository(db)
	userID := createTestUser(t, db)

	tombstone := &domain.CalendarTombstone{
		ID:              uuid.New().String(),
		UserID:          userID,
		Provider:        domain.ProviderAppleCalDAV,
		ExternalEventID: "apple_uid_445566",
		DeletedAt:       time.Now().UTC().Truncate(time.Second),
	}

	if err := repo.CreateTombstone(tombstone); err != nil {
		t.Fatalf("falha ao criar tombstone: %v", err)
	}

	list, err := repo.ListTombstones(userID, domain.ProviderAppleCalDAV)
	if err != nil {
		t.Fatalf("falha ao listar tombstones: %v", err)
	}
	if len(list) != 1 || list[0].ExternalEventID != "apple_uid_445566" {
		t.Fatalf("tombstone divergente: %+v", list)
	}

	if err := repo.DeleteTombstone(tombstone.ID); err != nil {
		t.Fatalf("falha ao deletar tombstone: %v", err)
	}

	listAfter, err := repo.ListTombstones(userID, domain.ProviderAppleCalDAV)
	if err != nil {
		t.Fatalf("falha ao listar tombstones após deleção: %v", err)
	}
	if len(listAfter) != 0 {
		t.Fatalf("esperava 0 tombstones, obteve %d", len(listAfter))
	}
}
