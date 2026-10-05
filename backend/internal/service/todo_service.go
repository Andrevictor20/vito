package service

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// ClassifyTodoPriority analisa o texto e prazo da tarefa para definir urgência heurística.
func ClassifyTodoPriority(title string, dueDate *time.Time) string {
	lower := strings.ToLower(title)
	urgentKeywords := []string{"urgente", "emergência", "emergencia", "agora", "imediato", "prazo final"}
	for _, kw := range urgentKeywords {
		if strings.Contains(lower, kw) {
			return "high"
		}
	}

	if dueDate != nil {
		diff := dueDate.Sub(time.Now().UTC())
		if diff <= 24*time.Hour {
			return "high"
		}
		if diff <= 72*time.Hour {
			return "medium"
		}
		return "low"
	}

	return "low"
}

// TodoService orquestra tarefas e pendências do usuário.
type TodoService struct {
	todoRepo domain.TodoRepository
}

// NewTodoService instancia o serviço de tarefas.
func NewTodoService(todoRepo domain.TodoRepository) *TodoService {
	return &TodoService{todoRepo: todoRepo}
}

// CreateTodoWithOptions adiciona uma nova tarefa com opções completas (vínculo de evento e priorização heurística).
func (s *TodoService) CreateTodoWithOptions(userID string, input domain.CreateTodoInput) (*domain.Todo, error) {
	if input.Title == "" {
		return nil, errors.New("o título da tarefa é obrigatório")
	}

	if input.Priority == "" {
		input.Priority = ClassifyTodoPriority(input.Title, input.DueDate)
	}

	now := time.Now().UTC()
	todo := &domain.Todo{
		ID:         uuid.New().String(),
		UserID:     userID,
		Title:      input.Title,
		Status:     domain.TodoStatusPending,
		Priority:   input.Priority,
		DueDate:    input.DueDate,
		EventID:    input.EventID,
		EventTitle: input.EventTitle,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if err := s.todoRepo.Create(todo); err != nil {
		return nil, err
	}

	return todo, nil
}

// CreateTodo adiciona uma nova tarefa com prioridade padrão ou heurística.
func (s *TodoService) CreateTodo(userID, title, priority string, dueDate *time.Time) (*domain.Todo, error) {
	return s.CreateTodoWithOptions(userID, domain.CreateTodoInput{
		Title:    title,
		Priority: priority,
		DueDate:  dueDate,
	})
}

// AddSubtask adiciona uma subtarefa à pendência existente.
func (s *TodoService) AddSubtask(todoID, userID, title string) (*domain.Subtask, error) {
	if title == "" {
		return nil, errors.New("o título da subtarefa é obrigatório")
	}
	_, err := s.todoRepo.GetByID(todoID, userID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	st := &domain.Subtask{
		ID:        uuid.New().String(),
		TodoID:    todoID,
		Title:     title,
		Completed: false,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.todoRepo.AddSubtask(st); err != nil {
		return nil, err
	}
	return st, nil
}

// ToggleSubtask alterna o estado de conclusão da subtarefa.
func (s *TodoService) ToggleSubtask(subtaskID, todoID, userID string) (*domain.Subtask, error) {
	_, err := s.todoRepo.GetByID(todoID, userID)
	if err != nil {
		return nil, err
	}
	return s.todoRepo.ToggleSubtask(subtaskID, todoID)
}

// DeleteSubtask remove uma subtarefa pertencente ao usuário.
func (s *TodoService) DeleteSubtask(subtaskID, todoID, userID string) error {
	_, err := s.todoRepo.GetByID(todoID, userID)
	if err != nil {
		return err
	}
	return s.todoRepo.DeleteSubtask(subtaskID, todoID)
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
