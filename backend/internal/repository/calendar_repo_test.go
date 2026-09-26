package repository_test

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/kito/backend/internal/database"
	"github.com/andrevmp/kito/backend/internal/domain"
	"github.com/andrevmp/kito/backend/internal/repository"
)

func setupCalendarTestDB(t *testing.T) (*repository.EventRepositorySQLite, *repository.UserRepositorySQLite) {
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

	return eventRepo, userRepo
}

func TestEventRepository_CreateAndCheckConflict(t *testing.T) {
	eventRepo, _ := setupCalendarTestDB(t)

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
