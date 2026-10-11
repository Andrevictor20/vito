package domain

import (
	"errors"
	"time"
)

var (
	ErrPendingItemNotFound = errors.New("item de pendência não encontrado")
)

type PendingStatus string

const (
	PendingStatusInbox     PendingStatus = "inbox"
	PendingStatusScheduled PendingStatus = "scheduled"
	PendingStatusDone      PendingStatus = "done"
)

// PendingItem representa um item na Incubadora de Pendências do Vito.
type PendingItem struct {
	ID            string        `json:"id"`
	UserID        string        `json:"user_id"`
	Title         string        `json:"title"`
	Description   string        `json:"description,omitempty"`
	Category      string        `json:"category"`
	Status        PendingStatus `json:"status"`
	ScheduledDate string        `json:"scheduled_date,omitempty"` // YYYY-MM-DD
	NudgeSentAt   *time.Time    `json:"nudge_sent_at,omitempty"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
}

// CreatePendingInput parâmetros para criação de uma pendência.
type CreatePendingInput struct {
	Title         string `json:"title"`
	Description   string `json:"description,omitempty"`
	Category      string `json:"category,omitempty"`
	ScheduledDate string `json:"scheduled_date,omitempty"`
}

// UpdatePendingInput parâmetros para edição de uma pendência.
type UpdatePendingInput struct {
	Title         *string        `json:"title,omitempty"`
	Description   *string        `json:"description,omitempty"`
	Category      *string        `json:"category,omitempty"`
	Status        *PendingStatus `json:"status,omitempty"`
	ScheduledDate *string        `json:"scheduled_date,omitempty"`
}

// PendingRepository define o contrato de persistência seguro da Incubadora de Pendências.
type PendingRepository interface {
	Create(item *PendingItem) error
	GetByID(id, userID string) (*PendingItem, error)
	ListByUser(userID string, status *PendingStatus, category string) ([]PendingItem, error)
	Update(item *PendingItem) error
	Delete(id, userID string) error
	ListUnscheduledDueForNudge(cutoff time.Time) ([]PendingItem, error)
	MarkNudgeSent(id string, sentAt time.Time) error
}
