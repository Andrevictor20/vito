package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// GetAvailableSlots calcula em tempo real os horários livres na data informada.
func (s *BookingService) GetAvailableSlots(ctx context.Context, userIdentifier, slug string, date time.Time) ([]domain.BookingSlot, error) {
	bt, err := s.bookingRepo.GetTypeBySlug(userIdentifier, slug)
	if err != nil {
		return nil, err
	}
	if !bt.IsActive {
		return nil, errors.New("este link de agendamento está desativado")
	}
	if bookingExpired(bt, time.Now().UTC()) {
		return nil, domain.ErrBookingExpired
	}
	if !bookingDateAllowed(bt, date) {
		return []domain.BookingSlot{}, nil
	}

	// Normaliza dia da semana (Segunda = 1 ... Domingo = 7)
	weekday := int(date.Weekday())
	if weekday == 0 {
		weekday = 7
	}

	var allowedDays []int
	if err := json.Unmarshal([]byte(bt.DaysOfWeek), &allowedDays); err != nil {
		allowedDays = []int{1, 2, 3, 4, 5}
	}
	isDayAllowed := false
	for _, d := range allowedDays {
		if d == weekday {
			isDayAllowed = true
			break
		}
	}
	if !isDayAllowed {
		return []domain.BookingSlot{}, nil
	}

	// Faz parse do start_hour e end_hour
	startH, startM, err := parseHour(bt.StartHour)
	if err != nil {
		startH, startM = 9, 0
	}
	endH, endM, err := parseHour(bt.EndHour)
	if err != nil {
		endH, endM = 18, 0
	}

	loc := date.Location()
	slotStart := time.Date(date.Year(), date.Month(), date.Day(), startH, startM, 0, 0, loc)
	dayEnd := time.Date(date.Year(), date.Month(), date.Day(), endH, endM, 0, 0, loc)

	now := time.Now().UTC()
	var slots []domain.BookingSlot

	for {
		slotEnd := slotStart.Add(time.Duration(bt.DurationMinutes) * time.Minute)
		if slotEnd.After(dayEnd) {
			break
		}

		timeLabel := fmt.Sprintf("%02d:%02d", slotStart.In(loc).Hour(), slotStart.In(loc).Minute())
		slot := domain.BookingSlot{
			StartAt:   slotStart.UTC(),
			EndAt:     slotEnd.UTC(),
			TimeLabel: timeLabel,
			Available: false,
		}

		// Se o slot já passou, permanece indisponível
		if slotStart.UTC().After(now) {
			hasConflict, err := s.bookingRepo.CheckSlotConflict(bt.UserID, slotStart, slotEnd, bt.BufferMinutes)
			if err == nil && !hasConflict {
				slot.Available = true
			}
		}

		slots = append(slots, slot)
		slotStart = slotEnd
	}

	return slots, nil
}

