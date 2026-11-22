package service_test

import (
	"context"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

type recordingTriggerPush struct {
	mu     sync.Mutex
	titles []string
}

func (r *recordingTriggerPush) SendPushToUser(userID, title, body, priority string, data map[string]interface{}) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.titles = append(r.titles, title)
	return 1, nil
}

func (r *recordingTriggerPush) snapshot() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]string, len(r.titles))
	copy(out, r.titles)
	return out
}

type scriptedTriggerEval struct {
	summary string
	payload string
}

func (s *scriptedTriggerEval) Evaluate(ctx context.Context, trigger *domain.Trigger) (string, string, error) {
	return s.summary, s.payload, nil
}

func (s *scriptedTriggerEval) TestEvaluate(ctx context.Context, trigger *domain.Trigger) (*domain.TriggerTestResult, error) {
	return &domain.TriggerTestResult{TriggerID: trigger.ID, Summary: s.summary, Confidence: 95}, nil
}

func TestTriggerWorker_AttentionBudget_DeferDedupAndCriticalBypass(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "trig_budget.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	userID := "u-trig-budget"
	now := time.Date(2026, 11, 21, 15, 0, 0, 0, time.UTC)
	_, err = db.Exec(`INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?,?,?,?,?,?)`,
		userID, "trig@vito.ai", "Trig", "h", now, now)
	if err != nil {
		t.Fatal(err)
	}

	eventRepo := repository.NewEventRepository(db)
	triggerRepo := repository.NewTriggerRepository(db)
	budget := service.NewAttentionBudgetService(db, eventRepo)

	// Evento em andamento 14:30..15:30 -> silencia alertas comuns
	_ = eventRepo.Create(&domain.Event{
		ID:        "ev-trig-active",
		UserID:    userID,
		Title:     "Reunião Planejamento",
		StartAt:   now.Add(-30 * time.Minute),
		EndAt:     now.Add(30 * time.Minute),
		CreatedAt: now,
		UpdatedAt: now,
	})

	// 1. Trigger financeiro comum durante reunião -> DEFERRED
	_ = triggerRepo.Create(&domain.Trigger{
		ID:            "trg-fin-normal",
		UserID:        userID,
		Title:         "Fatura Nubank",
		Category:      domain.CategoryFinance,
		Query:         "fatura",
		ConditionType: domain.ConditionChangeDetected,
		Status:        domain.TriggerStatusActive,
		Frequency:     domain.FrequencyHourly,
		ScheduledTime: "12:00",
	})

	push := &recordingTriggerPush{}
	eval := &scriptedTriggerEval{
		summary: "Fatura Nubank fechou em R$ 1.250",
		payload: `{"condition_met":true,"confidence":95,"urgency":"normal"}`,
	}
	worker := service.NewTriggerWorker(triggerRepo, push, eval)
	worker.SetAttentionBudget(budget)

	if _, err := worker.CheckAndEvaluateTriggers(now); err != nil {
		t.Fatalf("erro ao avaliar trigger normal: %v", err)
	}
	if got := push.snapshot(); len(got) != 0 {
		t.Fatalf("esperava push adiado durante reunião, recebeu %v", got)
	}

	// 2. Trigger com category=critical_alarm durante a mesma reunião -> DELIVERED imediatamente
	_ = triggerRepo.Create(&domain.Trigger{
		ID:            "trg-critical-alarm",
		UserID:        userID,
		Title:         "Servidor Produção Offline",
		Category:      domain.TriggerCategory("critical_alarm"),
		Query:         "health",
		ConditionType: domain.ConditionChangeDetected,
		Status:        domain.TriggerStatusActive,
		Frequency:     domain.FrequencyHourly,
		ScheduledTime: "12:00",
	})
	if _, err := worker.CheckAndEvaluateTriggers(now.Add(1 * time.Minute)); err != nil {
		t.Fatalf("erro ao avaliar critical_alarm: %v", err)
	}
	if got := push.snapshot(); len(got) != 1 || got[0] != "Radar: Servidor Produção Offline" {
		t.Fatalf("esperava bypass imediato para critical_alarm, obteve %v", got)
	}

	// 3. Deduplicação semântica cross-worker após a reunião (16:00)
	afterMtg := now.Add(60 * time.Minute)
	_, _ = budget.Evaluate(context.Background(), service.AttentionCandidate{
		UserID:       userID,
		SourceWorker: "bot_runner",
		Category:     "financas",
		Urgency:      "normal",
		Title:        "Radar: Cotação Dólar Comercial",
		Body:         "Dólar atingiu R$ 5,85 hoje",
		Now:          afterMtg,
	})
	_ = triggerRepo.Create(&domain.Trigger{
		ID:            "trg-dollar-dedup",
		UserID:        userID,
		Title:         "Cotação Dólar Comercial",
		Category:      domain.CategoryFinance,
		Query:         "dolar",
		ConditionType: domain.ConditionChangeDetected,
		Status:        domain.TriggerStatusActive,
		Frequency:     domain.FrequencyHourly,
		ScheduledTime: "12:00",
	})
	evalDedup := &scriptedTriggerEval{
		summary: "Dólar atingiu R$ 5,85 hoje",
		payload: `{"condition_met":true,"confidence":95,"urgency":"normal"}`,
	}
	workerDedup := service.NewTriggerWorker(triggerRepo, push, evalDedup)
	workerDedup.SetAttentionBudget(budget)
	if _, err := workerDedup.CheckAndEvaluateTriggers(afterMtg.Add(1 * time.Minute)); err != nil {
		t.Fatalf("erro ao avaliar dedup: %v", err)
	}
	if got := push.snapshot(); len(got) != 1 {
		t.Fatalf("esperava deduplicação cross-worker (permanecer 1 push), obteve %v", got)
	}
}
