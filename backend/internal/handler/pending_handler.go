package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

// PendingHandler gerencia as requisições HTTP REST da Incubadora de Pendências.
type PendingHandler struct {
	svc *service.PendingService
}

// NewPendingHandler cria um novo handler de pendências.
func NewPendingHandler(svc *service.PendingService) *PendingHandler {
	return &PendingHandler{svc: svc}
}

type createPendingRequest struct {
	Title         string     `json:"title"`
	Description   string     `json:"description,omitempty"`
	Category      string     `json:"category,omitempty"`
	ScheduledDate string     `json:"scheduled_date,omitempty"`
	RemindAt      *time.Time `json:"remind_at,omitempty"`
	RemindRepeat  string     `json:"remind_repeat,omitempty"`
	RemindAdvance int        `json:"remind_advance_minutes,omitempty"`
}

type updatePendingRequest struct {
	Title         *string               `json:"title,omitempty"`
	Description   *string               `json:"description,omitempty"`
	Category      *string               `json:"category,omitempty"`
	Status        *domain.PendingStatus `json:"status,omitempty"`
	ScheduledDate *string               `json:"scheduled_date,omitempty"`
	RemindAt      *time.Time            `json:"remind_at,omitempty"`
	RemindRepeat  *string               `json:"remind_repeat,omitempty"`
	RemindAdvance *int                  `json:"remind_advance_minutes,omitempty"`
}

type schedulePendingRequest struct {
	ScheduledDate string `json:"scheduled_date"`
}

func (h *PendingHandler) CreatePending(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	var req createPendingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload inválido"}`, http.StatusBadRequest)
		return
	}

	item, err := h.svc.CreatePending(userID, domain.CreatePendingInput{
		Title:         req.Title,
		Description:   req.Description,
		Category:      req.Category,
		ScheduledDate: req.ScheduledDate,
		RemindAt:      req.RemindAt,
		RemindRepeat:  req.RemindRepeat,
		RemindAdvance: req.RemindAdvance,
	})
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(item)
}

func (h *PendingHandler) ListPending(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	statusParam := r.URL.Query().Get("status")
	var statusPtr *domain.PendingStatus
	if statusParam != "" {
		st := domain.PendingStatus(statusParam)
		statusPtr = &st
	}

	category := r.URL.Query().Get("category")

	items, err := h.svc.ListByUser(userID, statusPtr, category)
	if err != nil {
		http.Error(w, `{"error":"falha ao listar pendências"}`, http.StatusInternalServerError)
		return
	}

	if items == nil {
		items = []domain.PendingItem{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(items)
}

func (h *PendingHandler) GetPending(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		id = r.PathValue("id")
	}

	item, err := h.svc.GetByID(id, userID)
	if err != nil {
		if err == domain.ErrPendingItemNotFound {
			respondError(w, domain.ErrPendingItemNotFound)
			return
		}
		http.Error(w, `{"error":"falha ao buscar pendência"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(item)
}

func (h *PendingHandler) UpdatePending(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		id = r.PathValue("id")
	}

	var req updatePendingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload inválido"}`, http.StatusBadRequest)
		return
	}

	item, err := h.svc.UpdatePending(id, userID, domain.UpdatePendingInput{
		Title:         req.Title,
		Description:   req.Description,
		Category:      req.Category,
		Status:        req.Status,
		ScheduledDate: req.ScheduledDate,
		RemindAt:      req.RemindAt,
		RemindRepeat:  req.RemindRepeat,
		RemindAdvance: req.RemindAdvance,
	})
	if err != nil {
		if err == domain.ErrPendingItemNotFound {
			respondError(w, domain.ErrPendingItemNotFound)
			return
		}
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(item)
}

func (h *PendingHandler) SchedulePending(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		id = r.PathValue("id")
	}

	var req schedulePendingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ScheduledDate == "" {
		http.Error(w, `{"error":"data de agendamento obrigatória (YYYY-MM-DD)"}`, http.StatusBadRequest)
		return
	}

	item, err := h.svc.SchedulePending(id, userID, req.ScheduledDate)
	if err != nil {
		if err == domain.ErrPendingItemNotFound {
			respondError(w, domain.ErrPendingItemNotFound)
			return
		}
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(item)
}

func (h *PendingHandler) CompletePending(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		id = r.PathValue("id")
	}

	item, err := h.svc.CompletePending(id, userID)
	if err != nil {
		if err == domain.ErrPendingItemNotFound {
			respondError(w, domain.ErrPendingItemNotFound)
			return
		}
		http.Error(w, `{"error":"falha ao concluir pendência"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(item)
}

func (h *PendingHandler) DeletePending(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		id = r.PathValue("id")
	}

	if err := h.svc.DeletePending(id, userID); err != nil {
		if err == domain.ErrPendingItemNotFound {
			respondError(w, domain.ErrPendingItemNotFound)
			return
		}
		http.Error(w, `{"error":"falha ao excluir pendência"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
