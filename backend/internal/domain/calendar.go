package domain

import (
	"errors"
	"time"
)

var (
	ErrEventNotFound  = errors.New("evento não encontrado")
	ErrInvalidEvent   = errors.New("dados de evento inválidos")
	ErrScheduleConflict = errors.New("conflito de horário detectado")
)

// Event representa um compromisso ou bloco de tempo na agenda.
type Event struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Title       string    `json:"title"`
	Description string    `json:"description,omitempty"`
	Location    string    `json:"location,omitempty"`
	StartAt     time.Time `json:"start_at"`
	EndAt       time.Time `json:"end_at"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ConflictInfo detalha um evento que colide em horário.
type ConflictInfo struct {
	HasConflict   bool   `json:"has_conflict"`
	ConflictingID string `json:"conflicting_id,omitempty"`
	ConflictingTitle string `json:"conflicting_title,omitempty"`
	Message       string `json:"message,omitempty"`
}

// EventRepository define o contrato de persistência para eventos.
type EventRepository interface {
	Create(event *Event) error
	GetByID(id, userID string) (*Event, error)
	ListByUser(userID string, from, to time.Time) ([]Event, error)
	CheckConflict(userID string, startAt, endAt time.Time, excludeEventID string) (*ConflictInfo, error)
	Delete(id, userID string) error
}
