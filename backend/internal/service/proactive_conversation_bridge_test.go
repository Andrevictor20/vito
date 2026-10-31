package service_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func TestProactiveConversationBridge_NilRepo_Safe(t *testing.T) {
	bridge := service.NewProactiveConversationBridge(nil)
	err := bridge.RecordProactiveNotification(context.Background(), "u1", "app", "reminder", "msg")
	if err != nil {
		t.Fatalf("esperava nil ao gravar com repo nil, obteve %v", err)
	}
}

func TestProactiveConversationBridge_RecordAndQuery(t *testing.T) {
	tmpDir := t.TempDir()
	db, err := database.Open(filepath.Join(tmpDir, "proactive_bridge_test.db"))
	if err != nil {
		t.Fatalf("falha ao abrir sqlite de teste: %v", err)
	}
	defer db.Close()

	convRepo := repository.NewConversationStoreRepository(db)
	userRepo := repository.NewUserRepository(db)
	bridge := service.NewProactiveConversationBridge(convRepo)
	ctx := context.Background()
	userID := "user-proactive-1"

	_ = userRepo.Create(&domain.User{
		ID:        userID,
		Name:      "Proactive Tester",
		Email:     "proactive@vito.local",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})

	err = bridge.RecordProactiveNotification(ctx, userID, "app", "morning_briefing", "Bom dia! Você tem 2 compromissos hoje.")
	if err != nil {
		t.Fatalf("falha ao registrar notificação proativa: %v", err)
	}

	threads, err := convRepo.ListThreadsByUser(ctx, userID, "app", 10)
	if err != nil || len(threads) == 0 {
		t.Fatalf("esperava thread criada para canal 'app', obteve %v", err)
	}

	turns, err := convRepo.ListTurnsByThread(ctx, threads[0].ID, 10)
	if err != nil || len(turns) != 1 {
		t.Fatalf("esperava 1 turno proativo gravado, obteve %d", len(turns))
	}

	turn := turns[0]
	if turn.Role != "assistant" {
		t.Errorf("esperava role 'assistant', obteve %s", turn.Role)
	}
	if turn.Origin != "proactive_worker" {
		t.Errorf("esperava origin 'proactive_worker', obteve %s", turn.Origin)
	}
	if turn.WorkerType != "morning_briefing" {
		t.Errorf("esperava workerType 'morning_briefing', obteve %s", turn.WorkerType)
	}
}

func TestMorningBriefingWorker_RecordsTurnInBridge(t *testing.T) {
	tmpDir := t.TempDir()
	db, err := database.Open(filepath.Join(tmpDir, "briefing_worker_bridge.db"))
	if err != nil {
		t.Fatalf("falha ao abrir sqlite de teste: %v", err)
	}
	defer db.Close()

	briefingRepo := repository.NewBriefingRepository(db)
	eventRepo := repository.NewEventRepository(db)
	todoRepo := repository.NewTodoRepository(db)
	userRepo := repository.NewUserRepository(db)
	notifRepo := repository.NewDeviceTokenRepository(db)
	notifSvc := service.NewNotificationService(notifRepo)
	convRepo := repository.NewConversationStoreRepository(db)
	proactiveBridge := service.NewProactiveConversationBridge(convRepo)

	userID := "briefing-test-user"
	_ = userRepo.Create(&domain.User{
		ID:        userID,
		Name:      "Carlos Silva",
		Email:     "carlos@vito.local",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})
	_ = briefingRepo.UpsertSettings(&domain.BriefingSettings{
		UserID:        userID,
		ScheduledTime: "08:00",
		Enabled:       true,
	})

	worker := service.NewMorningBriefingWorker(briefingRepo, eventRepo, todoRepo, userRepo, notifSvc, time.Minute)
	worker.SetProactiveBridge(proactiveBridge)
	loc := time.UTC
	worker.SetLocation(loc)

	now := time.Date(2026, 10, 30, 8, 0, 0, 0, loc)
	dispatched, err := worker.ProcessBriefings(now)
	if err != nil {
		t.Fatalf("erro ao processar briefings: %v", err)
	}
	if dispatched < 0 {
		t.Fatalf("dispatched inválido: %d", dispatched)
	}

	threads, err := convRepo.ListThreadsByUser(context.Background(), userID, "app", 5)
	if err == nil && len(threads) > 0 {
		turns, _ := convRepo.ListTurnsByThread(context.Background(), threads[0].ID, 5)
		if len(turns) > 0 {
			if turns[0].WorkerType != "morning_briefing" {
				t.Errorf("esperava worker_type morning_briefing, obteve %s", turns[0].WorkerType)
			}
		}
	}
}
