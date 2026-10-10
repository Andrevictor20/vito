package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

type mockTriggerRepo struct {
	triggers []domain.Trigger
	logs     []domain.TriggerLog
}

func (m *mockTriggerRepo) Create(t *domain.Trigger) error {
	m.triggers = append(m.triggers, *t)
	return nil
}

func (m *mockTriggerRepo) GetByID(id, userID string) (*domain.Trigger, error) {
	for _, t := range m.triggers {
		if t.ID == id && t.UserID == userID {
			return &t, nil
		}
	}
	return nil, domain.ErrTriggerNotFound
}

func (m *mockTriggerRepo) ListByUser(userID string, category domain.TriggerCategory, status domain.TriggerStatus) ([]domain.Trigger, error) {
	return m.triggers, nil
}

func (m *mockTriggerRepo) ListActive() ([]domain.Trigger, error) {
	var res []domain.Trigger
	for _, t := range m.triggers {
		if t.Status == domain.TriggerStatusActive {
			res = append(res, t)
		}
	}
	return res, nil
}

func (m *mockTriggerRepo) ListDueTriggers(now time.Time) ([]domain.Trigger, error) {
	var res []domain.Trigger
	for _, t := range m.triggers {
		if t.Status == domain.TriggerStatusActive {
			if t.NextCheckAt == nil || !t.NextCheckAt.After(now) {
				res = append(res, t)
			}
		}
	}
	return res, nil
}

func (m *mockTriggerRepo) Update(t *domain.Trigger) error {
	for i, trig := range m.triggers {
		if trig.ID == t.ID && trig.UserID == t.UserID {
			m.triggers[i] = *t
			return nil
		}
	}
	return domain.ErrTriggerNotFound
}

func (m *mockTriggerRepo) UpdateStatus(id, userID string, status domain.TriggerStatus) error {
	for i, trig := range m.triggers {
		if trig.ID == id && trig.UserID == userID {
			m.triggers[i].Status = status
			return nil
		}
	}
	return domain.ErrTriggerNotFound
}

func (m *mockTriggerRepo) UpdateEvaluation(id string, currentValue string, status domain.TriggerStatus, lastChecked time.Time, nextCheck *time.Time) error {
	for i, trig := range m.triggers {
		if trig.ID == id {
			m.triggers[i].CurrentValue = currentValue
			m.triggers[i].Status = status
			m.triggers[i].LastCheckedAt = &lastChecked
			m.triggers[i].NextCheckAt = nextCheck
			return nil
		}
	}
	return domain.ErrTriggerNotFound
}

func (m *mockTriggerRepo) UpdateRunResult(id string, currentValue string, status domain.TriggerStatus, lastRunStatus string, lastChecked time.Time, nextCheck *time.Time) error {
	for i, trig := range m.triggers {
		if trig.ID == id {
			m.triggers[i].CurrentValue = currentValue
			m.triggers[i].Status = status
			m.triggers[i].LastRunStatus = lastRunStatus
			m.triggers[i].LastCheckedAt = &lastChecked
			m.triggers[i].NextCheckAt = nextCheck
			return nil
		}
	}
	return domain.ErrTriggerNotFound
}

func (m *mockTriggerRepo) Delete(id, userID string) error {
	for i, trig := range m.triggers {
		if trig.ID == id && trig.UserID == userID {
			m.triggers = append(m.triggers[:i], m.triggers[i+1:]...)
			return nil
		}
	}
	return domain.ErrTriggerNotFound
}

func (m *mockTriggerRepo) CreateLog(log *domain.TriggerLog) error {
	m.logs = append(m.logs, *log)
	return nil
}

func (m *mockTriggerRepo) ListLogsByTrigger(triggerID string) ([]domain.TriggerLog, error) {
	var res []domain.TriggerLog
	for _, l := range m.logs {
		if l.TriggerID == triggerID {
			res = append(res, l)
		}
	}
	return res, nil
}

type mockEvaluator struct {
	calledWith []string
}

func (e *mockEvaluator) Evaluate(ctx context.Context, t *domain.Trigger) (string, string, error) {
	e.calledWith = append(e.calledWith, t.ID)
	return "Relatório gerado com sucesso para " + t.Title, `{"status":"ok"}`, nil
}

func (e *mockEvaluator) TestEvaluate(ctx context.Context, t *domain.Trigger) (*domain.TriggerTestResult, error) {
	e.calledWith = append(e.calledWith, t.ID)
	return &domain.TriggerTestResult{
		TriggerID:             t.ID,
		Title:                 t.Title,
		Query:                 t.Query,
		ConditionMet:          true,
		CurrentData:           "Cotação simulada R$ 5,65",
		Summary:               "Condição atingida com sucesso.",
		SimulatedNotification: "Alerta de teste: " + t.Title,
		TestedAt:              time.Now().UTC(),
	}, nil
}

