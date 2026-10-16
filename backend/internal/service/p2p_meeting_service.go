package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// P2PMeetingService gerencia o matching seguro de contatos e o ciclo de reuniões bilaterais.
type P2PMeetingService struct {
	p2pRepo      domain.P2PInviteRepository
	userRepo     domain.UserRepository
	calService   *CalendarService
	notifService *NotificationService

	mu                 sync.RWMutex
	currentSalt        string
	saltExpires        time.Time
	phoneVerifications map[string]*domain.PhoneVerificationChallenge
}

// NewP2PMeetingService cria uma nova instância de P2PMeetingService.
func NewP2PMeetingService(
	p2pRepo domain.P2PInviteRepository,
	userRepo domain.UserRepository,
	calService *CalendarService,
	notifService *NotificationService,
) *P2PMeetingService {
	return &P2PMeetingService{
		p2pRepo:            p2pRepo,
		userRepo:           userRepo,
		calService:         calService,
		notifService:       notifService,
		phoneVerifications: make(map[string]*domain.PhoneVerificationChallenge),
	}
}

// GetContactMatchingSalt gera ou retorna um salt criptográfico efêmero com expiração rotativa de 15 minutos.
func (s *P2PMeetingService) GetContactMatchingSalt() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now().UTC()
	if s.currentSalt != "" && now.Before(s.saltExpires) {
		return s.currentSalt, nil
	}

	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("falha ao gerar salt criptográfico: %w", err)
	}

	s.currentSalt = hex.EncodeToString(b)
	s.saltExpires = now.Add(15 * time.Minute)
	return s.currentSalt, nil
}

// MatchContactsByHashes compara hashes HMAC-SHA256 recebidos com a base de usuários em tempo constante.
func (s *P2PMeetingService) MatchContactsByHashes(ctx context.Context, salt string, clientHashes []string) ([]domain.ContactMatchResult, error) {
	if len(clientHashes) == 0 {
		return []domain.ContactMatchResult{}, nil
	}

	users, err := s.userRepo.ListAll()
	if err != nil {
		return nil, fmt.Errorf("falha ao listar usuários para matching: %w", err)
	}

	var results []domain.ContactMatchResult

	calcHMAC := func(val string) []byte {
		h := hmac.New(sha256.New, []byte(salt))
		h.Write([]byte(val))
		return h.Sum(nil)
	}

	// Pré-decodifica os hashes do cliente
	type decodedHash struct {
		rawHex string
		bytes  []byte
	}
	clientDecoded := make([]decodedHash, 0, len(clientHashes))
	for _, hHex := range clientHashes {
		b, err := hex.DecodeString(hHex)
		if err == nil && len(b) == 32 {
			clientDecoded = append(clientDecoded, decodedHash{rawHex: hHex, bytes: b})
		}
	}

	for _, u := range users {
		matched := false

		// Compara telefone (normalizado E.164 e bruto)
		if u.Phone != nil && *u.Phone != "" {
			candidates := []string{*u.Phone}
			if norm := NormalizeE164Phone(*u.Phone); norm != "" && norm != *u.Phone {
				candidates = append(candidates, norm)
			}
			for _, phoneCandidate := range candidates {
				phoneHash := calcHMAC(phoneCandidate)
				for _, ch := range clientDecoded {
					if subtle.ConstantTimeCompare(phoneHash, ch.bytes) == 1 {
						matched = true
						break
					}
				}
				if matched {
					break
				}
			}
		}

		// Compara email
		if !matched && u.Email != "" {
			emailHash := calcHMAC(u.Email)
			for _, ch := range clientDecoded {
				if subtle.ConstantTimeCompare(emailHash, ch.bytes) == 1 {
					matched = true
					break
				}
			}
		}

		if matched {
			phoneVal := ""
			if u.Phone != nil {
				phoneVal = *u.Phone
			}
			results = append(results, domain.ContactMatchResult{
				UserID: u.ID,
				Name:   u.Name,
				Phone:  phoneVal,
				Email:  u.Email,
			})
		}
	}

	return results, nil
}

