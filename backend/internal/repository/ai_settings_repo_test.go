package repository_test

import (
	"database/sql"
	"path/filepath"
	"testing"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func setupTestDBWithUserForAI(t *testing.T) (*sql.DB, string) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_ai_settings.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("falha ao abrir banco de teste: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userID := "user-ai-test-1"
	_, err = db.Exec(`INSERT INTO users (id, name, email, password_hash, created_at, updated_at) 
		VALUES (?, 'André AI Test', 'andre.ai@test.com', 'hash', datetime('now'), datetime('now'))`, userID)
	if err != nil {
		t.Fatalf("falha ao criar usuário de teste: %v", err)
	}

	return db, userID
}

func TestAISettingsRepositorySQLite_GetSettingsDefault(t *testing.T) {
	db, userID := setupTestDBWithUserForAI(t)
	defer db.Close()

	repo := repository.NewAISettingsRepository(db)

	settings, err := repo.GetSettings(userID)
	if err != nil {
		t.Fatalf("erro ao buscar configurações default: %v", err)
	}
	if settings == nil {
		t.Fatal("esperava configurações retornadas, obteve nil")
	}
	if settings.UserID != userID {
		t.Errorf("esperava UserID %s, obteve %s", userID, settings.UserID)
	}
	if settings.AutonomyMode != domain.AutonomyModeAssisted {
		t.Errorf("esperava modo default 'assisted', obteve %s", settings.AutonomyMode)
	}
	if settings.AutoFocusBlocks != false {
		t.Errorf("esperava AutoFocusBlocks default false, obteve %v", settings.AutoFocusBlocks)
	}
}

func TestAISettingsRepositorySQLite_UpsertAndRetrieve(t *testing.T) {
	db, userID := setupTestDBWithUserForAI(t)
	defer db.Close()

	repo := repository.NewAISettingsRepository(db)

	custom := &domain.AISettings{
		UserID:          userID,
		AutonomyMode:    domain.AutonomyModeProactive,
		AutoFocusBlocks: true,
	}

	if err := repo.UpsertSettings(custom); err != nil {
		t.Fatalf("erro ao salvar configurações de IA: %v", err)
	}

	retrieved, err := repo.GetSettings(userID)
	if err != nil {
		t.Fatalf("erro ao recuperar configurações: %v", err)
	}
	if retrieved.AutonomyMode != domain.AutonomyModeProactive {
		t.Errorf("esperava modo 'proactive', obteve %s", retrieved.AutonomyMode)
	}
	if retrieved.AutoFocusBlocks != true {
		t.Errorf("esperava AutoFocusBlocks true, obteve %v", retrieved.AutoFocusBlocks)
	}
}
