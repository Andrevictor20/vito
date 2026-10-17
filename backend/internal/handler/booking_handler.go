package handler

import (
	"encoding/json"
	"errors"
	"html/template"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

// BookingHandler manipula as requisições web públicas e REST autenticadas do Vito Booking.
type BookingHandler struct {
	bookingSvc *service.BookingService
	pageTmpl   *template.Template
}

// NewBookingHandler instancia o manipulador de booking e compila o template HTML M3 ultraleve.
func NewBookingHandler(bookingSvc *service.BookingService) *BookingHandler {
	tmpl := template.Must(template.New("booking_page").Parse(bookingPageHTMLTemplate))
	return &BookingHandler{
		bookingSvc: bookingSvc,
		pageTmpl:   tmpl,
	}
}

// ServePublicPage renderiza a página web pública Material Design 3 (< 25 KB).
func (h *BookingHandler) ServePublicPage(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")
	slug := chi.URLParam(r, "slug")

	bt, err := h.bookingSvc.GetBookingTypeBySlug(r.Context(), username, slug)
	if err != nil {
		http.Error(w, "Página de agendamento não encontrada ou link inativo", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://challenges.cloudflare.com;")

	data := struct {
		Title           string
		Description     string
		DurationMinutes int
		Username        string
		Slug            string
		Expired         bool
		ValidFrom       string
		ValidUntil      string
		AllowedDates    string
	}{
		Title:           bt.Title,
		Description:     bt.Description,
		DurationMinutes: bt.DurationMinutes,
		Username:        username,
		Slug:            slug,
		Expired:         !bt.IsActive || service.BookingLinkExpired(bt),
		ValidFrom:       service.BookingValidityBound(bt.ValidFrom),
		ValidUntil:      service.BookingValidityBound(bt.ValidUntil),
		AllowedDates:    bt.AllowedDates,
	}

	_ = h.pageTmpl.Execute(w, data)
}

// GetPublicSlots retorna os horários disponíveis em formato JSON para a data requisitada.
func (h *BookingHandler) GetPublicSlots(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")
	slug := chi.URLParam(r, "slug")
	dateStr := r.URL.Query().Get("date")

	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		loc = time.FixedZone("BRT", -3*3600)
	}

	date := time.Now().In(loc)
	if dateStr != "" {
		if parsed, err := time.ParseInLocation("2006-01-02", dateStr, loc); err == nil {
			date = parsed
		}
	}

	slots, err := h.bookingSvc.GetAvailableSlots(r.Context(), username, slug, date)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(slots)
}

// ReservePublicSlot processa o agendamento público pelo convidado.
func (h *BookingHandler) ReservePublicSlot(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")
	slug := chi.URLParam(r, "slug")

	var req service.ReserveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Payload JSON inválido", http.StatusBadRequest)
		return
	}

	remoteIP := r.RemoteAddr
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		parts := strings.Split(forwarded, ",")
		remoteIP = strings.TrimSpace(parts[0])
	}

	appt, err := h.bookingSvc.ReserveAppointment(r.Context(), username, slug, req, remoteIP)
	if err != nil {
		if errors.Is(err, domain.ErrBookingConflict) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusConflict)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "O horário selecionado acabou de ser reservado ou conflita com outro compromisso.",
			})
			return
		}
		if errors.Is(err, domain.ErrTurnstileFailed) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "Falha na validação anti-bot.",
			})
			return
		}
		if errors.Is(err, domain.ErrBookingExpired) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusGone)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "Este link de agendamento expirou.",
			})
			return
		}
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(appt)
}

// ListTypes retorna os tipos de agendamento configurados pelo usuário logado.
func (h *BookingHandler) ListTypes(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "Não autorizado", http.StatusUnauthorized)
		return
	}

	types, err := h.bookingSvc.ListBookingTypes(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if types == nil {
		types = []service.BookingTypeWithLink{}
	}
	_ = json.NewEncoder(w).Encode(types)
}

// CreateType cria um novo tipo de agendamento pelo usuário logado.
func (h *BookingHandler) CreateType(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "Não autorizado", http.StatusUnauthorized)
		return
	}

	var bt domain.BookingType
	if err := json.NewDecoder(r.Body).Decode(&bt); err != nil {
		http.Error(w, "Payload inválido", http.StatusBadRequest)
		return
	}

	created, err := h.bookingSvc.CreateBookingType(r.Context(), userID, &bt)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(created)
}

// UpdateType atualiza o tipo de agendamento existente.
func (h *BookingHandler) UpdateType(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "Não autorizado", http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	var bt domain.BookingType
	if err := json.NewDecoder(r.Body).Decode(&bt); err != nil {
		http.Error(w, "Payload inválido", http.StatusBadRequest)
		return
	}
	bt.ID = id

	updated, err := h.bookingSvc.UpdateBookingType(r.Context(), userID, &bt)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(updated)
}

// DeleteType remove o link e cascateia (agendamentos + eventos da agenda).
// Retorna o impacto para a mensagem de confirmação no app.
func (h *BookingHandler) DeleteType(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "Não autorizado", http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	impact, err := h.bookingSvc.DeleteBookingType(r.Context(), userID, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if impact == nil {
		impact = &domain.DeleteBookingImpact{}
	}
	_ = json.NewEncoder(w).Encode(impact)
}

// ListAppointments retorna o histórico de agendamentos recebidos pelo anfitrião.
func (h *BookingHandler) ListAppointments(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "Não autorizado", http.StatusUnauthorized)
		return
	}

	appts, err := h.bookingSvc.ListAppointments(r.Context(), userID, time.Time{}, time.Time{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if appts == nil {
		appts = []domain.BookingAppointment{}
	}
	_ = json.NewEncoder(w).Encode(appts)
}

// DeleteAppointment cancela o agendamento recebido e desocupa o horário na agenda do anfitrião.
func (h *BookingHandler) DeleteAppointment(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "Não autorizado", http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	if err := h.bookingSvc.CancelAppointment(r.Context(), userID, id); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
