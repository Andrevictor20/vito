package service_test

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/kito/backend/internal/database"
	"github.com/andrevmp/kito/backend/internal/domain"
	"github.com/andrevmp/kito/backend/internal/repository"
	"github.com/andrevmp/kito/backend/internal/service"
)

func setupTodoService(t *testing.T) (*service.TodoService, domain.TodoRepository) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_todo_svc.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	todoRepo := repository.NewTodoRepository(db)

	_ = userRepo.Create(&domain.User{
		ID:           "user-todo-svc-1",
		Name:         "User Todo Svc",
		Email:        "todosvc@example.com",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	})

	todoSvc := service.NewTodoService(todoRepo)
	return todoSvc, todoRepo
}

func TestTodoService_Lifecycle(t *testing.T) {
	todoSvc, _ := setupTodoService(t)

	// 1. Criar tarefa
	todo, err := todoSvc.CreateTodo("user-todo-svc-1", "Comprar café em grãos", "high", nil)
	if err != nil {
		t.Fatalf("expected nil error on create todo, got: %v", err)
	}
	if todo.Status != domain.TodoStatusPending {
		t.Errorf("expected pending status, got %s", todo.Status)
	}

	// 2. Concluir tarefa
	err = todoSvc.CompleteTodo(todo.ID, "user-todo-svc-1")
	if err != nil {
		t.Fatalf("expected nil error on complete todo, got: %v", err)
	}

	// 3. Listar tarefas pendentes
	pending, err := todoSvc.ListTodos("user-todo-svc-1", domain.TodoStatusPending)
	if err != nil {
		t.Fatalf("failed to list pending: %v", err)
	}
	if len(pending) != 0 {
		t.Errorf("expected 0 pending, got %d", len(pending))
	}
}
