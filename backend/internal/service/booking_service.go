package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/microcosm-cc/bluemonday"

	"github.com/andrevmp/vito/backend/internal/domain"
)

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
	lockMu          sync.Mutex
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
		bt.DaysOfWeek = "[1,2,3,4,5]"
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

// DeleteBookingType remove o tipo de agendamento.
func (s *BookingService) DeleteBookingType(ctx context.Context, userID, id string) error {
	return s.bookingRepo.DeleteType(id, userID)
}

// ListBookingTypes lista os tipos de agendamento com seus links públicos.
func (s *BookingService) ListBookingTypes(ctx context.Context, userID string) ([]BookingTypeWithLink, error) {
	types, err := s.bookingRepo.ListTypesByUser(userID)
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

// GetAvailableSlots calcula em tempo real os horários livres na data informada.
func (s *BookingService) GetAvailableSlots(ctx context.Context, userIdentifier, slug string, date time.Time) ([]domain.BookingSlot, error) {
	bt, err := s.bookingRepo.GetTypeBySlug(userIdentifier, slug)
	if err != nil {
		return nil, err
	}
	if !bt.IsActive {
		return nil, errors.New("este link de agendamento está desativado")
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

	// 6. Despacho de Push Notification Instantâneo no canal vito_default
	if s.notificationSvc != nil {
		timePT := req.StartAt.Format("15:04")
		datePT := req.StartAt.Format("02/01/2006")
		pushTitle := fmt.Sprintf("Novo agendamento: %s", guestName)
		pushBody := fmt.Sprintf("%s agendou '%s' para %s às %s", guestName, bt.Title, datePT, timePT)
		_, _ = s.notificationSvc.SendPushToUser(bt.UserID, pushTitle, pushBody, "high", map[string]interface{}{
			"type":           "booking_appointment",
			"appointment_id": appt.ID,
			"event_id":       eventID,
		})
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
	if appt.EventID != "" {
		_ = s.eventRepo.Delete(appt.EventID, userID)
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
