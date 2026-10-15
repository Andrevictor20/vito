package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/microcosm-cc/bluemonday"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// BookingSyncPusher propaga eventos de booking para agendas remotas (Google/Apple).
// Implementado por CalendarSyncService; interface local evita ciclo de import.
type BookingSyncPusher interface {
	PushEvent(ctx context.Context, userID string, event *domain.Event) error
	DeleteEvent(ctx context.Context, userID, eventID string) error
}

// ReserveRequest contém os dados da reserva submetida por um convidado.
type ReserveRequest struct {
	GuestName  string    `json:"guest_name"`
	GuestEmail string    `json:"guest_email"`
	GuestNotes string    `json:"guest_notes,omitempty"`
	StartAt    time.Time `json:"start_at"`
	EndAt      time.Time `json:"end_at"`
	Turnstile  string    `json:"turnstile_token,omitempty"`
}

// BookingTypeWithLink estende BookingType com o link público gerado.
type BookingTypeWithLink struct {
	domain.BookingType
	PublicURL string `json:"public_url"`
	ShortURL  string `json:"short_url"`
}

// BookingService gerencia regras de negócio, cálculo de janelas livres,
// lock atômico anti-conflito e disparo de notificações.
type BookingService struct {
	bookingRepo     domain.BookingRepository
	eventRepo       domain.EventRepository
	userRepo        domain.UserRepository
	notificationSvc *NotificationService
	shortener       LinkShortener
	turnstile       *TurnstileValidator
	publicBaseURL   string
	sanitizer       *bluemonday.Policy
	syncPusher      BookingSyncPusher
	lockMu          sync.Mutex
}

// SetSyncPusher registra o propagador para sync total bidirecional com Google/Apple.
func (s *BookingService) SetSyncPusher(pusher BookingSyncPusher) {
	s.syncPusher = pusher
}

// NewBookingService instancia o serviço de booking.
func NewBookingService(
	bookingRepo domain.BookingRepository,
	eventRepo domain.EventRepository,
	userRepo domain.UserRepository,
	notificationSvc *NotificationService,
	shortener LinkShortener,
	turnstile *TurnstileValidator,
	publicBaseURL string,
) *BookingService {
	return &BookingService{
		bookingRepo:     bookingRepo,
		eventRepo:       eventRepo,
		userRepo:        userRepo,
		notificationSvc: notificationSvc,
		shortener:       shortener,
		turnstile:       turnstile,
		publicBaseURL:   strings.TrimRight(publicBaseURL, "/"),
		sanitizer:       bluemonday.StrictPolicy(),
	}
}

// CreateBookingType cria um novo tipo de agendamento validando os campos.
func (s *BookingService) CreateBookingType(ctx context.Context, userID string, bt *domain.BookingType) (*BookingTypeWithLink, error) {
	if bt.Slug == "" {
		return nil, errors.New("slug é obrigatório")
	}
	if bt.Title == "" {
		return nil, errors.New("título é obrigatório")
	}
	if bt.DurationMinutes <= 0 {
		bt.DurationMinutes = 30
	}
	if bt.BufferMinutes < 0 {
		bt.BufferMinutes = 0
	}
	if bt.StartHour == "" {
		bt.StartHour = "09:00"
	}
	if bt.EndHour == "" {
		bt.EndHour = "18:00"
	}
	if bt.DaysOfWeek == "" {
		bt.DaysOfWeek = "[1,2,3,4,5,6,7]"
	}
	if bt.ID == "" {
		bt.ID = uuid.New().String()
	}
	bt.UserID = userID
	bt.IsActive = true
	now := time.Now().UTC()
	bt.CreatedAt = now
	bt.UpdatedAt = now

	if err := s.bookingRepo.CreateType(bt); err != nil {
		return nil, err
	}

	return s.enrichWithLinks(ctx, userID, bt)
}

// UpdateBookingType atualiza configurações do tipo de agendamento.
func (s *BookingService) UpdateBookingType(ctx context.Context, userID string, bt *domain.BookingType) (*BookingTypeWithLink, error) {
	bt.UserID = userID
	if err := s.bookingRepo.UpdateType(bt); err != nil {
		return nil, err
	}
	updated, err := s.bookingRepo.GetTypeByID(bt.ID, userID)
	if err != nil {
		return nil, err
	}
	return s.enrichWithLinks(ctx, userID, updated)
}