// FindMutualSlots calcula os intervalos livres em comum entre dois usuários em uma janela de tempo.
func (s *P2PMeetingService) FindMutualSlots(ctx context.Context, userAID, userBID string, from, to time.Time, durationMinutes int) ([]domain.P2PMutualSlot, error) {
	if durationMinutes <= 0 {
		durationMinutes = 30
	}
	dur := time.Duration(durationMinutes) * time.Minute

	// Busca eventos de ambos os usuários no intervalo
	eventsA, err := s.calService.eventRepo.ListByUser(userAID, from, to)
	if err != nil {
		return nil, fmt.Errorf("falha ao consultar agenda do usuário A: %w", err)
	}

	eventsB, err := s.calService.eventRepo.ListByUser(userBID, from, to)
	if err != nil {
		return nil, fmt.Errorf("falha ao consultar agenda do usuário B: %w", err)
	}

	hasConflict := func(events []domain.Event, start, end time.Time) bool {
		for _, e := range events {
			if start.Before(e.EndAt) && end.After(e.StartAt) {
				return true
			}
		}
		return false
	}

	var mutualSlots []domain.P2PMutualSlot
	cursor := from

	// Passo de 30 minutos ou da duração caso menor
	step := 30 * time.Minute
	if dur < step {
		step = dur
	}

	for cursor.Add(dur).Before(to) || cursor.Add(dur).Equal(to) {
		slotStart := cursor
		slotEnd := cursor.Add(dur)

		if !hasConflict(eventsA, slotStart, slotEnd) && !hasConflict(eventsB, slotStart, slotEnd) {
			mutualSlots = append(mutualSlots, domain.P2PMutualSlot{
				StartAt: slotStart,
				EndAt:   slotEnd,
			})
		}

		cursor = cursor.Add(step)
	}

	return mutualSlots, nil
}

