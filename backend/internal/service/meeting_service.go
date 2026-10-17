package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/microcosm-cc/bluemonday"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// MeetingSlotInput representa uma opção de horário informada na criação da reunião.
type MeetingSlotInput struct {
	StartAt time.Time `json:"start_at"`
	EndAt   time.Time `json:"end_at"`
}

// CreateMeetingRequest define os parâmetros para criar uma nova coordenação de reunião.
type CreateMeetingRequest struct {
	UserID          string             `json:"user_id"`
	Title           string             `json:"title"`
	Description     string             `json:"description,omitempty"`
	DurationMinutes int                `json:"duration_minutes"`
	Mode            string             `json:"mode"` // "one_on_one" | "group_consensus"
	ExpiresAt       time.Time          `json:"expires_at,omitempty"`
	Slots           []MeetingSlotInput `json:"slots"`
}

// UpdateMeetingRequest define os parâmetros para editar uma reunião existente.
type UpdateMeetingRequest struct {
	Title           string             `json:"title"`
	Description     string             `json:"description"`
	DurationMinutes int                `json:"duration_minutes"`
	Slots           []MeetingSlotInput `json:"slots"`
}

// SubmitVoteRequest define o voto submetido por um participante na página pública.
type SubmitVoteRequest struct {
	MeetingID       string   `json:"meeting_id"`
	ParticipantID   string   `json:"participant_id,omitempty"`
	ParticipantName string   `json:"participant_name"`
	ContactInfo     string   `json:"contact_info,omitempty"`
	SlotIDs         []string `json:"slot_ids"`
}

// SubmitVoteResponse resume o resultado do voto.
type SubmitVoteResponse struct {
	MeetingID          string     `json:"meeting_id"`
	ParticipantID      string     `json:"participant_id"`
	MeetingStatus      string     `json:"meeting_status"`
	IsVoteUpdate       bool       `json:"is_vote_update,omitempty"`
	ConfirmedSlotID    *string    `json:"confirmed_slot_id,omitempty"`
	ConfirmedSlotStart *time.Time `json:"confirmed_slot_start,omitempty"`
	ConfirmedSlotEnd   *time.Time `json:"confirmed_slot_end,omitempty"`
}

// WhatsAppShare contém o texto e os links formatados para envio via WhatsApp.
type WhatsAppShare struct {
	MessageText      string `json:"message_text"`
	WhatsAppDeepLink string `json:"whatsapp_deep_link"`
	WhatsAppWebURL   string `json:"whatsapp_web_url"`
}

// MeetingService gerencia a lógica de reuniões, votação, links curtos e confirmação na agenda.
type MeetingService struct {
	meetingRepo     domain.MeetingRepository
	eventRepo       domain.EventRepository
	notificationSvc *NotificationService
	shortener       LinkShortener
	publicBaseURL   string
	sanitizer       *bluemonday.Policy
	syncPusher      BookingSyncPusher
	emailSvc        *EmailService
	lockMu          sync.Mutex
}

// NewMeetingService instancia o serviço de reuniões com sanitização anti-XSS.
func NewMeetingService(
	meetingRepo domain.MeetingRepository,
	eventRepo domain.EventRepository,
	notificationSvc *NotificationService,
	shortener LinkShortener,
	publicBaseURL string,
) *MeetingService {
	cleanBaseURL := strings.TrimRight(publicBaseURL, "/")
	if cleanBaseURL == "" {
		cleanBaseURL = "http://localhost:8180"
	}

	return &MeetingService{
		meetingRepo:     meetingRepo,
		eventRepo:       eventRepo,
		notificationSvc: notificationSvc,
		shortener:       shortener,
		publicBaseURL:   cleanBaseURL,
		sanitizer:       bluemonday.UGCPolicy(),
	}
}

// SetEmailService define o serviço de e-mail para envio de convites de calendário .ics.
func (s *MeetingService) SetEmailService(emailSvc *EmailService) {
	s.emailSvc = emailSvc
}

// SetSyncPusher registra o propagador para sync total com Google/Apple.
func (s *MeetingService) SetSyncPusher(pusher BookingSyncPusher) {
	s.syncPusher = pusher
}

func brtLocation() *time.Location {
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		return time.FixedZone("BRT", -3*3600)
	}
	return loc
}

