package finance

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
)

// FinanceLimitHandler expõe endpoints REST para limites de gasto multi-escopo e metas.
type FinanceLimitHandler struct {
	limitSvc *FinanceLimitService
}

// NewFinanceLimitHandler instancia o handler de limites financeiros.
func NewFinanceLimitHandler(limitSvc *FinanceLimitService) *FinanceLimitHandler {
	return &FinanceLimitHandler{limitSvc: limitSvc}
}

func (h *FinanceLimitHandler) ListLimits(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}
	scope := domain.SpendingLimitScope(r.URL.Query().Get("scope"))
	items, err := h.limitSvc.ListLimitsWithStatus(r.Context(), userID, scope)
	if err != nil {
		http.Error(w, "erro ao listar limites", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(items)
}

func (h *FinanceLimitHandler) UpsertLimit(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}

	var rule domain.FinanceLimitRule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		http.Error(w, "payload json inválido", http.StatusBadRequest)
		return
	}
	if idParam := chi.URLParam(r, "id"); idParam != "" {
		rule.ID = idParam
	}
	// Default is_active=true na criação se não enviado explicitamente como false
	if r.Method == http.MethodPost && !rule.IsActive {
		rule.IsActive = true
	}

	status, err := h.limitSvc.UpsertLimit(r.Context(), userID, &rule)
	if err != nil {
		if errors.Is(err, domain.ErrFinanceInvalidPayload) {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		http.Error(w, "erro ao salvar limite", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if r.Method == http.MethodPost {
		w.WriteHeader(http.StatusCreated)
	}
	_ = json.NewEncoder(w).Encode(status)
}

func (h *FinanceLimitHandler) DeleteLimit(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}
	limitID := chi.URLParam(r, "id")
	if err := h.limitSvc.DeleteLimit(r.Context(), userID, limitID); err != nil {
		if errors.Is(err, domain.ErrFinanceInvalidPayload) {
			http.Error(w, "limite não encontrado", http.StatusNotFound)
			return
		}
		http.Error(w, "erro ao excluir limite", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *FinanceLimitHandler) MuteLimit(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}
	limitID := chi.URLParam(r, "id")
	status, err := h.limitSvc.MuteLimitForCurrentCycle(r.Context(), userID, limitID)
	if err != nil {
		if errors.Is(err, domain.ErrFinanceInvalidPayload) {
			http.Error(w, "limite não encontrado", http.StatusNotFound)
			return
		}
		http.Error(w, "erro ao silenciar limite", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(status)
}

func (h *FinanceLimitHandler) GetLimitHistory(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}
	limitID := chi.URLParam(r, "id")
	events, err := h.limitSvc.GetLimitHistory(r.Context(), userID, limitID)
	if err != nil {
		http.Error(w, "erro ao buscar histórico do limite", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(events)
}

func (h *FinanceLimitHandler) GetLimitSuggestions(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}
	suggestions, err := h.limitSvc.SuggestLimits(r.Context(), userID)
	if err != nil {
		http.Error(w, "erro ao gerar sugestões", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(suggestions)
}
