package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// CreateMeeting valida e cria a reunião e seus slots propostos.
func (s *MeetingService) CreateMeeting(ctx context.Context, req CreateMeetingRequest) (*domain.MeetingWithDetails, error) {
	title := strings.TrimSpace(s.sanitizer.Sanitize(req.Title))
	desc := strings.TrimSpace(s.sanitizer.Sanitize(req.Description))

	if title == "" {
		return nil, errors.New("o título da reunião é obrigatório")
	}
	if req.UserID == "" {
		return nil, errors.New("usuário anfitrião é obrigatório")
	}

	duration := req.DurationMinutes
	if duration <= 0 {
		duration = 60
	}

	mode := req.Mode
	if mode != domain.MeetingModeGroupConsensus {
		mode = domain.MeetingModeOneOnOne
	}

	expiresAt := req.ExpiresAt
	now := time.Now().UTC()
	if expiresAt.IsZero() || !expiresAt.After(now) {
		expiresAt = now.Add(48 * time.Hour)
	}

	meetingID := uuid.New().String()
	canonicalURL := fmt.Sprintf("%s/meet/%s", s.publicBaseURL, meetingID)
	shortURL := canonicalURL

	if s.shortener != nil {
		slug := fmt.Sprintf("m-%s", meetingID[:8])
		if shortened, err := s.shortener.ShortenLink(ctx, canonicalURL, slug); err == nil && shortened != "" {
			shortURL = shortened
		}
	}

	meeting := &domain.Meeting{
		ID:              meetingID,
		UserID:          req.UserID,
		Title:           title,
		Description:     desc,
		DurationMinutes: duration,
		Mode:            mode,
		Status:          domain.MeetingStatusOpen,
		ShortURL:        shortURL,
		ExpiresAt:       expiresAt,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	var slots []domain.MeetingSlot
	for _, sl := range req.Slots {
		if sl.StartAt.IsZero() || sl.EndAt.IsZero() || !sl.EndAt.After(sl.StartAt) {
			continue
		}
		slots = append(slots, domain.MeetingSlot{
			ID:         uuid.New().String(),
			MeetingID:  meetingID,
			StartAt:    sl.StartAt.UTC(),
			EndAt:      sl.EndAt.UTC(),
			VotesCount: 0,
			CreatedAt:  now,
		})
	}

	if err := s.meetingRepo.Create(ctx, meeting, slots); err != nil {
		return nil, fmt.Errorf("falha ao persistir reunião: %w", err)
	}

	return &domain.MeetingWithDetails{
		Meeting:      *meeting,
		Slots:        slots,
		Participants: []domain.MeetingParticipant{},
		PublicURL:    canonicalURL,
	}, nil
}

// GetMeetingDetails retorna a reunião com seus slots, votos cruzados e participantes.
func (s *MeetingService) GetMeetingDetails(ctx context.Context, meetingID string) (*domain.MeetingWithDetails, error) {
	m, err := s.meetingRepo.GetByID(ctx, meetingID)
	if err != nil {
		return nil, err
	}

	return s.enrichMeetingDetails(ctx, m)
}

func (s *MeetingService) enrichMeetingDetails(ctx context.Context, m *domain.Meeting) (*domain.MeetingWithDetails, error) {
	slots, err := s.meetingRepo.ListSlots(ctx, m.ID)
	if err != nil {
		return nil, err
	}

	parts, err := s.meetingRepo.ListParticipants(ctx, m.ID)
	if err != nil {
		return nil, err
	}

	votes, err := s.meetingRepo.ListVotesByMeeting(ctx, m.ID)
	if err != nil {
		return nil, err
	}

	partNameByID := make(map[string]string, len(parts))
	for _, p := range parts {
		partNameByID[p.ID] = p.Name
	}

	votersBySlot := make(map[string][]string)
	slotsByPart := make(map[string][]string)
	for _, v := range votes {
		if name, ok := partNameByID[v.ParticipantID]; ok {
			votersBySlot[v.SlotID] = append(votersBySlot[v.SlotID], name)
		}
		slotsByPart[v.ParticipantID] = append(slotsByPart[v.ParticipantID], v.SlotID)
	}

	maxVotes := 0
	for i := range slots {
		names := votersBySlot[slots[i].ID]
		if names == nil {
			names = []string{}
		}
		slots[i].VoterNames = names
		if len(names) > slots[i].VotesCount {
			slots[i].VotesCount = len(names)
		}
		if slots[i].VotesCount > maxVotes {
			maxVotes = slots[i].VotesCount
		}
	}

	if maxVotes > 0 {
		for i := range slots {
			if slots[i].VotesCount == maxVotes {
				slots[i].IsWinner = true
			}
		}
	}

	for i := range parts {
		voted := slotsByPart[parts[i].ID]
		if voted == nil {
			voted = []string{}
		}
		parts[i].VotedSlotIDs = voted
	}

	if slots == nil {
		slots = []domain.MeetingSlot{}
	}
	if parts == nil {
		parts = []domain.MeetingParticipant{}
	}

	canonicalURL := fmt.Sprintf("%s/meet/%s", s.publicBaseURL, m.ID)
	return &domain.MeetingWithDetails{
		Meeting:      *m,
		Slots:        slots,
		Participants: parts,
		PublicURL:    canonicalURL,
	}, nil
}

// ListUserMeetings lista as reuniões do usuário enriquecidas com slots, votos e participantes.
func (s *MeetingService) ListUserMeetings(ctx context.Context, userID, status string) ([]domain.MeetingWithDetails, error) {
	rawList, err := s.meetingRepo.ListByUser(ctx, userID, status)
	if err != nil {
		return nil, err
	}
	result := make([]domain.MeetingWithDetails, 0, len(rawList))
	for i := range rawList {
		details, err := s.enrichMeetingDetails(ctx, &rawList[i])
		if err != nil {
			continue
		}
		result = append(result, *details)
	}
	return result, nil
}

// UpdateMeeting edita título, descrição, duração e horários de uma reunião preservando votos em slots mantidos.
func (s *MeetingService) UpdateMeeting(ctx context.Context, userID, meetingID string, req UpdateMeetingRequest) (*domain.MeetingWithDetails, error) {
	s.lockMu.Lock()
	defer s.lockMu.Unlock()

	m, err := s.meetingRepo.GetByIDAndUser(ctx, meetingID, userID)
	if err != nil {
		return nil, err
	}

	title := strings.TrimSpace(s.sanitizer.Sanitize(req.Title))
	if title != "" {
		m.Title = title
	}
	m.Description = strings.TrimSpace(s.sanitizer.Sanitize(req.Description))
	if req.DurationMinutes > 0 {
		m.DurationMinutes = req.DurationMinutes
	}

	now := time.Now().UTC()
	var newSlots []domain.MeetingSlot
	for _, sl := range req.Slots {
		if sl.StartAt.IsZero() || sl.EndAt.IsZero() || !sl.EndAt.After(sl.StartAt) {
			continue
		}
		newSlots = append(newSlots, domain.MeetingSlot{
			ID:         uuid.New().String(),
			MeetingID:  m.ID,
			StartAt:    sl.StartAt.UTC(),
			EndAt:      sl.EndAt.UTC(),
			VotesCount: 0,
			CreatedAt:  now,
		})
	}

	if len(newSlots) > 0 {
		if err := s.meetingRepo.UpdateWithSlots(ctx, m, newSlots); err != nil {
			return nil, fmt.Errorf("falha ao atualizar reunião e horários: %w", err)
		}
	} else {
		if err := s.meetingRepo.Update(ctx, m); err != nil {
			return nil, fmt.Errorf("falha ao atualizar reunião: %w", err)
		}
	}

	return s.GetMeetingDetails(ctx, m.ID)
}

// DeleteMeeting remove uma reunião pertencente ao usuário.
func (s *MeetingService) DeleteMeeting(ctx context.Context, userID, meetingID string) error {
	return s.meetingRepo.Delete(ctx, meetingID, userID)
}
