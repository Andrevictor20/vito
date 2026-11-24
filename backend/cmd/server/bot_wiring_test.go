package main

import (
	"path/filepath"
	"testing"

	"github.com/andrevmp/vito/backend/internal/config"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func TestSetupBotSubsystem_Wiring(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "bot_wiring.db"))
	if err != nil {
		t.Fatalf("database.Open: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	cfg := &config.Config{
		JWTSecret:         "test-jwt-secret-0123456789",
		DataEncryptionKey: "0123456789abcdef0123456789abcdef",
	}
	userRepo := repository.NewUserRepository(db)
	aiSettingsRepo := repository.NewAISettingsRepository(db)
	triggerRepo := repository.NewTriggerRepository(db)
	memoryRepo := repository.NewMemoryRepository(db)

	agentSys := setupAgentSubsystem(cfg, db, nil, nil, nil, nil, userRepo, aiSettingsRepo, nil, nil, memoryRepo)
	t.Cleanup(func() {
		agentSys.TraceRecorder.Close()
		agentSys.ConsolidationWorker.Stop()
	})

	botH, botR := setupBotSubsystem(db, triggerRepo, nil, nil, agentSys)
	if botH == nil || botR == nil {
		t.Fatal("esperava BotHandler e BotRunner não-nulos do setupBotSubsystem")
	}
}
