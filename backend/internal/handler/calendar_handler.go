package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/kito/backend/internal/domain"
	"github.com/andrevmp/kito/backend/internal/handler/middleware"
	"github.com/andrevmp/kito/backend/internal/service"
)

type CalendarHandler struct {
	calSvc *service.CalendarService
}

func NewCalendarHandler(calSvc *service.CalendarService) *CalendarHandler {
	return &CalendarHandler{calSvc: calSvc}
}

type createEventRequest struct {
	Title       string    `json:"title"`
	Description string    `json:"description,omitempty"`
	Location    string    `json:"location,omitempty"`
	StartAt     time.Time `json:"start_at"`
	EndAt       time.Time `json:"end_at"`
}

type createEventResponse struct {
	Event    *domain.Event        `json:"event"`
	Conflict *domain.ConflictInfo `json:"conflict,omitempty"`
}

func (h *CalendarHandler) CreateEvent(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	var req createEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload inválido"}`, http.StatusBadRequest)
		return
	}

	event, conflict, err := h.calSvc.CreateEvent(
		userID, req.Title, req.Description, req.Location, req.StartAt, req.EndAt,
	)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(createEventResponse{
		Event:    event,
		Conflict: conflict,
	})
}

func (h *CalendarHandler) ListEvents(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	fromStr := r.URL.Query().Get("from")
	toStr := r.URL.Query().Get("to")

	from := time.Now().UTC().AddDate(0, 0, -7)
	if fromStr != "" {
		if parsed, err := time.Parse(time.RFC3339, fromStr); err == nil {
			from = parsed
		}
	}

	to := from.AddDate(0, 1, 0)
	if toStr != "" {
		if parsed, err := time.Parse(time.RFC3339, toStr); err == nil {
			to = parsed
		}
	}

	events, err := h.calSvc.ListEvents(userID, from, to)
	if err != nil {
		http.Error(w, `{"error":"falha ao listar eventos"}`, http.StatusInternalServerError)
		return
	}

	if events == nil {
		events = []domain.Event{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(events)
}

func (h *CalendarHandler) DeleteEvent(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	eventID := chi.URLParam(r, "id")
	if eventID == "" {
		eventID = r.PathValue("id")
	}
	if eventID == "" {
		http.Error(w, `{"error":"id ausente"}`, http.StatusBadRequest)
		return
	}

	if err := h.calSvc.DeleteEvent(eventID, userID); err != nil {
		if err == domain.ErrEventNotFound {
			http.Error(w, `{"error":"evento não encontrado"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"falha ao excluir evento"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
