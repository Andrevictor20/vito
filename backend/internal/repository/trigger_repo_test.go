package repository_test

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func setupTriggerTestDB(t *testing.T) (*repository.TriggerRepositorySQLite, *repository.UserRepositorySQLite) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_vito_triggers.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	triggerRepo := repository.NewTriggerRepository(db)

	_ = userRepo.Create(&domain.User{
		ID:           "user-trig-1",
		Name:         "User Trigger",
		Email:        "trigger@example.com",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	})

	return triggerRepo, userRepo
}

func TestTriggerRepository_Lifecycle(t *testing.T) {
	triggerRepo, _ := setupTriggerTestDB(t)
	now := time.Now().UTC().Truncate(time.Second)

	trigger := &domain.Trigger{
		ID:            "trig-1",
		UserID:        "user-trig-1",
		Title:         "Ações PETR3",
		Category:      domain.CategoryFinance,
		Query:         "Monitore o preço da PETR3 acima de R$ 35",
		ConditionType: domain.ConditionPriceAbove,
		TargetValue:   "35.00",
		CurrentValue:  "32.50",
		Status:        domain.TriggerStatusActive,
		Frequency:     domain.FrequencyDailyMorning,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	// 1. Criar
	if err := triggerRepo.Create(trigger); err != nil {
		t.Fatalf("falha ao criar trigger: %v", err)
	}

	// 2. Buscar por ID
	got, err := triggerRepo.GetByID("trig-1", "user-trig-1")
	if err != nil {
		t.Fatalf("falha ao buscar trigger por ID: %v", err)
	}
	if got.Title != "Ações PETR3" || got.Category != domain.CategoryFinance {
		t.Errorf("dados divergentes: got %+v", got)
	}

	// 3. Listar por Usuário e Categoria
	list, err := triggerRepo.ListByUser("user-trig-1", domain.CategoryFinance, domain.TriggerStatusActive)
	if err != nil {
		t.Fatalf("falha ao listar triggers: %v", err)
	}
	if len(list) != 1 {
		t.Errorf("esperava 1 trigger, recebeu %d", len(list))
	}

	// 4. Atualizar Status para Pausado
	if err := triggerRepo.UpdateStatus("trig-1", "user-trig-1", domain.TriggerStatusPaused); err != nil {
		t.Fatalf("falha ao pausar trigger: %v", err)
	}
	gotPaused, _ := triggerRepo.GetByID("trig-1", "user-trig-1")
	if gotPaused.Status != domain.TriggerStatusPaused {
		t.Errorf("status esperado paused, got %s", gotPaused.Status)
	}

	// 5. Update Evaluation
	nextCheck := now.Add(1 * time.Hour)
	if err := triggerRepo.UpdateEvaluation("trig-1", "36.20", domain.TriggerStatusTriggered, now, &nextCheck); err != nil {
		t.Fatalf("falha ao atualizar evaluation: %v", err)
	}
	gotEvaluated, _ := triggerRepo.GetByID("trig-1", "user-trig-1")
	if gotEvaluated.CurrentValue != "36.20" || gotEvaluated.Status != domain.TriggerStatusTriggered {
		t.Errorf("expected current value 36.20 and triggered, got %+v", gotEvaluated)
	}

	// 6. Logs de disparo
	log := &domain.TriggerLog{
		ID:          "log-1",
		TriggerID:   "trig-1",
		TriggeredAt: now,
		Message:     "PETR3 atingiu R$ 36,20 (alvo: R$ 35,00)",
		Payload:     `{"price": 36.20}`,
		IsRead:      false,
	}
	if err := triggerRepo.CreateLog(log); err != nil {
		t.Fatalf("falha ao registrar log de disparo: %v", err)
	}
	logs, err := triggerRepo.ListLogsByTrigger("trig-1")
	if err != nil || len(logs) != 1 {
		t.Fatalf("esperava 1 log, recebeu %d, err: %v", len(logs), err)
	}

	// 7. Excluir
	if err := triggerRepo.Delete("trig-1", "user-trig-1"); err != nil {
		t.Fatalf("falha ao deletar trigger: %v", err)
	}
	_, err = triggerRepo.GetByID("trig-1", "user-trig-1")
	if err != domain.ErrTriggerNotFound {
		t.Errorf("esperava ErrTriggerNotFound, recebeu: %v", err)
	}
}
