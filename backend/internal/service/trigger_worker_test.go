package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

type mockTriggerRepo struct {
	triggers       []domain.Trigger
	logs           []domain.TriggerLog
	seenHashes     map[string][]string
	lastNotifiedAt *time.Time
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

func (m *mockTriggerRepo) UpdateLastError(id string, errMsg string) error {
	for i, trig := range m.triggers {
		if trig.ID == id {
			m.triggers[i].LastError = errMsg
			return nil
		}
	}
	return domain.ErrTriggerNotFound
}

func (m *mockTriggerRepo) GetLastNotifiedAt(id string) (*time.Time, error) {
	return m.lastNotifiedAt, nil
}

func (m *mockTriggerRepo) UpdateLastNotifiedAt(id string, t time.Time) error {
	m.lastNotifiedAt = &t
	return nil
}

func (m *mockTriggerRepo) GetSeenHashes(id string) ([]string, error) {
	if m.seenHashes == nil {
		return nil, nil
	}
	return m.seenHashes[id], nil
}

func (m *mockTriggerRepo) SetSeenHashes(id string, hashes []string) error {
	if m.seenHashes == nil {
		m.seenHashes = map[string][]string{}
	}
	m.seenHashes[id] = hashes
	return nil
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

func (m *mockTriggerRepo) DeleteLog(id, userID string) error {
	for i, l := range m.logs {
		if l.ID == id {
			m.logs = append(m.logs[:i], m.logs[i+1:]...)
			return nil
		}
	}
	return domain.ErrTriggerNotFound
}

func (m *mockTriggerRepo) ClearLogs(triggerID, userID string) error {
	var remaining []domain.TriggerLog
	for _, l := range m.logs {
		if l.TriggerID != triggerID {
			remaining = append(remaining, l)
		}
	}
	m.logs = remaining
	return nil
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
		Confidence:            90,
		WhyRelevant:           "Cotação atualizada e relevante para a vigília monitorada.",
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

func TestTriggerWorker_DeltaGateSkipsWithoutFresh(t *testing.T) {
	now := time.Date(2026, 10, 10, 14, 0, 0, 0, time.UTC)
	dueTime := now.Add(-5 * time.Minute)

	repo := &mockTriggerRepo{
		triggers: []domain.Trigger{
			{
				ID: userIDTrig(), UserID: "user-1", Title: "Radar", Query: "x",
				Status: domain.TriggerStatusActive, NextCheckAt: &dueTime,
			},
		},
		seenHashes: map[string][]string{},
	}
	eval := &mockEvaluator{}
	worker := service.NewTriggerWorker(repo, nil, eval)
	// Nada novo: IA não deve ser chamada.
	worker.SetDeltaFetcher(func(ctx context.Context, tr *domain.Trigger) ([]string, []string, error) {
		return nil, []string{"h1"}, nil
	})

	count, err := worker.CheckAndEvaluateTriggers(now)
	if err != nil {
		t.Fatal(err)
	}
	if len(eval.calledWith) != 0 {
		t.Fatalf("delta gate deveria pular a IA, chamadas: %v", eval.calledWith)
	}
	if count != 0 {
		t.Fatalf("pulados não contam como avaliados, veio %d", count)
	}

	// Fato novo: IA chamada e hashes persistidos (rearma o vencimento).
	repo.triggers[0].NextCheckAt = &dueTime
	worker.SetDeltaFetcher(func(ctx context.Context, tr *domain.Trigger) ([]string, []string, error) {
		return []string{"h2"}, []string{"h1", "h2"}, nil
	})
	count, err = worker.CheckAndEvaluateTriggers(now)
	if err != nil {
		t.Fatal(err)
	}
	if len(eval.calledWith) != 1 {
		t.Fatalf("IA deveria ser chamada 1 vez, veio %v", eval.calledWith)
	}
	if count != 1 {
		t.Fatalf("esperava 1 avaliado, veio %d", count)
	}
	if len(repo.seenHashes[userIDTrig()]) != 2 {
		t.Fatalf("hashes deveriam ser persistidos: %v", repo.seenHashes)
	}
}

func userIDTrig() string { return "trig-gate" }

// mockPushDispatcher observa pushes sem rede (Fase 0: provar gate anti-spam).
type mockPushDispatcher struct {
	calls []mockPushCall
}

type mockPushCall struct {
	userID   string
	title    string
	priority string
	data     map[string]interface{}
}

func (m *mockPushDispatcher) SendPushToUser(userID, title, body, priority string, data map[string]interface{}) (int, error) {
	m.calls = append(m.calls, mockPushCall{userID: userID, title: title, priority: priority, data: data})
	return 1, nil
}

// scriptedEvaluator devolve payload/erro configuráveis por teste.
type scriptedEvaluator struct {
	payload string
	failErr error
}

func (e *scriptedEvaluator) Evaluate(ctx context.Context, t *domain.Trigger) (string, string, error) {
	if e.failErr != nil {
		return "", "", e.failErr
	}
	return "Resumo da vigília " + t.Title, e.payload, nil
}

func (e *scriptedEvaluator) TestEvaluate(ctx context.Context, t *domain.Trigger) (*domain.TriggerTestResult, error) {
	return &domain.TriggerTestResult{TriggerID: t.ID, ConditionMet: true, Confidence: 90}, nil
}

func gateFixture(payload string, failErr error) (*mockTriggerRepo, *mockPushDispatcher, *service.TriggerWorker) {
	now := time.Date(2026, 10, 10, 14, 0, 0, 0, time.UTC)
	dueTime := now.Add(-5 * time.Minute)
	repo := &mockTriggerRepo{
		triggers: []domain.Trigger{
			{
				ID: "trig-gate-1", UserID: "user-1", Title: "Radar TV",
				Query: "TV 55 abaixo de 3500", Status: domain.TriggerStatusActive,
				Frequency: domain.FrequencyImmediate, NextCheckAt: &dueTime,
			},
		},
	}
	push := &mockPushDispatcher{}
	worker := service.NewTriggerWorker(repo, push, &scriptedEvaluator{payload: payload, failErr: failErr})
	return repo, push, worker
}

func TestTriggerWorker_GateSkipsWhenConditionNotMet(t *testing.T) {
	now := time.Date(2026, 10, 10, 14, 0, 0, 0, time.UTC)
	repo, push, worker := gateFixture(`{"status":"evaluated","condition_met":false,"confidence":90,"data":"nada novo"}`, nil)
	count, err := worker.CheckAndEvaluateTriggers(now)
	if err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Errorf("condição falsa não conta como avaliado, veio %d", count)
	}
	if len(repo.logs) != 0 {
		t.Errorf("condição falsa não deve gerar log, veio %d", len(repo.logs))
	}
	if len(push.calls) != 0 {
		t.Errorf("condição falsa não deve enviar push, veio %d", len(push.calls))
	}
	updated, _ := repo.GetByID("trig-gate-1", "user-1")
	if updated.NextCheckAt == nil || !updated.NextCheckAt.After(now) {
		t.Errorf("próxima checagem deveria avançar mesmo no skip: %v", updated.NextCheckAt)
	}
}

func TestTriggerWorker_GateSkipsWhenConfidenceLow(t *testing.T) {
	now := time.Date(2026, 10, 10, 14, 0, 0, 0, time.UTC)
	repo, push, worker := gateFixture(`{"status":"evaluated","condition_met":true,"confidence":40,"data":"talvez"}`, nil)
	count, err := worker.CheckAndEvaluateTriggers(now)
	if err != nil {
		t.Fatal(err)
	}
	if count != 0 || len(repo.logs) != 0 || len(push.calls) != 0 {
		t.Errorf("confiança baixa deveria pular tudo: count=%d logs=%d pushes=%d", count, len(repo.logs), len(push.calls))
	}
}

func TestTriggerWorker_GatePassesWhenMetAndConfident(t *testing.T) {
	now := time.Date(2026, 10, 10, 14, 0, 0, 0, time.UTC)
	repo, push, worker := gateFixture(`{"status":"evaluated","condition_met":true,"confidence":90,"data":"TV por 3499"}`, nil)
	count, err := worker.CheckAndEvaluateTriggers(now)
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Errorf("esperava 1 avaliado, veio %d", count)
	}
	if len(repo.logs) != 1 {
		t.Fatalf("esperava 1 log, veio %d", len(repo.logs))
	}
	if len(push.calls) != 1 {
		t.Fatalf("esperava 1 push, veio %d", len(push.calls))
	}
	if push.calls[0].data["type"] != "RADAR_TRIGGERED" {
		t.Errorf("push deveria ser RADAR_TRIGGERED: %+v", push.calls[0].data)
	}
}

func TestTriggerWorker_GateKeepsLegacyPayloads(t *testing.T) {
	now := time.Date(2026, 10, 10, 14, 0, 0, 0, time.UTC)
	repo, push, worker := gateFixture(`{"status":"ok"}`, nil)
	count, err := worker.CheckAndEvaluateTriggers(now)
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 || len(repo.logs) != 1 || len(push.calls) != 1 {
		t.Errorf("payload legado sem gate deve manter comportamento: count=%d logs=%d pushes=%d", count, len(repo.logs), len(push.calls))
	}
}

func TestTriggerWorker_EvalErrorLogsWithoutPush(t *testing.T) {
	now := time.Date(2026, 10, 10, 14, 0, 0, 0, time.UTC)
	repo, push, worker := gateFixture("", context.DeadlineExceeded)
	count, err := worker.CheckAndEvaluateTriggers(now)
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.logs) != 1 {
		t.Errorf("falha deve gerar log honesto, veio %d", len(repo.logs))
	}
	if len(push.calls) != 0 {
		t.Errorf("falha não deve enviar push, veio %d", len(push.calls))
	}
	_ = count
}

