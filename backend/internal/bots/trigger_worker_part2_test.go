package bots_test

import (
	"context"
	"github.com/andrevmp/vito/backend/internal/bots"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

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

func priceFixture(target string) (*mockTriggerRepo, *mockPushDispatcher, *bots.TriggerWorker) {
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
	worker := bots.NewTriggerWorker(repo, push, eval)
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

func TestTriggerWorker_CheckBreakingTriggers_DispatchesBreakingNewsOutsideScheduledTime(t *testing.T) {
	now := time.Date(2026, 10, 24, 15, 0, 0, 0, time.UTC)
	futureCheck := now.Add(5 * time.Hour) // Próxima checagem só às 20h

	repo := &mockTriggerRepo{
		triggers: []domain.Trigger{
			{
				ID:            "trig-fla-breaking",
				UserID:        "user-1",
				Title:         "Jogos do Flamengo",
				Status:        domain.TriggerStatusActive,
				ScheduledTime: "20:00",
				NextCheckAt:   &futureCheck,
			},
		},
	}
	push := &mockPushDispatcher{}
	eval := &scriptedEvaluator{
		payload: `{"status":"evaluated","condition_met":true,"confidence":98,"urgency":"breaking","summary":"Flamengo é campeão nos acréscimos!","data":"gol de Pedro"}`,
	}

	worker := bots.NewTriggerWorker(repo, push, eval)
	worker.SetDeltaFetcher(func(ctx context.Context, t *domain.Trigger) ([]string, []string, error) {
		return []string{"hash-gol-breaking"}, []string{"hash-gol-breaking"}, nil
	})

	count, err := worker.CheckBreakingTriggers(now)
	if err != nil {
		t.Fatalf("erro ao checar breaking triggers: %v", err)
	}
	if count != 1 {
		t.Fatalf("esperava 1 breaking trigger avaliado e despachado, obteve %d", count)
	}
	if len(repo.logs) != 1 {
		t.Fatalf("esperava 1 log gravado, obteve %d", len(repo.logs))
	}
	if len(push.calls) != 1 {
		t.Fatalf("esperava 1 push disparado imediatamente fora do horário, obteve %d", len(push.calls))
	}
	if push.calls[0].priority != "urgent" {
		t.Errorf("esperava prioridade 'urgent', obteve %q", push.calls[0].priority)
	}
}