// SubmitVote processa o voto de um convidado na página pública.
func (s *MeetingService) SubmitVote(ctx context.Context, req SubmitVoteRequest) (*SubmitVoteResponse, error) {
	name := strings.TrimSpace(s.sanitizer.Sanitize(req.ParticipantName))
	contact := strings.TrimSpace(s.sanitizer.Sanitize(req.ContactInfo))

	if name == "" {
		return nil, errors.New("nome do participante é obrigatório")
	}
	if len(req.SlotIDs) == 0 {
		return nil, errors.New("ao menos um horário deve ser selecionado")
	}

	// 1. Lock para garantir atomicidade no fechamento 1-on-1 e contagem
	s.lockMu.Lock()
	defer s.lockMu.Unlock()

	m, err := s.meetingRepo.GetByID(ctx, req.MeetingID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	if now.After(m.ExpiresAt) {
		return nil, domain.ErrMeetingExpired
	}

	if m.Status == domain.MeetingStatusConfirmed {
		return nil, domain.ErrMeetingAlreadyConfirmed
	}

	// 2. Busca participante existente para evitar duplicações e permitir alteração limpa do voto
	existingPart, err := s.meetingRepo.FindParticipant(ctx, m.ID, req.ParticipantID, contact, name)
	if err != nil {
		return nil, fmt.Errorf("falha ao verificar participante: %w", err)
	}

	var partID string
	var isVoteUpdate bool

	if existingPart != nil {
		partID = existingPart.ID
		isVoteUpdate = true
		if err := s.meetingRepo.ReplaceParticipantVotes(ctx, m.ID, partID, name, contact, req.SlotIDs); err != nil {
			return nil, fmt.Errorf("falha ao atualizar votos: %w", err)
		}
	} else {
		partID = uuid.New().String()
		participant := &domain.MeetingParticipant{
			ID:          partID,
			MeetingID:   m.ID,
			Name:        name,
			ContactInfo: contact,
			RespondedAt: now,
			CreatedAt:   now,
		}
		if err := s.meetingRepo.AddParticipant(ctx, participant); err != nil {
			return nil, fmt.Errorf("falha ao registrar participante: %w", err)
		}

		// 3. Registra os votos
		for _, slotID := range req.SlotIDs {
			vote := &domain.MeetingVote{
				ID:            uuid.New().String(),
				MeetingID:     m.ID,
				SlotID:        slotID,
				ParticipantID: partID,
				CreatedAt:     now,
			}
			if err := s.meetingRepo.RecordVote(ctx, vote); err != nil && !errors.Is(err, domain.ErrParticipantAlreadyVoted) {
				return nil, fmt.Errorf("falha ao registrar voto no slot %s: %w", slotID, err)
			}
		}
	}

	resp := &SubmitVoteResponse{
		MeetingID:     m.ID,
		ParticipantID: partID,
		MeetingStatus: m.Status,
		IsVoteUpdate:  isVoteUpdate,
	}

	loc := brtLocation()

	// 4. Se for 1-on-1, primeiro voto confirma imediatamente
	if m.Mode == domain.MeetingModeOneOnOne {
		chosenSlotID := req.SlotIDs[0]
		slot, err := s.meetingRepo.GetSlotByID(ctx, chosenSlotID)
		if err != nil {
			return nil, err
		}

		if err := s.meetingRepo.ConfirmMeetingSlot(ctx, m.ID, slot.ID, slot.StartAt, slot.EndAt); err != nil {
			return nil, fmt.Errorf("falha ao confirmar reunião: %w", err)
		}

		// Cria evento na agenda do anfitrião
		eventID := uuid.New().String()
		eventTitle := fmt.Sprintf("%s com %s", m.Title, name)
		eventDesc := fmt.Sprintf("Reunião agendada via link mágico por %s", name)
		if contact != "" {
			eventDesc = fmt.Sprintf("%s (%s)", eventDesc, contact)
		}
		if m.Description != "" {
			eventDesc = fmt.Sprintf("%s\n\nDetalhes: %s", eventDesc, m.Description)
		}

		event := &domain.Event{
			ID:          eventID,
			UserID:      m.UserID,
			Title:       eventTitle,
			Description: eventDesc,
			StartAt:     slot.StartAt.UTC(),
			EndAt:       slot.EndAt.UTC(),
			Source:      "vito_meeting",
			Category:    "meeting",
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		if err := s.eventRepo.Create(event); err != nil {
			log.Printf("[MeetingService] Falha ao criar evento de reunião na agenda: %v", err)
		}

		// Sync remoto Google/Apple
		if s.syncPusher != nil {
			evCopy := *event
			go func(evt *domain.Event) {
				pctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				defer cancel()
				if err := s.syncPusher.PushEvent(pctx, m.UserID, evt); err != nil {
					log.Printf("[MeetingService] Falha ao propagar reunião '%s' para sync remoto: %v", evt.Title, err)
				}
			}(&evCopy)
		}

		// Push notification em horário de Brasília (BRT)
		if s.notificationSvc != nil {
			localStart := slot.StartAt.In(loc)
			timeStr := localStart.Format("15:04")
			dateStr := localStart.Format("02/01")
			pushTitle := fmt.Sprintf("📅 Reunião confirmada: %s", name)
			pushBody := fmt.Sprintf("%s confirmou '%s' para %s às %s", name, m.Title, dateStr, timeStr)
			sent, err := s.notificationSvc.SendPushToUser(m.UserID, pushTitle, pushBody, "high", map[string]interface{}{
				"type":       "meeting_confirmed",
				"channelId":  "vito_booking",
				"meeting_id": m.ID,
				"event_id":   eventID,
			})
			if err != nil {
				log.Printf("[MeetingService] Falha ao enviar push de confirmação 1-on-1 para user=%s: %v", m.UserID, err)
			} else {
				log.Printf("[MeetingService] Push de confirmação 1-on-1 enviado para user=%s (dispositivos=%d)", m.UserID, sent)
			}
		}

		// Notificação por e-mail com .ics para o participante 1-on-1 se informou e-mail
		if s.emailSvc != nil && s.emailSvc.IsConfigured() && strings.Contains(contact, "@") {
			publicURL := m.ShortURL
			if publicURL == "" {
				publicURL = fmt.Sprintf("%s/meet/%s", s.publicBaseURL, m.ID)
			}
			go func(title, desc, pubURL, toEmail, toName string, stAt, endAt time.Time) {
				pctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				defer cancel()
				_ = s.emailSvc.SendMeetingConfirmation(pctx, toEmail, toName, title, desc, stAt, endAt, pubURL)
			}(m.Title, eventDesc, publicURL, contact, name, slot.StartAt, slot.EndAt)
		}

		resp.MeetingStatus = domain.MeetingStatusConfirmed
		resp.ConfirmedSlotID = &slot.ID
		resp.ConfirmedSlotStart = &slot.StartAt
		resp.ConfirmedSlotEnd = &slot.EndAt
	} else {
		// Modo grupo: notifica anfitrião sobre novo voto com alta prioridade e canal vito_booking
		if s.notificationSvc != nil {
			var votedTimes []string
			for _, sid := range req.SlotIDs {
				if sl, err := s.meetingRepo.GetSlotByID(ctx, sid); err == nil && sl != nil {
					localSt := sl.StartAt.In(loc)
					votedTimes = append(votedTimes, fmt.Sprintf("%s às %s", localSt.Format("02/01"), localSt.Format("15:04")))
				}
			}
			timeSummary := fmt.Sprintf("%d horário(s)", len(req.SlotIDs))
			if len(votedTimes) > 0 {
				timeSummary = strings.Join(votedTimes, ", ")
			}
			pushTitle := fmt.Sprintf("🗳️ Novo voto em '%s'", m.Title)
			pushBody := fmt.Sprintf("%s votou em: %s", name, timeSummary)
			if isVoteUpdate {
				pushTitle = fmt.Sprintf("✏️ Voto alterado em '%s'", m.Title)
				pushBody = fmt.Sprintf("%s alterou sua escolha para: %s", name, timeSummary)
			}
			sent, err := s.notificationSvc.SendPushToUser(m.UserID, pushTitle, pushBody, "high", map[string]interface{}{
				"type":       "meeting_vote",
				"channelId":  "vito_booking",
				"meeting_id": m.ID,
			})
			if err != nil {
				log.Printf("[MeetingService] Falha ao enviar push de voto para user=%s (meeting=%s): %v", m.UserID, m.ID, err)
			} else {
				log.Printf("[MeetingService] Push de voto enviado para user=%s (meeting=%s, dispositivos=%d)", m.UserID, m.ID, sent)
			}
		}
	}

	return resp, nil
}

// ConfirmConsensusSlot fecha a reunião de grupo no slot escolhido pelo anfitrião.
func (s *MeetingService) ConfirmConsensusSlot(ctx context.Context, userID, meetingID, slotID string) error {
	s.lockMu.Lock()
	defer s.lockMu.Unlock()

	m, err := s.meetingRepo.GetByIDAndUser(ctx, meetingID, userID)
	if err != nil {
		return err
	}

	slot, err := s.meetingRepo.GetSlotByID(ctx, slotID)
	if err != nil {
		return err
	}
	if slot.MeetingID != m.ID {
		return domain.ErrMeetingSlotNotFound
	}

	now := time.Now().UTC()
	if err := s.meetingRepo.ConfirmMeetingSlot(ctx, m.ID, slot.ID, slot.StartAt, slot.EndAt); err != nil {
		return err
	}

	parts, _ := s.meetingRepo.ListParticipants(ctx, m.ID)
	var names []string
	for _, p := range parts {
		names = append(names, p.Name)
	}

	eventTitle := m.Title
	if len(names) > 0 {
		eventTitle = fmt.Sprintf("%s (%s)", m.Title, strings.Join(names, ", "))
	}

	eventDesc := fmt.Sprintf("Reunião em grupo confirmada via Vito.\nParticipantes: %s", strings.Join(names, ", "))
	if m.Description != "" {
		eventDesc = fmt.Sprintf("%s\n\nDetalhes: %s", eventDesc, m.Description)
	}

	event := &domain.Event{
		ID:          uuid.New().String(),
		UserID:      m.UserID,
		Title:       eventTitle,
		Description: eventDesc,
		StartAt:     slot.StartAt.UTC(),
		EndAt:       slot.EndAt.UTC(),
		Source:      "vito_meeting",
		Category:    "meeting",
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.eventRepo.Create(event); err != nil {
		log.Printf("[MeetingService] Falha ao criar evento de reunião de grupo na agenda: %v", err)
	}

	if s.syncPusher != nil {
		evCopy := *event
		go func(evt *domain.Event) {
			pctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			_ = s.syncPusher.PushEvent(pctx, m.UserID, evt)
		}(&evCopy)
	}

	if s.emailSvc != nil && s.emailSvc.IsConfigured() {
		publicURL := m.ShortURL
		if publicURL == "" {
			publicURL = fmt.Sprintf("%s/meet/%s", s.publicBaseURL, m.ID)
		}
		go func(title, desc, pubURL string, stAt, endAt time.Time, participants []domain.MeetingParticipant) {
			pctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
			defer cancel()
			for _, p := range participants {
				if strings.Contains(p.ContactInfo, "@") {
					_ = s.emailSvc.SendMeetingConfirmation(pctx, p.ContactInfo, p.Name, title, desc, stAt, endAt, pubURL)
				}
			}
		}(m.Title, eventDesc, publicURL, slot.StartAt, slot.EndAt, parts)
	}

	return nil
}

// GenerateWhatsAppShare cria a mensagem executiva formatada e os links deep/web para o WhatsApp.
func (s *MeetingService) GenerateWhatsAppShare(ctx context.Context, userID, meetingID string) (*WhatsAppShare, error) {
	m, err := s.meetingRepo.GetByIDAndUser(ctx, meetingID, userID)
	if err != nil {
		return nil, err
	}

	link := m.ShortURL
	if link == "" {
		link = fmt.Sprintf("%s/meet/%s", s.publicBaseURL, m.ID)
	}

	var msg string
	if m.Mode == domain.MeetingModeOneOnOne {
		msg = fmt.Sprintf("Oi! Separei alguns horários livres pra nossa conversa sobre '%s'. É só tocar no link e escolher o que fica melhor pra você:\n%s", m.Title, link)
	} else {
		msg = fmt.Sprintf("Oi pessoal! Separei algumas opções de horários pra nossa reunião sobre '%s'. Toquem no link e votem nos que funcionam pra vocês pra acharmos o melhor consenso:\n%s", m.Title, link)
	}

	encodedMsg := url.QueryEscape(msg)
	return &WhatsAppShare{
		MessageText:      msg,
		WhatsAppDeepLink: fmt.Sprintf("whatsapp://send?text=%s", encodedMsg),
		WhatsAppWebURL:   fmt.Sprintf("https://wa.me/?text=%s", encodedMsg),
	}, nil
}
