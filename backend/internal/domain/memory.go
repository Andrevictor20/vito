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
	ID             string     `json:"id"`
	UserID         string     `json:"user_id"`
	Category       string     `json:"category"` // preference, family, routine, health, general
	Content        string     `json:"content"`
	Importance     int        `json:"importance"`     // 1..5 (§8.3)
	Confidence     float64    `json:"confidence"`     // 0..1
	AccessCount    int        `json:"access_count"`   // reforço por uso
	LastAccessedAt *time.Time `json:"last_accessed_at,omitempty"`
	SupersededBy   string     `json:"superseded_by,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// MemoryRepository define o contrato de persistência para as memórias de longo prazo.
type MemoryRepository interface {
	Create(memory *Memory) error
	GetByID(id, userID string) (*Memory, error)
	ListByUser(userID string, limit int) ([]Memory, error)
	Delete(id, userID string) error
	// SearchRelevant ranqueia por similaridade + importância + recência (§8.3).
	SearchRelevant(userID, query string, limit int) ([]Memory, error)
	// Reinforce aplica reforço por uso (access_count++, last_accessed_at).
	Reinforce(id, userID string) error
	// Supersede marca a memória como substituída por outra (preserva histórico).
	Supersede(id, userID, supersededBy string) error
}
