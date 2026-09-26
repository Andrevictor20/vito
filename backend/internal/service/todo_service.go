package service

import (
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// TodoService orquestra tarefas e pendências do usuário.
type TodoService struct {
	todoRepo domain.TodoRepository
}

// NewTodoService instancia o serviço de tarefas.
func NewTodoService(todoRepo domain.TodoRepository) *TodoService {
	return &TodoService{todoRepo: todoRepo}
}

// CreateTodo adiciona uma nova tarefa com prioridade padrão.
func (s *TodoService) CreateTodo(userID, title, priority string, dueDate *time.Time) (*domain.Todo, error) {
	if title == "" {
		return nil, errors.New("o título da tarefa é obrigatório")
	}
	if priority == "" {
		priority = "medium"
	}

	now := time.Now().UTC()
	todo := &domain.Todo{
		ID:        uuid.New().String(),
		UserID:    userID,
		Title:     title,
		Status:    domain.TodoStatusPending,
		Priority:  priority,
		DueDate:   dueDate,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.todoRepo.Create(todo); err != nil {
		return nil, err
	}

	return todo, nil
}

// CompleteTodo marca uma tarefa como concluída.
func (s *TodoService) CompleteTodo(id, userID string) error {
	return s.todoRepo.UpdateStatus(id, userID, domain.TodoStatusCompleted)
}

// ListTodos retorna tarefas filtradas pelo status do usuário autenticado.
func (s *TodoService) ListTodos(userID string, status domain.TodoStatus) ([]domain.Todo, error) {
	return s.todoRepo.ListByUser(userID, status)
}

// DeleteTodo remove uma tarefa do usuário.
func (s *TodoService) DeleteTodo(id, userID string) error {
	return s.todoRepo.Delete(id, userID)
}
