package tasks

import (
	"encoding/json"
	"github.com/andrevmp/vito/backend/internal/platform/httpx"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
)

// PendingHandler gerencia as requisições HTTP REST da Incubadora de Pendências.
type PendingHandler struct {
	svc *PendingService
}

// NewPendingHandler cria um novo handler de pendências.
func NewPendingHandler(svc *PendingService) *PendingHandler {
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
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	var req createPendingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload inválido")
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
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(item)
}

func (h *PendingHandler) ListPending(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
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
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao listar pendências")
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
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		id = r.PathValue("id")
	}

	item, err := h.svc.GetByID(id, userID)
	if err != nil {
		if err == domain.ErrPendingItemNotFound {
			httpx.RespondError(w, domain.ErrPendingItemNotFound)
			return
		}
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao buscar pendência")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(item)
}

func (h *PendingHandler) UpdatePending(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		id = r.PathValue("id")
	}

	var req updatePendingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload inválido")
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
			httpx.RespondError(w, domain.ErrPendingItemNotFound)
			return
		}
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(item)
}

func (h *PendingHandler) SchedulePending(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		id = r.PathValue("id")
	}

	var req schedulePendingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ScheduledDate == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "data de agendamento obrigatória (YYYY-MM-DD)")
		return
	}

	item, err := h.svc.SchedulePending(id, userID, req.ScheduledDate)
	if err != nil {
		if err == domain.ErrPendingItemNotFound {
			httpx.RespondError(w, domain.ErrPendingItemNotFound)
			return
		}
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(item)
}

func (h *PendingHandler) CompletePending(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		id = r.PathValue("id")
	}

	item, err := h.svc.CompletePending(id, userID)
	if err != nil {
		if err == domain.ErrPendingItemNotFound {
			httpx.RespondError(w, domain.ErrPendingItemNotFound)
			return
		}
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao concluir pendência")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(item)
}

func (h *PendingHandler) DeletePending(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		id = r.PathValue("id")
	}

	if err := h.svc.DeletePending(id, userID); err != nil {
		if err == domain.ErrPendingItemNotFound {
			httpx.RespondError(w, domain.ErrPendingItemNotFound)
			return
		}
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao excluir pendência")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// RegisterRoutes registra os endpoints da Incubadora de Pendências no roteador protegido.
func (h *PendingHandler) RegisterRoutes(r chi.Router) {
	if h == nil {
		return
	}
	r.Route("/pending", func(pr chi.Router) {
		pr.Get("/", h.ListPending)
		pr.Post("/", h.CreatePending)
		pr.Get("/{id}", h.GetPending)
		pr.Patch("/{id}", h.UpdatePending)
		pr.Post("/{id}/schedule", h.SchedulePending)
		pr.Post("/{id}/complete", h.CompletePending)
		pr.Delete("/{id}", h.DeletePending)
	})
}
