package repository_test

import (
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func setupCalendarTestDB(t *testing.T) (*repository.EventRepositorySQLite, *repository.UserRepositorySQLite, *sql.DB) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_kito_cal.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	eventRepo := repository.NewEventRepository(db)

	// Cria usuário base para respeitar chave estrangeira
	_ = userRepo.Create(&domain.User{
		ID:           "user-cal-1",
		Name:         "User Cal",
		Email:        "cal@example.com",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	})

	return eventRepo, userRepo, db
}

func TestEventRepository_CreateAndCheckConflict(t *testing.T) {
	eventRepo, _, _ := setupCalendarTestDB(t)

	now := time.Date(2026, 9, 26, 14, 0, 0, 0, time.UTC)

	existingEvent := &domain.Event{
		ID:          "event-1",
		UserID:      "user-cal-1",
		Title:       "Reunião de Alinhamento",
		Description: "Discussão do roadmap",
		Location:    "Google Meet",
		StartAt:     now,
		EndAt:       now.Add(1 * time.Hour), // 14:00 - 15:00
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := eventRepo.Create(existingEvent); err != nil {
		t.Fatalf("failed to create event: %v", err)
	}

	// 1. Conflito: Tentativa de agendamento com sobreposição parcial (14:30 - 15:30)
	conflict, err := eventRepo.CheckConflict("user-cal-1", now.Add(30*time.Minute), now.Add(90*time.Minute), "")
	if err != nil {
		t.Fatalf("failed to check conflict: %v", err)
	}
	if !conflict.HasConflict {
		t.Errorf("expected conflict, got none")
	}
	if conflict.ConflictingID != "event-1" {
		t.Errorf("expected conflicting id 'event-1', got '%s'", conflict.ConflictingID)
	}

	// 2. Sem conflito: Agendamento em horário livre (15:00 - 16:00)
	noConflict, err := eventRepo.CheckConflict("user-cal-1", now.Add(1*time.Hour), now.Add(2*time.Hour), "")
	if err != nil {
		t.Fatalf("failed to check conflict: %v", err)
	}
	if noConflict.HasConflict {
		t.Errorf("expected no conflict, but got conflict with %s", noConflict.ConflictingTitle)
	}
}

func TestEventRepository_ListByUser(t *testing.T) {
	eventRepo, _, _ := setupCalendarTestDB(t)

	pastDate := time.Date(2026, 9, 1, 10, 0, 0, 0, time.UTC)
	event := &domain.Event{
		ID:          "event-list-1",
		UserID:      "user-cal-1",
		Title:       "Evento de Teste",
		Description: "Descrição",
		Location:    "Local",
		StartAt:     pastDate,
		EndAt:       pastDate.Add(1 * time.Hour),
		Source:      "google",
		Category:    "work",
		Color:       "#60A5FA",
		CreatedAt:   pastDate,
		UpdatedAt:   pastDate,
	}

	if err := eventRepo.Create(event); err != nil {
		t.Fatalf("failed to create event: %v", err)
	}

	from := pastDate.Add(-24 * time.Hour)
	to := pastDate.Add(24 * time.Hour)
	events, err := eventRepo.ListByUser("user-cal-1", from, to)
	if err != nil {
		t.Fatalf("ListByUser failed: %v", err)
	}

	if len(events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(events))
	}

	// Teste com fuso horário diferente (ex: Brasil UTC-3)
	brtZone := time.FixedZone("BRT", -3*3600)
	localEvent := &domain.Event{
		ID:        "event-brt-1",
		UserID:    "user-cal-1",
		Title:     "Evento Local BRT",
		StartAt:   time.Date(2026, 10, 4, 15, 0, 0, 0, brtZone), // 15:00 BRT = 18:00 UTC
		EndAt:     time.Date(2026, 10, 4, 16, 0, 0, 0, brtZone),
		Source:    "vito",
		CreatedAt: pastDate,
		UpdatedAt: pastDate,
	}
	if err := eventRepo.Create(localEvent); err != nil {
		t.Fatalf("failed to create local event: %v", err)
	}

	// Busca usando intervalo UTC que engloba o evento (18:00 UTC)
	queryFrom := time.Date(2026, 10, 4, 17, 0, 0, 0, time.UTC)
	queryTo := time.Date(2026, 10, 4, 19, 0, 0, 0, time.UTC)
	brtResults, err := eventRepo.ListByUser("user-cal-1", queryFrom, queryTo)
	if err != nil {
		t.Fatalf("ListByUser for BRT failed: %v", err)
	}
	if len(brtResults) != 1 {
		t.Fatalf("expected 1 event for BRT query, got %d", len(brtResults))
	}
	if brtResults[0].Title != "Evento Local BRT" {
		t.Errorf("expected 'Evento Local BRT', got '%s'", brtResults[0].Title)
	}
}
