package repository_test

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func setupTodoTestDB(t *testing.T) (*repository.TodoRepositorySQLite, *repository.UserRepositorySQLite) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_vito_todo.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	todoRepo := repository.NewTodoRepository(db)

	_ = userRepo.Create(&domain.User{
		ID:           "user-todo-1",
		Name:         "User Todo",
		Email:        "todo@example.com",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	})

	return todoRepo, userRepo
}

func TestTodoRepository_Lifecycle(t *testing.T) {
	todoRepo, _ := setupTodoTestDB(t)

	now := time.Now().UTC().Truncate(time.Second)
	dueDate := now.Add(24 * time.Hour)

	todo := &domain.Todo{
		ID:        "todo-1",
		UserID:    "user-todo-1",
		Title:     "Comprar ração para o gato",
		Status:    domain.TodoStatusPending,
		Priority:  "high",
		DueDate:   &dueDate,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := todoRepo.Create(todo); err != nil {
		t.Fatalf("failed to create todo: %v", err)
	}

	// Listar pendentes
	list, err := todoRepo.ListByUser("user-todo-1", domain.TodoStatusPending)
	if err != nil {
		t.Fatalf("failed to list todos: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 todo, got %d", len(list))
	}

	// Concluir tarefa
	if err := todoRepo.UpdateStatus("todo-1", "user-todo-1", domain.TodoStatusCompleted); err != nil {
		t.Fatalf("failed to update status: %v", err)
	}

	// Verificar se saiu da lista de pendentes
	listPending, _ := todoRepo.ListByUser("user-todo-1", domain.TodoStatusPending)
	if len(listPending) != 0 {
		t.Errorf("expected 0 pending todos, got %d", len(listPending))
	}
}

func TestTodoRepository_Reminders(t *testing.T) {
	todoRepo, _ := setupTodoTestDB(t)

	now := time.Now().UTC().Truncate(time.Second)
	dueAdv := now.Add(10 * time.Minute)
	dueNow := now.Add(30 * time.Second)

	tAdv := &domain.Todo{
		ID:        "todo-adv-1",
		UserID:    "user-todo-1",
		Title:     "Pagar conta de luz",
		Status:    domain.TodoStatusPending,
		Priority:  "high",
		DueDate:   &dueAdv,
		CreatedAt: now,
		UpdatedAt: now,
	}
	tNow := &domain.Todo{
		ID:        "todo-now-1",
		UserID:    "user-todo-1",
		Title:     "Comprimido das 18h",
		Status:    domain.TodoStatusPending,
		Priority:  "high",
		DueDate:   &dueNow,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := todoRepo.Create(tAdv); err != nil {
		t.Fatalf("failed to create tAdv: %v", err)
	}
	if err := todoRepo.Create(tNow); err != nil {
		t.Fatalf("failed to create tNow: %v", err)
	}

	// 1. ListUpcomingUnreminded para janela [now, now + 15m]
	upcoming, err := todoRepo.ListUpcomingUnreminded(now, now.Add(15*time.Minute))
	if err != nil {
		t.Fatalf("ListUpcomingUnreminded failed: %v", err)
	}
	if len(upcoming) != 2 {
		t.Fatalf("expected 2 upcoming todos, got %d", len(upcoming))
	}

	// Marca lembrete de antecedência para todo-adv-1
	if err := todoRepo.MarkReminderSent("todo-adv-1", now); err != nil {
		t.Fatalf("MarkReminderSent failed: %v", err)
	}

	// Agora apenas todo-now-1 deve estar pendente de antecedência
	upcomingAfter, err := todoRepo.ListUpcomingUnreminded(now, now.Add(15*time.Minute))
	if err != nil {
		t.Fatalf("ListUpcomingUnreminded after mark failed: %v", err)
	}
	if len(upcomingAfter) != 1 || upcomingAfter[0].ID != "todo-now-1" {
		t.Fatalf("expected 1 unreminded todo (todo-now-1), got %d", len(upcomingAfter))
	}

	// 2. ListDueNowUnreminded para janela [now - 1m, now + 1m]
	dueNowList, err := todoRepo.ListDueNowUnreminded(now.Add(-1*time.Minute), now.Add(1*time.Minute))
	if err != nil {
		t.Fatalf("ListDueNowUnreminded failed: %v", err)
	}
	if len(dueNowList) != 1 || dueNowList[0].ID != "todo-now-1" {
		t.Fatalf("expected 1 due now todo (todo-now-1), got %d", len(dueNowList))
	}

	// Marca lembrete de prazo para todo-now-1
	if err := todoRepo.MarkDueReminderSent("todo-now-1", now); err != nil {
		t.Fatalf("MarkDueReminderSent failed: %v", err)
	}

	// Deve retornar vazio
	dueNowAfter, _ := todoRepo.ListDueNowUnreminded(now.Add(-1*time.Minute), now.Add(1*time.Minute))
	if len(dueNowAfter) != 0 {
		t.Fatalf("expected 0 due now todos after mark, got %d", len(dueNowAfter))
	}
}
