package service_test

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func setupCalendarService(t *testing.T) (*service.CalendarService, domain.EventRepository) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_cal_svc.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	eventRepo := repository.NewEventRepository(db)

	_ = userRepo.Create(&domain.User{
		ID:           "user-cal-svc-1",
		Name:         "User Cal Svc",
		Email:        "calsvc@example.com",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	})

	calSvc := service.NewCalendarService(eventRepo)
	return calSvc, eventRepo
}

func TestCalendarService_CreateEventWithConflictCheck(t *testing.T) {
	calSvc, _ := setupCalendarService(t)

	baseTime := time.Date(2026, 9, 27, 10, 0, 0, 0, time.UTC)

	// 1. Criar primeiro evento
	event1, conflict, err := calSvc.CreateEvent(
		"user-cal-svc-1",
		"Dentista",
		"Limpeza semestral",
		"Clínica Sorriso",
		baseTime,
		baseTime.Add(1*time.Hour), // 10:00 - 11:00
	)
	if err != nil {
		t.Fatalf("expected nil error on create event, got: %v", err)
	}
	if conflict.HasConflict {
		t.Errorf("expected no conflict on first event")
	}
	if event1.ID == "" {
		t.Errorf("expected generated id")
	}

	// 2. Criar segundo evento com conflito (10:30 - 11:30)
	_, conflict2, err := calSvc.CreateEvent(
		"user-cal-svc-1",
		"Reunião de Projeto",
		"Alinhamento",
		"Online",
		baseTime.Add(30*time.Minute),
		baseTime.Add(90*time.Minute),
	)
	if err != nil {
		t.Fatalf("expected nil error, got: %v", err)
	}
	if !conflict2.HasConflict {
		t.Errorf("expected conflict detection on overlapping event")
	}
	if conflict2.ConflictingTitle != "Dentista" {
		t.Errorf("expected conflict with 'Dentista', got '%s'", conflict2.ConflictingTitle)
	}
}
