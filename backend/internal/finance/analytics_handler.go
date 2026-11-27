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
	"github.com/andrevmp/vito/backend/internal/platform/httpx"
)

// FinanceAnalyticsHandler expõe endpoints analíticos, extrato filtrado, cartões e parcelas.
type FinanceAnalyticsHandler struct {
	finSvc *FinanceService
}

// NewFinanceAnalyticsHandler instancia o handler analítico financeiro.
func NewFinanceAnalyticsHandler(finSvc *FinanceService) *FinanceAnalyticsHandler {
	return &FinanceAnalyticsHandler{finSvc: finSvc}
}

func (h *FinanceAnalyticsHandler) SearchTransactions(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
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

	txs, err := h.finSvc.SearchTransactions(r.Context(), userID, domain.FinanceTransactionFilter{
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
		httpx.WriteJSONError(w, http.StatusInternalServerError, "erro ao buscar transações")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, txs)
}

func (h *FinanceAnalyticsHandler) RecategorizeTransaction(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	txID := chi.URLParam(r, "id")
	var req domain.FinanceRecategorizeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Category == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "categoria obrigatória")
		return
	}
	updated, err := h.finSvc.RecategorizeTransaction(r.Context(), userID, txID, req)
	if err != nil {
		if errors.Is(err, domain.ErrFinanceInvalidPayload) {
			httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
			return
		}
		httpx.WriteJSONError(w, http.StatusInternalServerError, "erro ao recategorizar transação")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"updated_count": updated, "category": req.Category})
}

func (h *FinanceAnalyticsHandler) GetSpendingAnalytics(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	res, err := h.finSvc.GetSpendingAnalytics(r.Context(), userID)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "erro ao calcular gastos")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *FinanceAnalyticsHandler) GetCashFlowAnalytics(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	months, _ := strconv.Atoi(r.URL.Query().Get("months"))
	res, err := h.finSvc.GetCashFlowAnalytics(r.Context(), userID, months)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "erro ao calcular fluxo de caixa")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *FinanceAnalyticsHandler) GetCardsOverview(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	res, err := h.finSvc.GetCardsOverview(r.Context(), userID)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "erro ao listar cartões")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *FinanceAnalyticsHandler) GetCardBills(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	accountID := chi.URLParam(r, "id")
	res, err := h.finSvc.GetCardBills(r.Context(), userID, accountID)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "erro ao listar faturas")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *FinanceAnalyticsHandler) GetInstallmentsOverview(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	months, _ := strconv.Atoi(r.URL.Query().Get("months"))
	res, err := h.finSvc.GetInstallmentsOverview(r.Context(), userID, months)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "erro ao projetar parcelamentos")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *FinanceAnalyticsHandler) GetFinanceCalendar(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	now := time.Now().UTC()
	events, err := h.finSvc.GetFinanceCalendar(r.Context(), userID, now, now.AddDate(0, 1, 0))
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "erro ao gerar calendário financeiro")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, events)
}
