package repository_test

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

func setupNotifDedupDB(t *testing.T) (*repository.NotificationsInboxRepositorySQLite, *service.NotificationsInboxService, string) {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "notif_dedup.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("database.Open failed: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	userID := "user-ac01"
	now := time.Now().UTC()
	_, err = db.Exec(`
		INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
		VALUES (?, 'Test User', 'ac01@vito.app', 'hash', ?, ?)
	`, userID, now, now)
	if err != nil {
		t.Fatalf("insert user failed: %v", err)
	}

	repo := repository.NewNotificationsInboxRepository(db)
	svc := service.NewNotificationsInboxService(repo)
	return repo, svc, userID
}

func TestAC01_OverdueSyncIdempotentAcrossRepeatedReads(t *testing.T) {
	repo, svc, userID := setupNotifDedupDB(t)
	ctx := context.Background()

	// Cria 1 tarefa atrasada com timestamp Go real (time.Now().UTC()).
	overdueAt := time.Now().UTC().Add(-4 * time.Hour)
	todoRepo := repository.NewTodoRepository(nil)
	_ = todoRepo
	// Inserção direta no banco real para testar o SQL exato de SyncOverdueTodoNotifications.
	dbPath := filepath.Join(t.TempDir(), "notif_ac01.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("database.Open failed: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()
	_, err = db.Exec(`INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES (?, 'U', 'u@vito.app', 'h', ?, ?)`, userID, now, now)
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}
	_, err = db.Exec(`
		INSERT INTO todos (id, user_id, title, status, priority, due_date, created_at, updated_at)
		VALUES ('todo-1', ?, 'Pagar conta', 'pending', 'high', ?, ?, ?)
	`, userID, overdueAt, now, now)
	if err != nil {
		t.Fatalf("insert todo: %v", err)
	}

	_ = repo
	_ = svc
	realRepo := repository.NewNotificationsInboxRepository(db)
	realSvc := service.NewNotificationsInboxService(realRepo)

	// Simula 10 chamadas consecutivas a GET /api/v1/notifications.
	for i := 0; i < 10; i++ {
		items, counts, listErr := realSvc.ListNotifications(ctx, userID, domain.NotificationInboxFilter{})
		if listErr != nil {
			t.Fatalf("iter %d: ListNotifications failed: %v", i, listErr)
		}
		if len(items) != 1 {
			t.Fatalf("AC-01 iter %d: expected exactly 1 notification, got %d", i, len(items))
		}
		if counts.All != 1 {
			t.Fatalf("AC-01 iter %d: expected counts.All == 1, got %d", i, counts.All)
		}
	}

	var totalRows int
	if err := db.QueryRow(`SELECT COUNT(1) FROM user_notifications WHERE user_id = ? AND is_dismissed = 0`, userID).Scan(&totalRows); err != nil {
		t.Fatalf("count rows: %v", err)
	}
	if totalRows != 1 {
		t.Fatalf("AC-01: expected exactly 1 active row in user_notifications, got %d", totalRows)
	}
}

func TestAC02_RescheduleTodayEndOfLocalDayAndDismissesAll(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "notif_ac02.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("database.Open failed: %v", err)
	}
	defer db.Close()

	ctx := context.Background()
	userID := "user-ac02"
	// 21:00 UTC = 18:00 America/Sao_Paulo
	nowUTC := time.Date(2026, 11, 24, 21, 0, 0, 0, time.UTC)
	_, err = db.Exec(`INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES (?, 'U2', 'u2@vito.app', 'h', ?, ?)`, userID, nowUTC, nowUTC)
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}

	overdueAt := nowUTC.Add(-6 * time.Hour)
	_, err = db.Exec(`
		INSERT INTO todos (id, user_id, title, status, priority, due_date, created_at, updated_at)
		VALUES ('t-1', ?, 'Tarefa 1', 'pending', 'medium', ?, ?, ?),
		       ('t-2', ?, 'Tarefa 2', 'pending', 'high', ?, ?, ?)
	`, userID, overdueAt, nowUTC, nowUTC, userID, overdueAt, nowUTC, nowUTC)
	if err != nil {
		t.Fatalf("insert todos: %v", err)
	}

	// Insere duas notificações overdue_summary (uma legada e uma diária)
	_, err = db.Exec(`
		INSERT INTO user_notifications (id, user_id, group_key, type, source_domain, source_id, title, body, is_unread, is_dismissed, created_at)
		VALUES ('n-old', ?, 'Hoje', 'alerta', 'tarefas', 'overdue_summary', '2 tarefas atrasadas', 'b', 1, 0, ?),
		       ('n-day', ?, 'Hoje', 'alerta', 'tarefas', 'overdue_summary:2026-11-24', '2 tarefas atrasadas', 'b', 1, 0, ?)
	`, userID, nowUTC.Add(-2*time.Hour), userID, nowUTC)
	if err != nil {
		t.Fatalf("insert notifications: %v", err)
	}

	repo := repository.NewNotificationsInboxRepository(db)
	count, err := repo.RescheduleOverdueTodosToday(ctx, userID, nowUTC)
	if err != nil {
		t.Fatalf("RescheduleOverdueTodosToday failed: %v", err)
	}
	if count != 2 {
		t.Fatalf("AC-02: expected 2 rescheduled todos, got %d", count)
	}

	loc, _ := time.LoadLocation("America/Sao_Paulo")
	wantLocalEnd := time.Date(2026, 11, 24, 23, 59, 59, 0, loc).UTC()

	var due time.Time
	if err := db.QueryRow(`SELECT due_date FROM todos WHERE id = 't-1'`).Scan(&due); err != nil {
		t.Fatalf("scan due_date: %v", err)
	}
	if !due.UTC().Equal(wantLocalEnd) {
		t.Fatalf("AC-02: due_date = %v, want %v (23:59:59 America/Sao_Paulo)", due.UTC(), wantLocalEnd)
	}

	var openOverdueNotifs int
	if err := db.QueryRow(`
		SELECT COUNT(1) FROM user_notifications
		WHERE user_id = ? AND source_domain = 'tarefas' AND source_id LIKE 'overdue_summary%' AND is_dismissed = 0
	`, userID).Scan(&openOverdueNotifs); err != nil {
		t.Fatalf("count open overdue notifs: %v", err)
	}
	if openOverdueNotifs != 0 {
		t.Fatalf("AC-02: expected 0 open overdue_summary* notifications, got %d", openOverdueNotifs)
	}
}
