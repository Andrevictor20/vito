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
	emailSvc        *EmailService
	lockMu          sync.Mutex
}

// SetSyncPusher registra o propagador para sync total bidirecional com Google/Apple.
func (s *BookingService) SetSyncPusher(pusher BookingSyncPusher) {
	s.syncPusher = pusher
}

// SetEmailService injeta o serviço de e-mail SMTP para envio de confirmações e convites .ics.
func (s *BookingService) SetEmailService(emailSvc *EmailService) {
	s.emailSvc = emailSvc
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
