package service_test

import (
	"testing"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// Desfazer conclusão: tarefa concluída volta a pendente.
func TestTodoService_Reopen(t *testing.T) {
	todoSvc, todoRepo := setupTodoService(t)

	todo, err := todoSvc.CreateTodo("user-todo-svc-1", "Revisar PR", "medium", nil)
	if err != nil {
		t.Fatalf("falha ao criar: %v", err)
	}
	if err := todoSvc.CompleteTodo(todo.ID, "user-todo-svc-1"); err != nil {
		t.Fatalf("falha ao concluir: %v", err)
	}

	if err := todoSvc.ReopenTodo(todo.ID, "user-todo-svc-1"); err != nil {
		t.Fatalf("falha ao reabrir: %v", err)
	}

	got, err := todoRepo.GetByID(todo.ID, "user-todo-svc-1")
	if err != nil {
		t.Fatalf("falha ao buscar: %v", err)
	}
	if got.Status != domain.TodoStatusPending {
		t.Fatalf("esperava pending após reabrir, obteve %s", got.Status)
	}

	// Reabrir de outro usuário não pode funcionar
	if err := todoSvc.ReopenTodo(todo.ID, "outro-user"); err == nil {
		t.Fatalf("esperava erro ao reabrir tarefa de outro usuário")
	}
}