// DeleteBookingType remove o link E cascateia: apaga todos os agendamentos
// vinculados e seus eventos da agenda (o FK do banco removeria as linhas de
// agendamento sem tocar nos eventos, deixando órfãos — causa raiz do bug).
// Retorna o impacto para a mensagem de confirmação no app.
func (s *BookingService) DeleteBookingType(ctx context.Context, userID, id string) (*domain.DeleteBookingImpact, error) {
	if _, err := s.bookingRepo.GetTypeByID(id, userID); err != nil {
		return nil, err
	}
	appts, err := s.bookingRepo.ListAppointmentsByUser(userID, time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC), time.Date(2100, 1, 1, 0, 0, 0, 0, time.UTC))
	if err != nil {
		return nil, err
	}
	impact := &domain.DeleteBookingImpact{}
	for _, ap := range appts {
		if ap.BookingTypeID != id {
			continue
		}
		if err := s.removeAppointmentEvent(userID, &ap); err != nil {
			log.Printf("[BookingService] Falha ao remover evento do agendamento '%s' na exclusão do link '%s': %v", ap.ID, id, err)
		} else {
			impact.DeletedEvents++
		}
		if err := s.bookingRepo.DeleteAppointment(ap.ID, userID); err != nil {
			log.Printf("[BookingService] Falha ao remover agendamento '%s' na exclusão do link '%s': %v", ap.ID, id, err)
		} else {
			impact.DeletedAppointments++
		}
	}
	if err := s.bookingRepo.DeleteType(id, userID); err != nil {
		return nil, err
	}
	return impact, nil
}

// removeAppointmentEvent apaga o evento da agenda vinculado ao agendamento:
// propaga para Google/Apple, remove o mapeamento e apaga localmente.
// Quando EventID está vazio (linhas legadas), localiza por convidado+horário.
func (s *BookingService) removeAppointmentEvent(userID string, appt *domain.BookingAppointment) error {
	eventID := appt.EventID
	if eventID == "" {
		eventID = s.findAppointmentEventID(userID, appt)
		if eventID == "" {
			return errors.New("evento vinculado não localizado")
		}
	}
	if s.syncPusher != nil {
		pctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		err := s.syncPusher.DeleteEvent(pctx, userID, eventID)
		cancel()
		if err != nil {
			log.Printf("[BookingService] Falha ao propagar exclusão do evento '%s' para agenda remota: %v", eventID, err)
		}
	}
	return s.eventRepo.Delete(eventID, userID)
}

// findAppointmentEventID localiza o evento de um agendamento sem EventID
// (linhas legadas): mesmo convidado no título e sobreposição de horário.
func (s *BookingService) findAppointmentEventID(userID string, appt *domain.BookingAppointment) string {
	events, err := s.eventRepo.ListByUser(userID, appt.StartAt.Add(-time.Hour), appt.EndAt.Add(time.Hour))
	if err != nil {
		return ""
	}
	guest := strings.ToLower(strings.TrimSpace(appt.GuestName))
	for _, ev := range events {
		if !strings.Contains(strings.ToLower(ev.Title), guest) {
			continue
		}
		if ev.StartAt.Before(appt.EndAt) && ev.EndAt.After(appt.StartAt) {
			return ev.ID
		}
	}
	return ""
}

// ListBookingTypes lista os tipos de agendamento com seus links públicos.
// Antes de listar, varre e auto-apaga links vencidos (mantém o passado).
func (s *BookingService) ListBookingTypes(ctx context.Context, userID string) ([]BookingTypeWithLink, error) {
	types, err := s.bookingRepo.ListTypesByUser(userID)
	if err != nil {
		return nil, err
	}
	s.sweepExpiredBookingTypes(userID, types)
	types, err = s.bookingRepo.ListTypesByUser(userID)
	if err != nil {
		return nil, err
	}
	enriched := make([]BookingTypeWithLink, 0)
	for i := range types {
		en, err := s.enrichWithLinks(ctx, userID, &types[i])
		if err == nil && en != nil {
			enriched = append(enriched, *en)
		}
	}
	return enriched, nil
}

// GetBookingTypeBySlug busca o tipo por slug para a página pública.
func (s *BookingService) GetBookingTypeBySlug(ctx context.Context, userIdentifier, slug string) (*domain.BookingType, error) {
	return s.bookingRepo.GetTypeBySlug(userIdentifier, slug)
}

// bookingDayKey normaliza para comparação por dia (YYYY-MM-DD).
func bookingDayKey(t time.Time) string {
	return t.Format("2006-01-02")
}

