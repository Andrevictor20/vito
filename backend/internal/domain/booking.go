package domain

import (
	"errors"
	"time"
)

var (
	ErrBookingTypeNotFound   = errors.New("tipo de agendamento não encontrado")
	ErrBookingTypeSlugExists = errors.New("slug de agendamento já em uso")
	ErrBookingConflict       = errors.New("horário indisponível ou já reservado")
	ErrInvalidBookingData    = errors.New("dados de agendamento inválidos")
	ErrTurnstileFailed       = errors.New("verificação anti-bot falhou")
	ErrBookingExpired        = errors.New("link de agendamento expirado")
)

// BookingType define as regras de agendamento público do usuário.
type BookingType struct {
	ID              string     `json:"id"`
	UserID          string     `json:"user_id"`
	Slug            string     `json:"slug"`
	Title           string     `json:"title"`
	Description     string     `json:"description,omitempty"`
	DurationMinutes int        `json:"duration_minutes"`
	BufferMinutes   int        `json:"buffer_minutes"`
	DaysOfWeek      string     `json:"days_of_week"`            // JSON array ex: "[1,2,3,4,5]" (1=Seg, 7=Dom)
	StartHour       string     `json:"start_hour"`              // "09:00"
	EndHour         string     `json:"end_hour"`                // "18:00"
	ValidFrom       *time.Time `json:"valid_from,omitempty"`    // início da validade (nulo = imediato)
	ValidUntil      *time.Time `json:"valid_until,omitempty"`   // fim da validade (nulo = sem expiração)
	AllowedDates    string     `json:"allowed_dates,omitempty"` // JSON ["2026-10-20",...]; vazio = usa days_of_week
	IsActive        bool       `json:"is_active"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// DeleteBookingImpact resume o efeito cascata da exclusão de um link.
type DeleteBookingImpact struct {
	DeletedAppointments int `json:"deleted_appointments"`
	DeletedEvents       int `json:"deleted_events"`
}

// BookingAppointment representa um horário agendado por um convidado externo.
type BookingAppointment struct {
	ID            string    `json:"id"`
	BookingTypeID string    `json:"booking_type_id"`
	UserID        string    `json:"user_id"`
	GuestName     string    `json:"guest_name"`
	GuestEmail    string    `json:"guest_email"`
	GuestNotes    string    `json:"guest_notes,omitempty"`
	StartAt       time.Time `json:"start_at"`
	EndAt         time.Time `json:"end_at"`
	Status        string    `json:"status"` // "confirmed", "cancelled"
	EventID       string    `json:"event_id,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

// BookingSlot representa uma janela disponível para agendamento público.
type BookingSlot struct {
	StartAt   time.Time `json:"start_at"`
	EndAt     time.Time `json:"end_at"`
	Available bool      `json:"available"`
	TimeLabel string    `json:"time_label"` // "10:00"
}

// BookingRepository define as operações de persistência para tipos e agendamentos.
type BookingRepository interface {
	CreateType(bt *BookingType) error
	UpdateType(bt *BookingType) error
	DeleteType(id, userID string) error
	GetTypeByID(id, userID string) (*BookingType, error)
	GetTypeBySlug(userIdentifier, slug string) (*BookingType, error)
	ListTypesByUser(userID string) ([]BookingType, error)
	CreateAppointment(appt *BookingAppointment) error
	GetAppointmentByID(id, userID string) (*BookingAppointment, error)
	ListAppointmentsByUser(userID string, from, to time.Time) ([]BookingAppointment, error)
	DeleteAppointment(id, userID string) error
	CheckSlotConflict(userID string, startAt, endAt time.Time, bufferMinutes int) (bool, error)
}
