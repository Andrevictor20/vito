package service_test

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
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

func TestTodoService_SubtasksAndEventLink(t *testing.T) {
	todoSvc, _ := setupTodoService(t)

	// 1. Criar tarefa vinculada a um evento
	todo, err := todoSvc.CreateTodoWithOptions("user-todo-svc-1", domain.CreateTodoInput{
		Title:      "Comprar presente de aniversário",
		Priority:   "high",
		EventID:    "event-party-99",
		EventTitle: "Aniversário da Maria",
	})
	if err != nil {
		t.Fatalf("falha ao criar tarefa com opções: %v", err)
	}
	if todo.EventID != "event-party-99" || todo.EventTitle != "Aniversário da Maria" {
		t.Errorf("vínculo de evento incorreto: %+v", todo)
	}

	// 2. Adicionar subtarefas
	sub1, err := todoSvc.AddSubtask(todo.ID, "user-todo-svc-1", "Pesquisar opções na Amazon")
	if err != nil {
		t.Fatalf("falha ao adicionar subtarefa 1: %v", err)
	}
	if sub1.Completed {
		t.Errorf("subtarefa recém-criada deve iniciar incompleta")
	}

	_, err = todoSvc.AddSubtask(todo.ID, "user-todo-svc-1", "Embrulhar com fita dourada")
	if err != nil {
		t.Fatalf("falha ao adicionar subtarefa 2: %v", err)
	}

	// 3. Alternar status da subtarefa 1
	sub1Toggled, err := todoSvc.ToggleSubtask(sub1.ID, todo.ID, "user-todo-svc-1")
	if err != nil {
		t.Fatalf("falha ao alternar subtarefa: %v", err)
	}
	if !sub1Toggled.Completed {
		t.Errorf("esperava subtarefa 1 concluída após toggle")
	}

	// 4. Listar tarefas e validar subtarefas aninhadas
	todos, err := todoSvc.ListTodos("user-todo-svc-1", domain.TodoStatusPending)
	if err != nil {
		t.Fatalf("falha ao listar todos: %v", err)
	}
	if len(todos) != 1 {
		t.Fatalf("esperava 1 tarefa, obteve %d", len(todos))
	}
	if len(todos[0].Subtasks) != 2 {
		t.Fatalf("esperava 2 subtarefas na tarefa pai, obteve %d", len(todos[0].Subtasks))
	}
	if !todos[0].Subtasks[0].Completed && !todos[0].Subtasks[1].Completed {
		t.Errorf("uma das subtarefas deveria estar concluída")
	}
}

func TestTodoService_HeuristicPriority(t *testing.T) {
	cases := []struct {
		title    string
		dueDate  *time.Time
		expected string
	}{
		{"Pagar conta urgente de luz", nil, "high"},
		{"Emergência médica no trabalho", nil, "high"},
		{"Ligar para o banco agora", nil, "high"},
		{"Prazo final do relatório", nil, "high"},
		{"Comprar leite", timePtr(time.Now().Add(6 * time.Hour)), "high"},     // < 24h
		{"Revisar artigo", timePtr(time.Now().Add(48 * time.Hour)), "medium"}, // < 72h
		{"Ler livro de ficção", nil, "low"},
		{"Planejar férias de verão", timePtr(time.Now().Add(10 * 24 * time.Hour)), "low"},
	}

	for _, c := range cases {
		p := service.ClassifyTodoPriority(c.title, c.dueDate)
		if p != c.expected {
			t.Errorf("ClassifyTodoPriority(%q, %v) = %s; expected %s", c.title, c.dueDate, p, c.expected)
		}
	}
}

func timePtr(t time.Time) *time.Time {
	return &t
}

func strPtr(s string) *string {
	return &s
}

func intPtr(i int) *int {
	return &i
}

func TestTodoService_UpdateTodo(t *testing.T) {
	todoSvc, _ := setupTodoService(t)

	due := time.Now().Add(48 * time.Hour).UTC().Truncate(time.Second)
	rem := time.Now().Add(24 * time.Hour).UTC().Truncate(time.Second)
	todo, err := todoSvc.CreateTodoWithOptions("user-todo-svc-1", domain.CreateTodoInput{
		Title:    "Título original",
		Priority: "low",
		DueDate:  &due,
	})
	if err != nil {
		t.Fatalf("falha ao criar tarefa: %v", err)
	}

	newTitle := "Título editado"
	newPriority := "high"
	newDue := time.Now().Add(72 * time.Hour).UTC().Truncate(time.Second)
	newRepeat := "daily"
	newAdvance := 30
	updated, err := todoSvc.UpdateTodo(todo.ID, "user-todo-svc-1", domain.UpdateTodoInput{
		Title:         &newTitle,
		Priority:      &newPriority,
		DueDate:       &newDue,
		RemindAt:      &rem,
		RemindRepeat:  &newRepeat,
		RemindAdvance: &newAdvance,
	})
	if err != nil {
		t.Fatalf("falha ao atualizar tarefa: %v", err)
	}
	if updated.Title != newTitle {
		t.Errorf("esperava título %q, obteve %q", newTitle, updated.Title)
	}
	if updated.Priority != newPriority {
		t.Errorf("esperava prioridade %q, obteve %q", newPriority, updated.Priority)
	}
	if updated.DueDate == nil || !updated.DueDate.Equal(newDue) {
		t.Errorf("prazo não atualizado: %+v", updated.DueDate)
	}
	if updated.RemindAt == nil || !updated.RemindAt.Equal(rem) {
		t.Errorf("lembrete não atualizado: %+v", updated.RemindAt)
	}
	if updated.RemindRepeat != newRepeat || updated.RemindAdvance != newAdvance {
		t.Errorf("repetição/aviso não atualizados: %+v", updated)
	}

	// Título vazio deve ser rejeitado.
	empty := "   "
	if _, err := todoSvc.UpdateTodo(todo.ID, "user-todo-svc-1", domain.UpdateTodoInput{Title: &empty}); err == nil {
		t.Errorf("esperava erro ao atualizar com título vazio")
	}

	// Tarefa inexistente deve retornar ErrTodoNotFound.
	if _, err := todoSvc.UpdateTodo("inexistente", "user-todo-svc-1", domain.UpdateTodoInput{Title: &newTitle}); err == nil {
		t.Errorf("esperava erro ao atualizar tarefa inexistente")
	}
}
