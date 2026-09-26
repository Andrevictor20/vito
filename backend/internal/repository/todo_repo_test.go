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
	dbPath := filepath.Join(tmpDir, "test_kito_todo.db")

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
