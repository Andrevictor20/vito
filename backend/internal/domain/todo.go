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
	ID         string     `json:"id"`
	UserID     string     `json:"user_id"`
	Title      string     `json:"title"`
	Status     TodoStatus `json:"status"`
	Priority   string     `json:"priority"` // low, medium, high
	DueDate    *time.Time `json:"due_date,omitempty"`
	EventID    string     `json:"event_id,omitempty"`
	EventTitle string     `json:"event_title,omitempty"`
	Subtasks   []Subtask  `json:"subtasks,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

// CreateTodoInput contém os parâmetros para criação flexível de tarefa.
type CreateTodoInput struct {
	Title      string     `json:"title"`
	Priority   string     `json:"priority,omitempty"`
	DueDate    *time.Time `json:"due_date,omitempty"`
	EventID    string     `json:"event_id,omitempty"`
	EventTitle string     `json:"event_title,omitempty"`
}

// TodoRepository define o contrato de persistência para pendências e subtarefas.
type TodoRepository interface {
	Create(todo *Todo) error
	GetByID(id, userID string) (*Todo, error)
	ListByUser(userID string, status TodoStatus) ([]Todo, error)
	UpdateStatus(id, userID string, status TodoStatus) error
	Delete(id, userID string) error
	AddSubtask(subtask *Subtask) error
	ToggleSubtask(id, todoID string) (*Subtask, error)
	DeleteSubtask(id, todoID string) error
	ListSubtasksByTodo(todoID string) ([]Subtask, error)
}
