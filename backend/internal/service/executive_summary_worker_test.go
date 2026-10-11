package service_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func TestExecutiveSummaryWorker_CheckAndDispatchSummaries(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_exec_summary.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	defer db.Close()

	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{
		ID:           "user-summary-1",
		Name:         "André",
		Email:        "andre@example.com",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	})

	var receivedPush []service.PushMessage
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var msgs []service.PushMessage
		_ = json.NewDecoder(r.Body).Decode(&msgs)
		receivedPush = append(receivedPush, msgs...)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"status":"ok"}]}`))
	}))
	defer server.Close()

	tokenRepo := &mockDeviceTokenRepo{
		tokens: []domain.DeviceToken{
			{ID: "tok-1", UserID: "user-summary-1", Token: "ExponentPushToken[andre]", Platform: "android"},
		},
	}
	notifSvc := service.NewNotificationService(tokenRepo, server.Client())
	notifSvc.SetExpoAPIURL(server.URL)

	worker := service.NewExecutiveSummaryWorker(db, userRepo, notifSvc)
	loc := time.FixedZone("BRT", -3*3600)
	worker.SetLocation(loc)

	// 1. Testa Resumo Diário (20:30 em um dia qualquer)
	// 2026-10-11 (Domingo) 20:30 BRT
	dailyTime := time.Date(2026, 10, 11, 20, 30, 0, 0, loc)
	dispatchedDaily, err := worker.CheckAndDispatchSummaries(dailyTime)
	if err != nil {
		t.Fatalf("CheckAndDispatchSummaries daily falhou: %v", err)
	}
	if dispatchedDaily != 1 {
		t.Errorf("esperava 1 resumo diário despachado, obteve %d", dispatchedDaily)
	}
	if len(receivedPush) != 1 || receivedPush[0].Title != "🌅 Balanço do Dia Concluído" {
		t.Errorf("mensagem push incorreta para diário: %+v", receivedPush)
	}

	// Idempotência do diário no mesmo dia
	receivedPush = nil
	dispatchedDaily2, _ := worker.CheckAndDispatchSummaries(dailyTime)
	if dispatchedDaily2 != 0 {
		t.Errorf("esperava 0 resumos diários na segunda chamada (idempotência), obteve %d", dispatchedDaily2)
	}

	// 2. Testa Balanço Semanal (Domingo 20:00 BRT)
	weeklyTime := time.Date(2026, 10, 11, 20, 0, 0, 0, loc)
	dispatchedWeekly, err := worker.CheckAndDispatchSummaries(weeklyTime)
	if err != nil {
		t.Fatalf("CheckAndDispatchSummaries weekly falhou: %v", err)
	}
	if dispatchedWeekly != 1 {
		t.Errorf("esperava 1 balanço semanal despachado, obteve %d", dispatchedWeekly)
	}
	if len(receivedPush) != 1 || receivedPush[0].Title != "📊 Balanço Semanal Disponível" {
		t.Errorf("mensagem push incorreta para semanal: %+v", receivedPush)
	}

	// 3. Testa Perspectiva Mensal (1º de Novembro 09:00 BRT)
	receivedPush = nil
	monthlyTime := time.Date(2026, 11, 1, 9, 0, 0, 0, loc)
	dispatchedMonthly, err := worker.CheckAndDispatchSummaries(monthlyTime)
	if err != nil {
		t.Fatalf("CheckAndDispatchSummaries monthly falhou: %v", err)
	}
	if dispatchedMonthly != 1 {
		t.Errorf("esperava 1 perspectiva mensal despachada, obteve %d", dispatchedMonthly)
	}
	if len(receivedPush) != 1 || receivedPush[0].Title != "🗓️ Perspectiva Mensal Consolidada" {
		t.Errorf("mensagem push incorreta para mensal: %+v", receivedPush)
	}
}
