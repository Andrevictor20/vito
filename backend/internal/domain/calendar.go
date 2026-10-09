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
	Source      string    `json:"source,omitempty"`
	Category    string    `json:"category,omitempty"`
	Color       string    `json:"color,omitempty"`
	Recurrence  string     `json:"recurrence,omitempty"`
	ReminderSentAt *time.Time `json:"reminder_sent_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// TimeSlot representa uma janela de tempo disponível na agenda.
type TimeSlot struct {
	StartAt time.Time `json:"start_at"`
	EndAt   time.Time `json:"end_at"`
	Label   string    `json:"label"`
}

// ConflictInfo detalha um evento que colide em horário.
type ConflictInfo struct {
	HasConflict      bool       `json:"has_conflict"`
	ConflictingID    string     `json:"conflicting_id,omitempty"`
	ConflictingTitle string     `json:"conflicting_title,omitempty"`
	Message          string     `json:"message,omitempty"`
	SuggestedSlots   []TimeSlot `json:"suggested_slots,omitempty"`
}

// EventRepository define o contrato de persistência para eventos.
type EventRepository interface {
	Create(event *Event) error
	GetByID(id, userID string) (*Event, error)
	ListByUser(userID string, from, to time.Time) ([]Event, error)
	ListUpcomingUnreminded(from, to time.Time) ([]Event, error)
	MarkReminderSent(eventID string, sentAt time.Time) error
	CheckConflict(userID string, startAt, endAt time.Time, excludeEventID string) (*ConflictInfo, error)
	Delete(id, userID string) error
	DeleteByTitle(userID, titleQuery string) (int, error)
	DeleteSeries(id, userID string) (int, error)
	Update(event *Event) error
	UpdateSeries(event *Event) (int, error)
	UpdateTimesByTitle(userID, titleQuery string, newStart, newEnd time.Time) (int, error)
}