// ReserveAppointment processa a reserva com validação Turnstile, sanitização XSS,
// lock atômico serializável contra double-booking e push prioritário.
func (s *BookingService) ReserveAppointment(ctx context.Context, userIdentifier, slug string, req ReserveRequest, remoteIP string) (*domain.BookingAppointment, error) {
	bt, err := s.bookingRepo.GetTypeBySlug(userIdentifier, slug)
	if err != nil {
		return nil, err
	}
	if !bt.IsActive {
		return nil, errors.New("agendamento desativado")
	}

	// 1. Validação Anti-Bot Turnstile
	if s.turnstile != nil {
		ok, err := s.turnstile.Validate(ctx, req.Turnstile, remoteIP)
		if err != nil || !ok {
			return nil, domain.ErrTurnstileFailed
		}
	}

	// 2. Sanitização Estrita contra Stored XSS
	guestName := strings.TrimSpace(s.sanitizer.Sanitize(req.GuestName))
	guestEmail := strings.TrimSpace(s.sanitizer.Sanitize(req.GuestEmail))
	guestNotes := strings.TrimSpace(s.sanitizer.Sanitize(req.GuestNotes))

	if guestName == "" {
		return nil, errors.New("nome do convidado é obrigatório")
	}
	if guestEmail == "" {
		return nil, errors.New("email do convidado é obrigatório")
	}

	if req.StartAt.IsZero() || req.EndAt.IsZero() || !req.EndAt.After(req.StartAt) {
		return nil, domain.ErrInvalidBookingData
	}

	// Fora da validade (período ou datas específicas) não reserva.
	if bookingExpired(bt, time.Now().UTC()) || !bookingDateAllowed(bt, req.StartAt) {
		return nil, domain.ErrBookingExpired
	}

	// 3. Lock Atômico Serializável contra Double-Booking Concorrente
	s.lockMu.Lock()
	defer s.lockMu.Unlock()

	// Re-verifica colisão sob a seção crítica
	hasConflict, err := s.bookingRepo.CheckSlotConflict(bt.UserID, req.StartAt, req.EndAt, bt.BufferMinutes)
	if err != nil {
		return nil, err
	}
	if hasConflict {
		return nil, domain.ErrBookingConflict
	}

	// 4. Criação atômica do Evento na agenda do usuário no SQLite
	eventID := uuid.New().String()
	eventTitle := fmt.Sprintf("Reunião com %s (%s)", guestName, bt.Title)
	eventDesc := fmt.Sprintf("Agendado via Vito Booking por %s <%s>", guestName, guestEmail)
	if guestNotes != "" {
		eventDesc = fmt.Sprintf("%s\nNotas: %s", eventDesc, guestNotes)
	}

	event := &domain.Event{
		ID:          eventID,
		UserID:      bt.UserID,
		Title:       eventTitle,
		Description: eventDesc,
		StartAt:     req.StartAt.UTC(),
		EndAt:       req.EndAt.UTC(),
		Source:      "vito_booking",
		Category:    "meeting",
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}
	if err := s.eventRepo.Create(event); err != nil {
		return nil, fmt.Errorf("falha ao sincronizar com agenda do anfitrião: %w", err)
	}

	// 4b. Sync total bidirecional: propaga imediatamente para Google/Apple (fire-and-forget).
	if s.syncPusher != nil {
		evCopy := *event
		go func(evt *domain.Event) {
			pctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			if err := s.syncPusher.PushEvent(pctx, bt.UserID, evt); err != nil {
				log.Printf("[BookingService] Falha ao propagar reserva '%s' para agenda remota: %v", evt.Title, err)
			}
		}(&evCopy)
	}

	// 5. Criação do Agendamento
	appt := &domain.BookingAppointment{
		ID:            uuid.New().String(),
		BookingTypeID: bt.ID,
		UserID:        bt.UserID,
		GuestName:     guestName,
		GuestEmail:    guestEmail,
		GuestNotes:    guestNotes,
		StartAt:       req.StartAt.UTC(),
		EndAt:         req.EndAt.UTC(),
		Status:        "confirmed",
		EventID:       eventID,
		CreatedAt:     time.Now().UTC(),
	}
	if err := s.bookingRepo.CreateAppointment(appt); err != nil {
		return nil, fmt.Errorf("falha ao registrar agendamento: %w", err)
	}

	// 6. Despacho de Push Notification Instantâneo no canal vito_booking:
	// quem agendou + comentário + dia/horário.
	if s.notificationSvc != nil {
		timePT := req.StartAt.Format("15:04")
		datePT := req.StartAt.Format("02/01/2006")
		pushTitle := fmt.Sprintf("Novo agendamento: %s", guestName)
		pushBody := fmt.Sprintf("%s agendou '%s' para %s às %s", guestName, bt.Title, datePT, timePT)
		if guestNotes != "" {
			pushBody = fmt.Sprintf("%s\nComentário: %s", pushBody, guestNotes)
		}
		if sent, err := s.notificationSvc.SendPushToUser(bt.UserID, pushTitle, pushBody, "high", map[string]interface{}{
			"type":           "booking_appointment",
			"appointment_id": appt.ID,
			"event_id":       eventID,
			"guest_name":     guestName,
			"guest_notes":    guestNotes,
		}); err != nil {
			log.Printf("[BookingService] Falha ao notificar reserva '%s' do usuário %s: %v", appt.ID, bt.UserID, err)
		} else if sent == 0 {
			log.Printf("[BookingService] Reserva '%s' sem dispositivos para notificar (user=%s)", appt.ID, bt.UserID)
		}
	}

	// 6b. Se o convidado também possuir uma conta Vito associada ao guestEmail, espelha o evento na agenda dele e envia push
	if s.userRepo != nil && strings.Contains(guestEmail, "@") {
		if guestUser, gErr := s.userRepo.GetByEmail(guestEmail); gErr == nil && guestUser != nil && guestUser.ID != "" && guestUser.ID != bt.UserID {
			guestEventID := uuid.New().String()
			guestEvent := &domain.Event{
				ID:          guestEventID,
				UserID:      guestUser.ID,
				Title:       bt.Title,
				Description: eventDesc,
				StartAt:     req.StartAt.UTC(),
				EndAt:       req.EndAt.UTC(),
				Source:      "vito_booking",
				Category:    "meeting",
				CreatedAt:   time.Now().UTC(),
				UpdatedAt:   time.Now().UTC(),
			}
			if cErr := s.eventRepo.Create(guestEvent); cErr == nil {
				if s.syncPusher != nil {
					evCopy := *guestEvent
					go func(targetUserID string, evt *domain.Event) {
						pctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
						defer cancel()
						_ = s.syncPusher.PushEvent(pctx, targetUserID, evt)
					}(guestUser.ID, &evCopy)
				}
				if s.notificationSvc != nil {
					loc := brtLocation()
					localSt := req.StartAt.In(loc)
					_, _ = s.notificationSvc.SendPushToUser(
						guestUser.ID,
						fmt.Sprintf("📅 Agendamento confirmado: %s", bt.Title),
						fmt.Sprintf("Reservado para %s às %s", localSt.Format("02/01"), localSt.Format("15:04")),
						"high",
						map[string]interface{}{
							"type":           "booking_appointment",
							"channelId":      "vito_booking",
							"appointment_id": appt.ID,
							"event_id":       guestEventID,
						},
					)
				}
			}
		}
	}

	// 7. Notificação por e-mail com anexo .ics para o convidado
	if s.emailSvc != nil && s.emailSvc.IsConfigured() && strings.Contains(guestEmail, "@") {
		go func(title, desc, toEmail, toName string, stAt, endAt time.Time) {
			pctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			_ = s.emailSvc.SendMeetingConfirmation(pctx, toEmail, toName, title, desc, stAt, endAt, "")
		}(bt.Title, eventDesc, guestEmail, guestName, req.StartAt, req.EndAt)
	}

	return appt, nil
}

// ListAppointments retorna o histórico de agendamentos recebidos pelo usuário.
func (s *BookingService) ListAppointments(ctx context.Context, userID string, from, to time.Time) ([]domain.BookingAppointment, error) {
	if from.IsZero() {
		from = time.Now().Add(-30 * 24 * time.Hour)
	}
	if to.IsZero() {
		to = time.Now().Add(90 * 24 * time.Hour)
	}
	appts, err := s.bookingRepo.ListAppointmentsByUser(userID, from, to)
	if err != nil {
		return nil, err
	}
	if appts == nil {
		appts = []domain.BookingAppointment{}
	}
	return appts, nil
}

// CancelAppointment cancela um agendamento e remove o evento associado da agenda pessoal do anfitrião.
func (s *BookingService) CancelAppointment(ctx context.Context, userID, id string) error {
	appt, err := s.bookingRepo.GetAppointmentByID(id, userID)
	if err != nil {
		return err
	}
	if err := s.removeAppointmentEvent(userID, appt); err != nil {
		log.Printf("[BookingService] Aviso ao remover evento do agendamento '%s': %v", id, err)
	}
	return s.bookingRepo.DeleteAppointment(id, userID)
}