func priceFixture(target string) (*mockTriggerRepo, *mockPushDispatcher, *service.TriggerWorker) {
	now := time.Date(2026, 10, 10, 14, 0, 0, 0, time.UTC)
	dueTime := now.Add(-5 * time.Minute)
	repo := &mockTriggerRepo{
		triggers: []domain.Trigger{
			{
				ID: "trig-price-1", UserID: "user-1", Title: "TV 55 polegadas",
				Query: "TV 55", Category: domain.CategoryShopping,
				ConditionType: domain.ConditionPriceBelow, TargetValue: target,
				Status: domain.TriggerStatusActive, Frequency: domain.FrequencyImmediate,
				NextCheckAt: &dueTime,
			},
		},
	}
	push := &mockPushDispatcher{}
	eval := &mockEvaluator{}
	worker := service.NewTriggerWorker(repo, push, eval)
	return repo, push, worker
}

func TestTriggerWorker_PriceTargetNotifiesUrgent(t *testing.T) {
	now := time.Date(2026, 10, 10, 14, 0, 0, 0, time.UTC)
	repo, push, worker := priceFixture("R$ 3.500")
	worker.SetPriceFetcher(func(ctx context.Context, tr *domain.Trigger) (float64, string, bool, error) {
		return 3499.0, "3499.00", true, nil
	})
	count, err := worker.CheckAndEvaluateTriggers(now)
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Errorf("preço no alvo conta como avaliado, veio %d", count)
	}
	if len(repo.logs) != 1 {
		t.Fatalf("esperava 1 log determinístico, veio %d", len(repo.logs))
	}
	if len(push.calls) != 1 {
		t.Fatalf("esperava 1 push urgente, veio %d", len(push.calls))
	}
	if push.calls[0].priority != "urgent" {
		t.Errorf("push de preço deve ser urgente, veio %q", push.calls[0].priority)
	}
	if repo.lastNotifiedAt == nil {
		t.Error("last_notified_at deveria ser gravado")
	}
}

