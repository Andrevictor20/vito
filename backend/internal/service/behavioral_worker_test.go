package service_test

import (
	"context"
	"github.com/andrevmp/vito/backend/internal/calendar"
	"github.com/andrevmp/vito/backend/internal/tasks"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

type recordingBehavioralPush struct {
	mu     sync.Mutex
	titles []string
}

func (r *recordingBehavioralPush) SendPushToUser(userID, title, body, priority string, data map[string]interface{}) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.titles = append(r.titles, title)
	return 1, nil
}

func (r *recordingBehavioralPush) count() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.titles)
}

func TestBehavioralWorker_Consolidate(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "behav.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	userID := "u-behav"
	now := time.Now().UTC().Truncate(time.Hour)
	_, err = db.Exec(`INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?,?,?,?,?,?)`,
		userID, "b@b.com", "B", "h", now, now)
	if err != nil {
		t.Fatal(err)
	}
	todoRepo := tasks.NewTodoRepository(db)
	eventRepo := calendar.NewEventRepository(db)
	memRepo := repository.NewMemoryRepository(db)

	// 3 tarefas concluídas às 09h (janela de pico) + 1 pendente antiga de estudos.
	for i := 0; i < 3; i++ {
		done := now.AddDate(0, 0, -(i + 1))
		done = time.Date(done.Year(), done.Month(), done.Day(), 9, 30, 0, 0, time.UTC)
		_, err = db.Exec(`INSERT INTO todos (id, user_id, title, status, priority, category, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`,
			"d"+string(rune('0'+i)), userID, "feita", "completed", "medium", "geral", done, done)
		if err != nil {
			t.Fatal(err)
		}
	}
	old := now.AddDate(0, 0, -10)
	_, err = db.Exec(`INSERT INTO todos (id, user_id, title, status, priority, category, due_date, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
		"old1", userID, "estudar go", "pending", "medium", "estudos", old, old, old)
	if err != nil {
		t.Fatal(err)
	}
	// 3 reuniões numa segunda-feira.
	monday := now.AddDate(0, 0, -int(now.Weekday())+1-7)
	if monday.After(now) {
		monday = monday.AddDate(0, 0, -7)
	}
	for i := 0; i < 3; i++ {
		s := monday.Add(time.Duration(9+i) * time.Hour)
		e := s.Add(time.Hour)
		_, err = db.Exec(`INSERT INTO events (id, user_id, title, start_at, end_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`,
			"ev"+string(rune('0'+i)), userID, "reunião", s, e, now, now)
		if err != nil {
			t.Fatal(err)
		}
	}

	w := service.NewBehavioralWorker(todoRepo, eventRepo, memRepo)
	n, err := w.Consolidate(userID)
	if err != nil {
		t.Fatal(err)
	}
	if n != 3 {
		t.Fatalf("esperava 3 insights, vieram %d", n)
	}
	mems, err := memRepo.ListByUser(userID, 50)
	if err != nil {
		t.Fatal(err)
	}
	insights := 0
	for _, m := range mems {
		if m.Category == "behavioral_insight" {
			insights++
		}
	}
	if insights != 3 {
		t.Fatalf("esperava 3 memórias de insight, vieram %d", insights)
	}

	// Segunda consolidação rotaciona (continua 3, sem duplicar).
	n2, err := w.Consolidate(userID)
	if err != nil {
		t.Fatal(err)
	}
	if n2 != 3 {
		t.Fatalf("rotação deveria gerar 3, veio %d", n2)
	}
	mems2, _ := memRepo.ListByUser(userID, 50)
	count := 0
	for _, m := range mems2 {
		if m.Category == "behavioral_insight" {
			count++
		}
	}
	if count != 3 {
		t.Fatalf("rotação duplicou insights: %d", count)
	}
}

func TestBehavioralWorker_AttentionBudget_DefersAndDeduplicates(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "behav_budget.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	userID := "u-behav-budget"
	now := time.Now().UTC()
	_, err = db.Exec(`INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?,?,?,?,?,?)`,
		userID, "bb@b.com", "BB", "h", now, now)
	if err != nil {
		t.Fatal(err)
	}

	todoRepo := tasks.NewTodoRepository(db)
	eventRepo := calendar.NewEventRepository(db)
	memRepo := repository.NewMemoryRepository(db)

	for i := 0; i < 2; i++ {
		done := now.AddDate(0, 0, -(i + 1))
		done = time.Date(done.Year(), done.Month(), done.Day(), 10, 0, 0, 0, time.UTC)
		_, _ = db.Exec(`INSERT INTO todos (id, user_id, title, status, priority, category, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`,
			"bd"+string(rune('0'+i)), userID, "tarefa", "completed", "medium", "geral", done, done)
	}
	// Evento ativo agora: silencia notificações leves
	_ = eventRepo.Create(&domain.Event{
		ID:        "ev-active-behav",
		UserID:    userID,
		Title:     "Call em andamento",
		StartAt:   now.Add(-15 * time.Minute),
		EndAt:     now.Add(45 * time.Minute),
		CreatedAt: now,
		UpdatedAt: now,
	})

	budget := service.NewAttentionBudgetService(db, eventRepo)
	push := &recordingBehavioralPush{}

	w := service.NewBehavioralWorker(todoRepo, eventRepo, memRepo)
	w.SetAttentionBudget(budget)
	w.SetNotificationService(push)

	n, err := w.Consolidate(userID)
	if err != nil || n == 0 {
		t.Fatalf("esperava insights consolidados mesmo com silêncio de agenda: n=%d err=%v", n, err)
	}
	if push.count() != 0 {
		t.Fatalf("esperava push adiado (DEFERRED) durante evento ativo, mas enviou %d", push.count())
	}

	// Remove o evento ativo e avalia outro usuário sem evento ativo (primeiro envio -> DELIVERED, segundo -> DEDUPLICATED)
	userID2 := "u-behav-budget-2"
	_, _ = db.Exec(`INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?,?,?,?,?,?)`,
		userID2, "bb2@b.com", "BB2", "h", now, now)
	for i := 0; i < 2; i++ {
		done := now.AddDate(0, 0, -(i + 1))
		done = time.Date(done.Year(), done.Month(), done.Day(), 10, 0, 0, 0, time.UTC)
		_, _ = db.Exec(`INSERT INTO todos (id, user_id, title, status, priority, category, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`,
			"bd2"+string(rune('0'+i)), userID2, "tarefa", "completed", "medium", "geral", done, done)
	}
	if _, err := w.Consolidate(userID2); err != nil {
		t.Fatal(err)
	}
	if push.count() != 1 {
		t.Fatalf("esperava 1 push entregue fora de evento ativo, obteve %d", push.count())
	}
	// Segundo ciclo imediato para o mesmo insight deve ser deduplicado
	if _, err := w.Consolidate(userID2); err != nil {
		t.Fatal(err)
	}
	if push.count() != 1 {
		t.Fatalf("esperava deduplicação no segundo envio, mas enviou %d", push.count())
	}
	_ = context.Background()
}
