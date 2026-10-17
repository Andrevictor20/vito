package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrMeetingNotFound         = errors.New("reunião não encontrada")
	ErrMeetingExpired          = errors.New("link de reunião expirado")
	ErrMeetingAlreadyConfirmed = errors.New("reunião já confirmada")
	ErrMeetingSlotNotFound     = errors.New("horário de reunião não encontrado")
	ErrInvalidMeetingData      = errors.New("dados de reunião inválidos")
	ErrParticipantAlreadyVoted = errors.New("participante já votou neste horário")
)

const (
	MeetingModeOneOnOne        = "one_on_one"
	MeetingModeGroupConsensus  = "group_consensus"

	MeetingStatusOpen      = "open"
	MeetingStatusConfirmed = "confirmed"
	MeetingStatusExpired   = "expired"
	MeetingStatusCancelled = "cancelled"
)

// Meeting representa uma coordenação de reunião externa ou em grupo.
type Meeting struct {
	ID                 string     `json:"id"`
	UserID             string     `json:"user_id"`
	Title              string     `json:"title"`
	Description        string     `json:"description,omitempty"`
	DurationMinutes    int        `json:"duration_minutes"`
	Mode               string     `json:"mode"`   // "one_on_one" ou "group_consensus"
	Status             string     `json:"status"` // "open", "confirmed", "expired", "cancelled"
	ShortURL           string     `json:"short_url,omitempty"`
	ExpiresAt          time.Time  `json:"expires_at"`
	ConfirmedSlotID    *string    `json:"confirmed_slot_id,omitempty"`
	ConfirmedSlotStart *time.Time `json:"confirmed_slot_start,omitempty"`
	ConfirmedSlotEnd   *time.Time `json:"confirmed_slot_end,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

// MeetingSlot representa um dos horários propostos para a reunião.
type MeetingSlot struct {
	ID         string    `json:"id"`
	MeetingID  string    `json:"meeting_id"`
	StartAt    time.Time `json:"start_at"`
	EndAt      time.Time `json:"end_at"`
	VotesCount int       `json:"votes_count"`
	VoterNames []string  `json:"voter_names,omitempty"`
	IsWinner   bool      `json:"is_winner,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

// MeetingParticipant representa um participante convidado que respondeu/votou.
type MeetingParticipant struct {
	ID           string    `json:"id"`
	MeetingID    string    `json:"meeting_id"`
	Name         string    `json:"name"`
	ContactInfo  string    `json:"contact_info,omitempty"`
	VitoUserID   *string   `json:"vito_user_id,omitempty"`
	VotedSlotIDs []string  `json:"voted_slot_ids,omitempty"`
	RespondedAt  time.Time `json:"responded_at"`
	CreatedAt    time.Time `json:"created_at"`
}

// MeetingVote registra o voto de um participante em um slot específico.
type MeetingVote struct {
	ID            string    `json:"id"`
	MeetingID     string    `json:"meeting_id"`
	SlotID        string    `json:"slot_id"`
	ParticipantID string    `json:"participant_id"`
	CreatedAt     time.Time `json:"created_at"`
}

// MeetingWithDetails agrega a reunião com seus slots e participantes para visualização.
type MeetingWithDetails struct {
	Meeting
	Slots        []MeetingSlot        `json:"slots"`
	Participants []MeetingParticipant `json:"participants"`
	PublicURL    string               `json:"public_url,omitempty"`
}

// MeetingRepository define o contrato de persistência do módulo de reuniões.
type MeetingRepository interface {
	Create(ctx context.Context, m *Meeting, slots []MeetingSlot) error
	GetByID(ctx context.Context, id string) (*Meeting, error)
	GetByIDAndUser(ctx context.Context, id, userID string) (*Meeting, error)
	ListByUser(ctx context.Context, userID string, status string) ([]Meeting, error)
	Update(ctx context.Context, m *Meeting) error
	UpdateWithSlots(ctx context.Context, m *Meeting, newSlots []MeetingSlot) error
	Delete(ctx context.Context, id, userID string) error
	ListSlots(ctx context.Context, meetingID string) ([]MeetingSlot, error)
	GetSlotByID(ctx context.Context, slotID string) (*MeetingSlot, error)
	AddParticipant(ctx context.Context, p *MeetingParticipant) error
	ListParticipants(ctx context.Context, meetingID string) ([]MeetingParticipant, error)
	FindParticipant(ctx context.Context, meetingID, participantID, contactInfo, name string) (*MeetingParticipant, error)
	RecordVote(ctx context.Context, vote *MeetingVote) error
	ReplaceParticipantVotes(ctx context.Context, meetingID, participantID, name, contactInfo string, newSlotIDs []string) error
	ListVotesByMeeting(ctx context.Context, meetingID string) ([]MeetingVote, error)
	ConfirmMeetingSlot(ctx context.Context, meetingID, slotID string, startAt, endAt time.Time) error
}