func TestTriggerWorker_PriceTargetCooldownSilences(t *testing.T) {
	now := time.Date(2026, 10, 10, 14, 0, 0, 0, time.UTC)
	repo, push, worker := priceFixture("R$ 3.500")
	recent := now.Add(-1 * time.Hour)
	repo.lastNotifiedAt = &recent
	worker.SetPriceFetcher(func(ctx context.Context, tr *domain.Trigger) (float64, string, bool, error) {
		return 3499.0, "3499.00", true, nil
	})
	count, err := worker.CheckAndEvaluateTriggers(now)
	if err != nil {
		t.Fatal(err)
	}
	if count != 0 || len(repo.logs) != 0 || len(push.calls) != 0 {
		t.Errorf("em cooldown deveria silenciar: count=%d logs=%d pushes=%d", count, len(repo.logs), len(push.calls))
	}
}

func TestTriggerWorker_PriceTargetMissSkips(t *testing.T) {
	now := time.Date(2026, 10, 10, 14, 0, 0, 0, time.UTC)
	repo, push, worker := priceFixture("R$ 3.500")
	worker.SetPriceFetcher(func(ctx context.Context, tr *domain.Trigger) (float64, string, bool, error) {
		return 3999.0, "3999.00", true, nil
	})
	count, err := worker.CheckAndEvaluateTriggers(now)
	if err != nil {
		t.Fatal(err)
	}
	if count != 0 || len(repo.logs) != 0 || len(push.calls) != 0 {
		t.Errorf("fora do alvo deveria pular: count=%d logs=%d pushes=%d", count, len(repo.logs), len(push.calls))
	}
}

