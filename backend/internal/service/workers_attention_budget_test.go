package service_test

import (
	"encoding/json"
	"github.com/andrevmp/vito/backend/internal/calendar"
	"github.com/andrevmp/vito/backend/internal/tasks"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func TestAC04_AllReminderWorkersUseAttentionBudget(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "ac04.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("database.Open: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()
	userID := "user-ac04"
	_, err = db.Exec(`INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES (?, 'U4', 'u4@vito.app', 'h', ?, ?)`, userID, now, now)
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}
	var pushCount int32
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var msgs []service.PushMessage
		_ = json.NewDecoder(r.Body).Decode(&msgs)
		atomic.AddInt32(&pushCount, int32(len(msgs)))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"data":[{"status":"ok"}]}`))
	}))
	defer ts.Close()

	tokenRepo := repository.NewDeviceTokenRepository(db)
	if err := tokenRepo.Save(&domain.DeviceToken{
		ID:        "dt-1",
		UserID:    userID,
		Token:     "ExponentPushToken[ac04]",
		Platform:  "android",
		CreatedAt: now,
		UpdatedAt: now,
	}); err != nil {
		t.Fatalf("save device_token: %v", err)
	}
	notifSvc := service.NewNotificationService(tokenRepo, ts.Client())
	notifSvc.SetExpoAPIURL(ts.URL)

	eventRepo := calendar.NewEventRepository(db)
	todoRepo := tasks.NewTodoRepository(db)
	userRepo := repository.NewUserRepository(db)
	pendingRepo := tasks.NewPendingRepository(db)

	budgetSvc := service.NewAttentionBudgetService(db, eventRepo)
	budgetSvc.SetCategoryPreference(userID, "tarefas", false)

	// Cria tarefa com prazo em 10 minutos
	due := now.Add(10 * time.Minute)
	if err := todoRepo.Create(&domain.Todo{
		ID:        "todo-ac04",
		UserID:    userID,
		Title:     "Revisar contrato",
		Status:    domain.TodoStatusPending,
		Priority:  "high",
		DueDate:   &due,
		CreatedAt: now,
		UpdatedAt: now,
	}); err != nil {
		t.Fatalf("create todo: %v", err)
	}

	todoWorker := tasks.NewTodoReminderWorker(todoRepo, notifSvc, 15*time.Minute)
	todoWorker.SetAttentionBudget(budgetSvc)

	sent, err := todoWorker.CheckAndDispatchReminders(now)
	if err != nil {
		t.Fatalf("TodoReminderWorker failed: %v", err)
	}
	if sent != 0 || atomic.LoadInt32(&pushCount) != 0 {
		t.Fatalf("AC-04: expected 0 pushes when tarefas disabled in AttentionBudget, got sent=%d pushes=%d", sent, atomic.LoadInt32(&pushCount))
	}

	// Reabilita e garante envio único + instanciação dos outros workers com SetAttentionBudget
	budgetSvc.SetCategoryPreference(userID, "tarefas", true)
	pendingWorker := tasks.NewPendingNudgeWorker(pendingRepo, userRepo, notifSvc, 1*time.Minute)
	pendingWorker.SetAttentionBudget(budgetSvc)
	summaryWorker := service.NewExecutiveSummaryWorker(db, userRepo, notifSvc, 1*time.Minute)
	summaryWorker.SetAttentionBudget(budgetSvc)
}
