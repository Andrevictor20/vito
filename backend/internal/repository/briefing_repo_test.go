package repository_test

import (
	"database/sql"
	"path/filepath"
	"testing"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func setupTestDBWithUser(t *testing.T) (*sql.DB, string) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_briefing.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("falha ao abrir banco de teste: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userID := "user-briefing-test-1"
	_, err = db.Exec(`INSERT INTO users (id, name, email, password_hash, created_at, updated_at) 
		VALUES (?, 'André Test', 'andre@test.com', 'hash', datetime('now'), datetime('now'))`, userID)
	if err != nil {
		t.Fatalf("falha ao criar usuário de teste: %v", err)
	}

	return db, userID
}

func TestBriefingRepositorySQLite_GetSettingsDefault(t *testing.T) {
	db, userID := setupTestDBWithUser(t)
	defer db.Close()

	repo := repository.NewBriefingRepository(db)

	settings, err := repo.GetSettings(userID)
	if err != nil {
		t.Fatalf("erro inesperado ao buscar configurações não existentes: %v", err)
	}
	if settings == nil {
		t.Fatal("esperava configurações default, retornou nil")
	}
	if settings.UserID != userID {
		t.Errorf("esperava userID %s, obteve %s", userID, settings.UserID)
	}
	if !settings.Enabled {
		t.Errorf("esperava Enabled=true por padrão")
	}
	if settings.ScheduledTime != "07:30" {
		t.Errorf("esperava ScheduledTime=07:30, obteve %s", settings.ScheduledTime)
	}
}

func TestBriefingRepositorySQLite_UpsertAndRetrieve(t *testing.T) {
	db, userID := setupTestDBWithUser(t)
	defer db.Close()

	repo := repository.NewBriefingRepository(db)

	custom := &domain.BriefingSettings{
		UserID:           userID,
		Enabled:          false,
		ScheduledTime:    "08:15",
		WakeupAlarmEarly: false,
		LastSentDate:     "2026-10-10",
	}

	if err := repo.UpsertSettings(custom); err != nil {
		t.Fatalf("erro ao salvar configurações: %v", err)
	}

	retrieved, err := repo.GetSettings(userID)
	if err != nil {
		t.Fatalf("erro ao recuperar configurações: %v", err)
	}
	if retrieved.Enabled != false {
		t.Errorf("esperava Enabled=false")
	}
	if retrieved.ScheduledTime != "08:15" {
		t.Errorf("esperava ScheduledTime=08:15, obteve %s", retrieved.ScheduledTime)
	}
	if retrieved.WakeupAlarmEarly != false {
		t.Errorf("esperava WakeupAlarmEarly=false")
	}
	if retrieved.LastSentDate != "2026-10-10" {
		t.Errorf("esperava LastSentDate=2026-10-10, obteve %s", retrieved.LastSentDate)
	}
}

func TestBriefingRepositorySQLite_MarkSent(t *testing.T) {
	db, userID := setupTestDBWithUser(t)
	defer db.Close()

	repo := repository.NewBriefingRepository(db)

	if err := repo.MarkSent(userID, "2026-10-11"); err != nil {
		t.Fatalf("erro ao marcar data de envio: %v", err)
	}

	retrieved, err := repo.GetSettings(userID)
	if err != nil {
		t.Fatalf("erro ao recuperar configurações: %v", err)
	}
	if retrieved.LastSentDate != "2026-10-11" {
		t.Errorf("esperava LastSentDate=2026-10-11, obteve %s", retrieved.LastSentDate)
	}
}

func TestBriefingRepositorySQLite_ListActiveSettings(t *testing.T) {
	db, user1 := setupTestDBWithUser(t)
	defer db.Close()

	user2 := "user-briefing-test-2"
	_, _ = db.Exec(`INSERT INTO users (id, name, email, password_hash, created_at, updated_at) 
		VALUES (?, 'User 2', 'user2@test.com', 'hash', datetime('now'), datetime('now'))`, user2)

	repo := repository.NewBriefingRepository(db)

	// user1 enabled, user2 disabled
	_ = repo.UpsertSettings(&domain.BriefingSettings{
		UserID:        user1,
		Enabled:       true,
		ScheduledTime: "07:30",
	})
	_ = repo.UpsertSettings(&domain.BriefingSettings{
		UserID:        user2,
		Enabled:       false,
		ScheduledTime: "08:00",
	})

	active, err := repo.ListActiveSettings()
	if err != nil {
		t.Fatalf("erro ao listar ativas: %v", err)
	}
	if len(active) != 1 {
		t.Fatalf("esperava 1 ativa, obteve %d", len(active))
	}
	if active[0].UserID != user1 {
		t.Errorf("esperava user1 ativo, obteve %s", active[0].UserID)
	}
}
