package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrP2PInviteNotFound     = errors.New("convite de reunião P2P não encontrado")
	ErrP2PInviteNotPending    = errors.New("convite de reunião P2P não está pendente")
	ErrP2PInviteUnauthorized  = errors.New("não autorizado a responder a este convite")
	ErrP2PSlotConflict        = errors.New("um dos participantes possui conflito no horário selecionado")
	ErrP2PSelfInvite          = errors.New("não é possível convidar a si mesmo")
)

const (
	P2PInviteStatusPending   = "pending"
	P2PInviteStatusAccepted  = "accepted"
	P2PInviteStatusDeclined  = "declined"
	P2PInviteStatusCancelled = "cancelled"
)

// P2PMeetingInvite representa um convite de reunião bilateral entre dois usuários do Vito.
type P2PMeetingInvite struct {
	ID              string     `json:"id"`
	FromUserID      string     `json:"from_user_id"`
	ToUserID        string     `json:"to_user_id"`
	Title           string     `json:"title"`
	Description     string     `json:"description,omitempty"`
	StartAt         time.Time  `json:"start_at"`
	EndAt           time.Time  `json:"end_at"`
	DurationMinutes int        `json:"duration_minutes"`
	Status          string     `json:"status"` // pending, accepted, declined, cancelled
	EventIDFrom     *string    `json:"event_id_from,omitempty"`
	EventIDTo       *string    `json:"event_id_to,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`

	// Enriquecimento
	FromUserName string `json:"from_user_name,omitempty"`
	ToUserName   string `json:"to_user_name,omitempty"`
}

// ContactMatchResult representa um contato mapeado que possui conta ativa no Vito.
type ContactMatchResult struct {
	UserID string `json:"user_id"`
	Name   string `json:"name"`
	Phone  string `json:"phone,omitempty"`
	Email  string `json:"email,omitempty"`
}

// P2PMutualSlot representa uma janela de tempo livre em comum entre dois usuários.
type P2PMutualSlot struct {
	StartAt time.Time `json:"start_at"`
	EndAt   time.Time `json:"end_at"`
}

// P2PInviteRepository define as operações de persistência para convites P2P.
type P2PInviteRepository interface {
	Create(ctx context.Context, invite *P2PMeetingInvite) error
	GetByID(ctx context.Context, id string) (*P2PMeetingInvite, error)
	ListPendingForUser(ctx context.Context, userID string) ([]P2PMeetingInvite, error)
	ListUserInvites(ctx context.Context, userID string) ([]P2PMeetingInvite, error)
	UpdateStatus(ctx context.Context, id string, status string, eventIDFrom, eventIDTo *string) error
}
