package domain

import (
	"errors"
	"time"
)

var (
	ErrMemoryNotFound = errors.New("memória não encontrada")
)

// Memory armazena preferências, fatos familiares e contexto contínuo do usuário.
type Memory struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Category  string    `json:"category"` // preference, family, routine, health, general
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// MemoryRepository define o contrato de persistência para as memórias de longo prazo.
type MemoryRepository interface {
	Create(memory *Memory) error
	GetByID(id, userID string) (*Memory, error)
	ListByUser(userID string, limit int) ([]Memory, error)
	Delete(id, userID string) error
}