// SendInvite cria um convite de reunião bilateral pendente e envia notificação push para o convidado.
func (s *P2PMeetingService) SendInvite(ctx context.Context, fromUserID, toUserID, title, description string, startAt, endAt time.Time) (*domain.P2PMeetingInvite, error) {
	if fromUserID == toUserID {
		return nil, domain.ErrP2PSelfInvite
	}

	if title == "" {
		return nil, errors.New("o título da reunião é obrigatório")
	}

	if endAt.IsZero() || endAt.Before(startAt) || endAt.Equal(startAt) {
		endAt = startAt.Add(30 * time.Minute)
	}

	durationMinutes := int(endAt.Sub(startAt).Minutes())

	// Verifica conflito de agenda de ambos
	confA, err := s.calService.eventRepo.CheckConflict(fromUserID, startAt, endAt, "")
	if err != nil {
		return nil, err
	}
	if confA != nil && confA.HasConflict {
		return nil, domain.ErrP2PSlotConflict
	}

	confB, err := s.calService.eventRepo.CheckConflict(toUserID, startAt, endAt, "")
	if err != nil {
		return nil, err
	}
	if confB != nil && confB.HasConflict {
		return nil, domain.ErrP2PSlotConflict
	}

	now := time.Now().UTC()
	invite := &domain.P2PMeetingInvite{
		ID:              uuid.New().String(),
		FromUserID:      fromUserID,
		ToUserID:        toUserID,
		Title:           title,
		Description:     description,
		StartAt:         startAt,
		EndAt:           endAt,
		DurationMinutes: durationMinutes,
		Status:          domain.P2PInviteStatusPending,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	if err := s.p2pRepo.Create(ctx, invite); err != nil {
		return nil, fmt.Errorf("falha ao persistir convite P2P: %w", err)
	}

	// Dispara push notification para o convidado
	if s.notifService != nil {
		fromUser, _ := s.userRepo.GetByID(fromUserID)
		fromName := "Alguém"
		if fromUser != nil && fromUser.Name != "" {
			fromName = fromUser.Name
		}

		go func() {
			_, errPush := s.notifService.SendPushToUser(
				toUserID,
				"Convite de Reunião: "+title,
				fmt.Sprintf("%s convidou você para uma reunião.", fromName),
				"high",
				map[string]interface{}{
					"type":         "p2p_meeting_invite",
					"invite_id":    invite.ID,
					"from_user_id": fromUserID,
				},
			)
			if errPush != nil {
				log.Printf("[P2PMeetingService] Falha ao enviar push de convite para %s: %v", toUserID, errPush)
			}
		}()
	}

	return invite, nil
}

// AcceptInviteWithResult aceita o convite, cria os eventos atômicos para anfitrião e convidado e retorna o convite atualizado.
func (s *P2PMeetingService) AcceptInviteWithResult(ctx context.Context, inviteID, respondingUserID string) (*domain.P2PMeetingInvite, error) {
	invite, err := s.p2pRepo.GetByID(ctx, inviteID)
	if err != nil {
		return nil, err
	}
	if invite == nil {
		return nil, domain.ErrP2PInviteNotFound
	}

	if invite.ToUserID != respondingUserID {
		return nil, domain.ErrP2PInviteUnauthorized
	}

	if invite.Status != domain.P2PInviteStatusPending {
		return nil, domain.ErrP2PInviteNotPending
	}

	fromUser, _ := s.userRepo.GetByID(invite.FromUserID)
	toUser, _ := s.userRepo.GetByID(invite.ToUserID)

	fromName := invite.FromUserID
	if fromUser != nil && fromUser.Name != "" {
		fromName = fromUser.Name
	}
	toName := invite.ToUserID
	if toUser != nil && toUser.Name != "" {
		toName = toUser.Name
	}

	// Cria evento na agenda do anfitrião (fromUser)
	descHost := invite.Description
	if descHost != "" {
		descHost += "\n\n"
	}
	descHost += "Reunião bilateral Vito P2P com " + toName

	evtFrom, _, err := s.calService.CreateEvent(invite.FromUserID, invite.Title, descHost, "Vito In-App", invite.StartAt, invite.EndAt)
	if err != nil {
		return nil, fmt.Errorf("falha ao criar evento para anfitrião: %w", err)
	}

	// Cria evento na agenda do convidado (toUser)
	descGuest := invite.Description
	if descGuest != "" {
		descGuest += "\n\n"
	}
	descGuest += "Reunião bilateral Vito P2P com " + fromName

	evtTo, _, err := s.calService.CreateEvent(invite.ToUserID, invite.Title, descGuest, "Vito In-App", invite.StartAt, invite.EndAt)
	if err != nil {
		return nil, fmt.Errorf("falha ao criar evento para convidado: %w", err)
	}

	if err := s.p2pRepo.UpdateStatus(ctx, inviteID, domain.P2PInviteStatusAccepted, &evtFrom.ID, &evtTo.ID); err != nil {
		return nil, fmt.Errorf("falha ao atualizar status do convite: %w", err)
	}

	invite.Status = domain.P2PInviteStatusAccepted
	invite.EventIDFrom = &evtFrom.ID
	invite.EventIDTo = &evtTo.ID
	invite.UpdatedAt = time.Now().UTC()

	// Notifica anfitrião via push
	if s.notifService != nil {
		go func() {
			_, errPush := s.notifService.SendPushToUser(
				invite.FromUserID,
				"Reunião Confirmada: "+invite.Title,
				fmt.Sprintf("%s aceitou o convite de reunião.", toName),
				"high",
				map[string]interface{}{
					"type":      "p2p_meeting_accepted",
					"invite_id": invite.ID,
					"event_id":  evtFrom.ID,
				},
			)
			if errPush != nil {
				log.Printf("[P2PMeetingService] Falha ao enviar push de aceitação para %s: %v", invite.FromUserID, errPush)
			}
		}()
	}

	return invite, nil
}

// AcceptInvite aceita o convite e atualiza as agendas.
func (s *P2PMeetingService) AcceptInvite(ctx context.Context, inviteID, respondingUserID string) error {
	_, err := s.AcceptInviteWithResult(ctx, inviteID, respondingUserID)
	return err
}

// DeclineInvite recusa o convite pendente.
func (s *P2PMeetingService) DeclineInvite(ctx context.Context, inviteID, respondingUserID string) error {
	invite, err := s.p2pRepo.GetByID(ctx, inviteID)
	if err != nil {
		return err
	}
	if invite == nil {
		return domain.ErrP2PInviteNotFound
	}

	if invite.ToUserID != respondingUserID {
		return domain.ErrP2PInviteUnauthorized
	}

	if invite.Status != domain.P2PInviteStatusPending {
		return domain.ErrP2PInviteNotPending
	}

	if err := s.p2pRepo.UpdateStatus(ctx, inviteID, domain.P2PInviteStatusDeclined, nil, nil); err != nil {
		return fmt.Errorf("falha ao atualizar status para declined: %w", err)
	}

	// Notifica anfitrião
	if s.notifService != nil {
		toUser, _ := s.userRepo.GetByID(invite.ToUserID)
		toName := "O convidado"
		if toUser != nil && toUser.Name != "" {
			toName = toUser.Name
		}

		go func() {
			_, _ = s.notifService.SendPushToUser(
				invite.FromUserID,
				"Convite Recusado: "+invite.Title,
				fmt.Sprintf("%s não pôde aceitar o convite para a reunião.", toName),
				"normal",
				map[string]interface{}{
					"type":      "p2p_meeting_declined",
					"invite_id": invite.ID,
				},
			)
		}()
	}

	return nil
}

// CancelInvite cancela um convite pendente por parte do criador.
func (s *P2PMeetingService) CancelInvite(ctx context.Context, inviteID, requestingUserID string) error {
	invite, err := s.p2pRepo.GetByID(ctx, inviteID)
	if err != nil {
		return err
	}
	if invite == nil {
		return domain.ErrP2PInviteNotFound
	}

	if invite.FromUserID != requestingUserID {
		return domain.ErrP2PInviteUnauthorized
	}

	if invite.Status != domain.P2PInviteStatusPending {
		return domain.ErrP2PInviteNotPending
	}

	return s.p2pRepo.UpdateStatus(ctx, inviteID, domain.P2PInviteStatusCancelled, nil, nil)
}

// ListPendingInvites lista os convites pendentes recebidos pelo usuário.
func (s *P2PMeetingService) ListPendingInvites(ctx context.Context, userID string) ([]domain.P2PMeetingInvite, error) {
	return s.p2pRepo.ListPendingForUser(ctx, userID)
}

// ListUserInvites lista o histórico de convites enviados e recebidos pelo usuário.
func (s *P2PMeetingService) ListUserInvites(ctx context.Context, userID string) ([]domain.P2PMeetingInvite, error) {
	return s.p2pRepo.ListUserInvites(ctx, userID)
}
