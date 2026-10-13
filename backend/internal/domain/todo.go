package domain

import (
	"errors"
	"time"
)

var (
	ErrTodoNotFound    = errors.New("tarefa não encontrada")
	ErrSubtaskNotFound = errors.New("subtarefa não encontrada")
)

type TodoStatus string

const (
	TodoStatusPending   TodoStatus = "pending"
	TodoStatusCompleted TodoStatus = "completed"
)

// Subtask representa um item de checklist filho de uma tarefa.
type Subtask struct {
	ID        string    `json:"id"`
	TodoID    string    `json:"todo_id"`
	Title     string    `json:"title"`
	Completed bool      `json:"completed"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Todo representa uma pendência/tarefa do usuário.
type Todo struct {
	ID                  string     `json:"id"`
	UserID              string     `json:"user_id"`
	Title               string     `json:"title"`
	Status              TodoStatus `json:"status"`
	Priority            string     `json:"priority"` // low, medium, high
	DueDate             *time.Time `json:"due_date,omitempty"`
	RemindAt            *time.Time `json:"remind_at,omitempty"`
	RemindRepeat        string     `json:"remind_repeat,omitempty"` // none, daily, weekly
	RemindAdvance       int        `json:"remind_advance_minutes,omitempty"`
	ReminderSentAt      *time.Time `json:"reminder_sent_at,omitempty"`
	StartReminderSentAt *time.Time `json:"start_reminder_sent_at,omitempty"`
	EventID             string     `json:"event_id,omitempty"`
	EventTitle          string     `json:"event_title,omitempty"`
	Subtasks            []Subtask  `json:"subtasks,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

// CreateTodoInput contém os parâmetros para criação flexível de tarefa.
type CreateTodoInput struct {
	Title         string     `json:"title"`
	Priority      string     `json:"priority,omitempty"`
	DueDate       *time.Time `json:"due_date,omitempty"`
	RemindAt      *time.Time `json:"remind_at,omitempty"`
	RemindRepeat  string     `json:"remind_repeat,omitempty"`
	RemindAdvance int        `json:"remind_advance_minutes,omitempty"`
	EventID       string     `json:"event_id,omitempty"`
	EventTitle    string     `json:"event_title,omitempty"`
}

// UpdateTodoInput parâmetros para edição de uma tarefa.
type UpdateTodoInput struct {
	Title         *string    `json:"title,omitempty"`
	Priority      *string    `json:"priority,omitempty"`
	DueDate       *time.Time `json:"due_date,omitempty"`
	RemindAt      *time.Time `json:"remind_at,omitempty"`
	RemindRepeat  *string    `json:"remind_repeat,omitempty"`
	RemindAdvance *int       `json:"remind_advance_minutes,omitempty"`
}

// TodoRepository define o contrato de persistência para pendências e subtarefas.
type TodoRepository interface {
	Create(todo *Todo) error
	GetByID(id, userID string) (*Todo, error)
	ListByUser(userID string, status TodoStatus) ([]Todo, error)
	ListUpcomingUnreminded(from, to time.Time) ([]Todo, error)
	ListDueNowUnreminded(from, to time.Time) ([]Todo, error)
	MarkReminderSent(todoID string, sentAt time.Time) error
	MarkDueReminderSent(todoID string, sentAt time.Time) error
	UpdateStatus(id, userID string, status TodoStatus) error
	Update(todo *Todo) error
	Delete(id, userID string) error
	AddSubtask(subtask *Subtask) error
	ToggleSubtask(id, todoID string) (*Subtask, error)
	DeleteSubtask(id, todoID string) error
	ListSubtasksByTodo(todoID string) ([]Subtask, error)
}