// bookingDateAllowed verifica janela de validade e datas específicas do link.
func bookingDateAllowed(bt *domain.BookingType, date time.Time) bool {
	day := bookingDayKey(date)
	if bt.ValidFrom != nil && !bt.ValidFrom.IsZero() && day < bookingDayKey(*bt.ValidFrom) {
		return false
	}
	if bt.ValidUntil != nil && !bt.ValidUntil.IsZero() && day > bookingDayKey(*bt.ValidUntil) {
		return false
	}
	allowed := strings.TrimSpace(bt.AllowedDates)
	if allowed != "" && allowed != "[]" && allowed != "null" {
		var dates []string
		if err := json.Unmarshal([]byte(allowed), &dates); err != nil || len(dates) == 0 {
			if err != nil {
				return false
			}
		} else {
			for _, d := range dates {
				if strings.TrimSpace(d) == day {
					return true
				}
			}
			return false
		}
	}
	return true
}

// bookingExpired informa se a validade do link já terminou (ontem ou antes).
func bookingExpired(bt *domain.BookingType, now time.Time) bool {
	if bt.ValidUntil == nil || bt.ValidUntil.IsZero() {
		return false
	}
	return bookingDayKey(now) > bookingDayKey(*bt.ValidUntil)
}

// BookingLinkExpired expõe bookingExpired para o handler da página pública.
func BookingLinkExpired(bt *domain.BookingType) bool {
	return bookingExpired(bt, time.Now().UTC())
}

// BookingValidityBound formata um limite de validade (YYYY-MM-DD ou vazio).
func BookingValidityBound(t *time.Time) string {
	if t == nil || t.IsZero() {
		return ""
	}
	return bookingDayKey(t.UTC())
}

// sweepExpiredBookingTypes remove links vencidos: apaga agendamentos futuros e
// seus eventos da agenda, mantém o passado (compromissos ocorridos ficam).
// A exclusão do link cascateia as linhas restantes no banco.
func (s *BookingService) sweepExpiredBookingTypes(userID string, types []domain.BookingType) {
	now := time.Now().UTC()
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	for i := range types {
		bt := &types[i]
		if !bookingExpired(bt, now) {
			continue
		}
		appts, err := s.bookingRepo.ListAppointmentsByUser(userID, dayStart, time.Date(2100, 1, 1, 0, 0, 0, 0, time.UTC))
		if err != nil {
			log.Printf("[BookingService] Falha ao varrer expirados do link '%s': %v", bt.ID, err)
			continue
		}
		for _, ap := range appts {
			if ap.BookingTypeID != bt.ID {
				continue
			}
			if err := s.removeAppointmentEvent(userID, &ap); err != nil {
				log.Printf("[BookingService] Falha ao remover evento futuro expirado '%s': %v", ap.ID, err)
			}
			_ = s.bookingRepo.DeleteAppointment(ap.ID, userID)
		}
		if err := s.bookingRepo.DeleteType(bt.ID, userID); err != nil {
			log.Printf("[BookingService] Falha ao auto-apagar link expirado '%s': %v", bt.ID, err)
		} else {
			log.Printf("[BookingService] Link expirado auto-apagado '%s' (%s)", bt.ID, bt.Title)
		}
	}
}

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

func (s *BookingService) enrichWithLinks(ctx context.Context, userID string, bt *domain.BookingType) (*BookingTypeWithLink, error) {
	// Obtém username ou user.name
	user, err := s.userRepo.GetByID(userID)
	username := "vito"
	if err == nil && user != nil {
		if user.Name != "" {
			parts := strings.Fields(strings.ToLower(user.Name))
			if len(parts) > 0 {
				username = parts[0]
			}
		}
	}

	baseURL := strings.TrimRight(s.publicBaseURL, "/")
	if baseURL == "" {
		baseURL = "https://vito.rasppi.cloud"
	}
	publicURL := fmt.Sprintf("%s/book/%s/%s", baseURL, username, bt.Slug)
	shortURL := publicURL
	if s.shortener != nil {
		key := fmt.Sprintf("%s-%s", username, bt.Slug)
		if short, err := s.shortener.ShortenLink(ctx, publicURL, key); err == nil && short != "" {
			shortURL = short
		}
	}

	return &BookingTypeWithLink{
		BookingType: *bt,
		PublicURL:   publicURL,
		ShortURL:    shortURL,
	}, nil
}

func parseHour(hhmm string) (int, int, error) {
	parts := strings.Split(hhmm, ":")
	if len(parts) != 2 {
		return 0, 0, errors.New("formato inválido")
	}
	h, err := strconv.Atoi(parts[0])
	if err != nil {
		return 0, 0, err
	}
	m, err := strconv.Atoi(parts[1])
	if err != nil {
		return 0, 0, err
	}
	return h, m, nil
}
