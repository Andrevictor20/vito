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
	if strings.TrimSpace(input.Category) == "" {
		input.Category = "geral"
	}

	now := time.Now().UTC()
	todo := &domain.Todo{
		ID:            uuid.New().String(),
		UserID:        userID,
		Title:         input.Title,
		Status:        domain.TodoStatusPending,
		Priority:      input.Priority,
		Category:      normalizeTodoCategory(input.Category),
		DueDate:       input.DueDate,
		RemindAt:      input.RemindAt,
		RemindRepeat:  input.RemindRepeat,
		RemindAdvance: input.RemindAdvance,
		EventID:       input.EventID,
		EventTitle:    input.EventTitle,
		CreatedAt:     now,
		UpdatedAt:     now,
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

// UpdateTodo aplica a edição completa de uma tarefa (título, prioridade, prazo e lembrete).
func (s *TodoService) UpdateTodo(id, userID string, input domain.UpdateTodoInput) (*domain.Todo, error) {
	todo, err := s.todoRepo.GetByID(id, userID)
	if err != nil {
		return nil, err
	}

	if input.Title != nil {
		trimmed := strings.TrimSpace(*input.Title)
		if trimmed == "" {
			return nil, errors.New("o título da tarefa é obrigatório")
		}
		todo.Title = trimmed
	}

	if input.Priority != nil {
		switch *input.Priority {
		case "low", "medium", "high":
			todo.Priority = *input.Priority
		default:
			return nil, errors.New("prioridade inválida")
		}
	}

	if input.Category != nil {
		todo.Category = normalizeTodoCategory(*input.Category)
	}

	if input.DueDate != nil {
		todo.DueDate = input.DueDate
	}

	if input.RemindAt != nil {
		todo.RemindAt = input.RemindAt
	}

	if input.RemindRepeat != nil {
		todo.RemindRepeat = strings.TrimSpace(*input.RemindRepeat)
	}

	if input.RemindAdvance != nil {
		todo.RemindAdvance = *input.RemindAdvance
	}

	if err := s.todoRepo.Update(todo); err != nil {
		return nil, err
	}

	return todo, nil
}

// normalizeTodoCategory valida a categoria da tarefa unificada.
func normalizeTodoCategory(raw string) string {
	c := strings.ToLower(strings.TrimSpace(raw))
	switch c {
	case "geral", "trabalho", "financas", "finanças", "estudos", "saude", "saúde", "pessoal":
		if c == "finanças" {
			return "financas"
		}
		if c == "saúde" {
			return "saude"
		}
		return c
	default:
		return "geral"
	}
}

// ReopenTodo desfaz a conclusão: tarefa concluída volta a pendente.
func (s *TodoService) ReopenTodo(id, userID string) error {
	return s.todoRepo.UpdateStatus(id, userID, domain.TodoStatusPending)
}

// ListTodos retorna tarefas filtradas pelo status do usuário autenticado.
func (s *TodoService) ListTodos(userID string, status domain.TodoStatus) ([]domain.Todo, error) {
	return s.todoRepo.ListByUser(userID, status)
}

// ListTodosPaged retorna a página filtrada + total (BACK-05, infinite scroll).
func (s *TodoService) ListTodosPaged(userID string, f domain.TodoFilter) ([]domain.Todo, int, error) {
	if f.Limit > 200 {
		f.Limit = 200
	}
	if f.Offset < 0 {
		f.Offset = 0
	}
	return s.todoRepo.ListPaged(userID, f)
}

// DeleteTodo remove uma tarefa do usuário.
func (s *TodoService) DeleteTodo(id, userID string) error {
	return s.todoRepo.Delete(id, userID)
}