func TestTriggerWorker_CheckAndEvaluateTriggers(t *testing.T) {
	now := time.Date(2026, 10, 10, 14, 0, 0, 0, time.UTC)
	dueTime := now.Add(-5 * time.Minute)

	repo := &mockTriggerRepo{
		triggers: []domain.Trigger{
			{
				ID:            "trig-1",
				UserID:        "user-1",
				Title:         "Cotação Dólar",
				Query:         "Dólar PTAX acima de R$ 5,50",
				Status:        domain.TriggerStatusActive,
				Frequency:     domain.FrequencyDailyMorning,
				ScheduledTime: "08:30",
				NextCheckAt:   &dueTime,
			},
			{
				ID:            "trig-2",
				UserID:        "user-1",
				Title:         "Concursos TI",
				Query:         "Edital TI Bacen",
				Status:        domain.TriggerStatusPaused,
				NextCheckAt:   &dueTime,
			},
		},
	}

	eval := &mockEvaluator{}
	worker := service.NewTriggerWorker(repo, nil, eval)

	count, err := worker.CheckAndEvaluateTriggers(now)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}

	if count != 1 {
		t.Errorf("esperava 1 trigger avaliado, obteve %d", count)
	}

	if len(eval.calledWith) != 1 || eval.calledWith[0] != "trig-1" {
		t.Errorf("evaluator não foi chamado para trig-1: %v", eval.calledWith)
	}

	if len(repo.logs) != 1 {
		t.Fatalf("esperava 1 log criado, obteve %d", len(repo.logs))
	}

	if repo.logs[0].TriggerID != "trig-1" {
		t.Errorf("log associado ao trigger incorreto: %s", repo.logs[0].TriggerID)
	}

	// Verifica se a próxima checagem foi recalculada para o futuro
	updatedTrigger, _ := repo.GetByID("trig-1", "user-1")
	if updatedTrigger.NextCheckAt == nil || !updatedTrigger.NextCheckAt.After(now) {
		t.Errorf("próxima checagem não foi recalculada para o futuro: %v", updatedTrigger.NextCheckAt)
	}
}

func TestTriggerWorker_RunTriggerNow(t *testing.T) {
	repo := &mockTriggerRepo{
		triggers: []domain.Trigger{
			{
				ID:            "trig-manual",
				UserID:        "user-1",
				Title:         "Voo para Roma",
				Query:         "Passagem abaixo de 3500",
				Status:        domain.TriggerStatusActive,
				Frequency:     domain.FrequencyDailyMorning,
				ScheduledTime: "10:00",
			},
		},
	}

	eval := &mockEvaluator{}
	worker := service.NewTriggerWorker(repo, nil, eval)

	logEntry, err := worker.RunTriggerNow("trig-manual", "user-1")
	if err != nil {
		t.Fatalf("falha ao rodar trigger sob demanda: %v", err)
	}

	if logEntry == nil {
		t.Fatal("logEntry não deveria ser nil")
	}

	if logEntry.TriggerID != "trig-manual" {
		t.Errorf("ID do trigger incorreto no log: %s", logEntry.TriggerID)
	}

	if !logEntry.IsRead {
		t.Errorf("esperava log sob demanda marcado como lido (is_read=true)")
	}
}

func TestCalculateNextCheck(t *testing.T) {
	loc := time.FixedZone("BRT", -3*3600)
	// Base: 10/10/2026 às 10:00 BRT
	base := time.Date(2026, 10, 10, 10, 0, 0, 0, loc)

	// Horário futuro no mesmo dia: 15:30 BRT
	nextFuture := service.CalculateNextCheck("15:30", domain.FrequencyDailyMorning, base, loc)
	expectedFuture := time.Date(2026, 10, 10, 15, 30, 0, 0, loc).UTC()
	if !nextFuture.Equal(expectedFuture) {
		t.Errorf("esperava %v, obteve %v", expectedFuture, nextFuture)
	}

	// Horário passado no mesmo dia: 08:30 BRT -> deve agendar para amanhã 08:30 BRT
	nextPast := service.CalculateNextCheck("08:30", domain.FrequencyDailyMorning, base, loc)
	expectedPast := time.Date(2026, 10, 11, 8, 30, 0, 0, loc).UTC()
	if !nextPast.Equal(expectedPast) {
		t.Errorf("esperava %v, obteve %v", expectedPast, nextPast)
	}
}

func TestTriggerWorker_TestTrigger(t *testing.T) {
	repo := &mockTriggerRepo{
		triggers: []domain.Trigger{
			{
				ID:       "trig-sim",
				UserID:   "user-1",
				Title:    "Simulação Dólar",
				Query:    "Dólar acima de 5,60",
				Category: domain.CategoryFinance,
				Status:   domain.TriggerStatusActive,
			},
		},
	}

	eval := &mockEvaluator{}
	worker := service.NewTriggerWorker(repo, nil, eval)

	res, err := worker.TestTrigger("trig-sim", "user-1")
	if err != nil {
		t.Fatalf("erro ao testar disparador: %v", err)
	}

	if res == nil {
		t.Fatal("resultado do teste não pode ser nil")
	}

	if res.TriggerID != "trig-sim" || !res.ConditionMet {
		t.Errorf("resultado inesperado: %+v", res)
	}
}
