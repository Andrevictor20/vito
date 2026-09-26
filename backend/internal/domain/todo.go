package domain

import (
	"errors"
	"time"
)

var (
	ErrTodoNotFound = errors.New("tarefa não encontrada")
)

type TodoStatus string

const (
	TodoStatusPending   TodoStatus = "pending"
	TodoStatusCompleted TodoStatus = "completed"
)

// Todo representa uma pendência/tarefa do usuário.
type Todo struct {
	ID        string     `json:"id"`
	UserID    string     `json:"user_id"`
	Title     string     `json:"title"`
	Status    TodoStatus `json:"status"`
	Priority  string     `json:"priority"` // low, medium, high
	DueDate   *time.Time `json:"due_date,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

// TodoRepository define o contrato de persistência para pendências.
type TodoRepository interface {
	Create(todo *Todo) error
	GetByID(id, userID string) (*Todo, error)
	ListByUser(userID string, status TodoStatus) ([]Todo, error)
	UpdateStatus(id, userID string, status TodoStatus) error
	Delete(id, userID string) error
}