func TestTriggerWorker_PriceUnparseableFallsThrough(t *testing.T) {
	now := time.Date(2026, 10, 10, 14, 0, 0, 0, time.UTC)
	_, push, worker := priceFixture("preço bom")
	worker.SetPriceFetcher(func(ctx context.Context, tr *domain.Trigger) (float64, string, bool, error) {
		return 3499.0, "3499.00", true, nil
	})
	// mockEvaluator legado devolve {"status":"ok"} → mantém comportamento (1 log).
	count, err := worker.CheckAndEvaluateTriggers(now)
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Errorf("alvo sem número deveria cair no fluxo IA, count=%d", count)
	}
	_ = push
}

func TestTriggerWorker_UrgentPayloadPushesUrgent(t *testing.T) {
	now := time.Date(2026, 10, 10, 14, 0, 0, 0, time.UTC)
	repo, push, worker := gateFixture(`{"status":"evaluated","condition_met":true,"confidence":95,"urgency":"high","data":"urgente"}`, nil)
	count, err := worker.CheckAndEvaluateTriggers(now)
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 || len(repo.logs) != 1 || len(push.calls) != 1 {
		t.Fatalf("urgente deveria notificar: count=%d logs=%d pushes=%d", count, len(repo.logs), len(push.calls))
	}
	if push.calls[0].priority != "urgent" {
		t.Errorf("urgency high deve gerar push urgent, veio %q", push.calls[0].priority)
	}
}

func TestTriggerWorker_NonUrgentPayloadPushesDefault(t *testing.T) {
	now := time.Date(2026, 10, 10, 14, 0, 0, 0, time.UTC)
	_, push, worker := gateFixture(`{"status":"evaluated","condition_met":true,"confidence":90,"urgency":"low","data":"rotina"}`, nil)
	_, err := worker.CheckAndEvaluateTriggers(now)
	if err != nil {
		t.Fatal(err)
	}
	if len(push.calls) != 1 {
		t.Fatalf("esperava 1 push, veio %d", len(push.calls))
	}
	if push.calls[0].priority != "default" {
		t.Errorf("sem urgência o push deve ser default, veio %q", push.calls[0].priority)
	}
}
