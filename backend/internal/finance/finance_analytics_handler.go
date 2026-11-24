package finance

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
)

// FinanceAnalyticsHandler expõe endpoints analíticos, extrato filtrado, cartões e parcelas.
type FinanceAnalyticsHandler struct {
	analyticsSvc *FinanceAnalyticsService
}

// NewFinanceAnalyticsHandler instancia o handler analítico financeiro.
func NewFinanceAnalyticsHandler(analyticsSvc *FinanceAnalyticsService) *FinanceAnalyticsHandler {
	return &FinanceAnalyticsHandler{analyticsSvc: analyticsSvc}
}

func (h *FinanceAnalyticsHandler) SearchTransactions(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}
	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))
	offset, _ := strconv.Atoi(q.Get("offset"))

	var fromPtr, toPtr *time.Time
	if f := q.Get("from"); f != "" {
		if t, err := time.Parse("2006-01-02", f); err == nil {
			fromPtr = &t
		}
	}
	if to := q.Get("to"); to != "" {
		if t, err := time.Parse("2006-01-02", to); err == nil {
			endDay := t.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
			toPtr = &endDay
		}
	}

	txs, err := h.analyticsSvc.SearchTransactions(r.Context(), userID, domain.FinanceTransactionFilter{
		Query:     q.Get("q"),
		AccountID: q.Get("account_id"),
		Category:  q.Get("category"),
		TxType:    q.Get("type"),
		From:      fromPtr,
		To:        toPtr,
		Limit:     limit,
		Offset:    offset,
	})
	if err != nil {
		http.Error(w, "erro ao buscar transações", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(txs)
}

func (h *FinanceAnalyticsHandler) RecategorizeTransaction(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}
	txID := chi.URLParam(r, "id")
	var req domain.FinanceRecategorizeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Category == "" {
		http.Error(w, "categoria obrigatória", http.StatusBadRequest)
		return
	}
	updated, err := h.analyticsSvc.RecategorizeTransaction(r.Context(), userID, txID, req)
	if err != nil {
		if errors.Is(err, domain.ErrFinanceInvalidPayload) {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		http.Error(w, "erro ao recategorizar transação", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"updated_count": updated, "category": req.Category})
}

func (h *FinanceAnalyticsHandler) GetSpendingAnalytics(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}
	res, err := h.analyticsSvc.GetSpendingAnalytics(r.Context(), userID)
	if err != nil {
		http.Error(w, "erro ao calcular gastos", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

func (h *FinanceAnalyticsHandler) GetCashFlowAnalytics(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}
	months, _ := strconv.Atoi(r.URL.Query().Get("months"))
	res, err := h.analyticsSvc.GetCashFlowAnalytics(r.Context(), userID, months)
	if err != nil {
		http.Error(w, "erro ao calcular fluxo de caixa", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

func (h *FinanceAnalyticsHandler) GetCardsOverview(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}
	res, err := h.analyticsSvc.GetCardsOverview(r.Context(), userID)
	if err != nil {
		http.Error(w, "erro ao listar cartões", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

func (h *FinanceAnalyticsHandler) GetCardBills(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}
	accountID := chi.URLParam(r, "id")
	res, err := h.analyticsSvc.GetCardBills(r.Context(), userID, accountID)
	if err != nil {
		http.Error(w, "erro ao listar faturas", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

func (h *FinanceAnalyticsHandler) GetInstallmentsOverview(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}
	months, _ := strconv.Atoi(r.URL.Query().Get("months"))
	res, err := h.analyticsSvc.GetInstallmentsOverview(r.Context(), userID, months)
	if err != nil {
		http.Error(w, "erro ao projetar parcelamentos", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

func (h *FinanceAnalyticsHandler) GetFinanceCalendar(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}
	now := time.Now().UTC()
	events, err := h.analyticsSvc.GetFinanceCalendar(r.Context(), userID, now, now.AddDate(0, 1, 0))
	if err != nil {
		http.Error(w, "erro ao gerar calendário financeiro", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(events)
}
