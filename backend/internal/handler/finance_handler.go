package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

// FinanceHandler gerencia as rotas HTTP autenticadas do módulo financeiro.
type FinanceHandler struct {
	financeSvc *service.FinanceService
}

// NewFinanceHandler instancia o handler financeiro.
func NewFinanceHandler(financeSvc *service.FinanceService) *FinanceHandler {
	return &FinanceHandler{financeSvc: financeSvc}
}

// GetSummary retorna o resumo financeiro consolidado do usuário (Safe-to-Spend, faturas, categorias).
func (h *FinanceHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}

	summary, err := h.financeSvc.GetFinancialSummary(r.Context(), userID)
	if err != nil {
		http.Error(w, "erro ao calcular resumo financeiro", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(summary)
}

// ListAccounts retorna as contas e cartões bancários do usuário.
func (h *FinanceHandler) ListAccounts(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}

	accounts, err := h.financeSvc.ListAccounts(r.Context(), userID)
	if err != nil {
		http.Error(w, "erro ao listar contas", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(accounts)
}

// ListConnections retorna as instituições financeiras conectadas.
func (h *FinanceHandler) ListConnections(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}

	connections, err := h.financeSvc.ListConnections(r.Context(), userID)
	if err != nil {
		http.Error(w, "erro ao listar conexões", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(connections)
}

// CreateConnection cadastra uma nova conexão bancária autorizada no Meu Pluggy.
func (h *FinanceHandler) CreateConnection(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}

	var req struct {
		PluggyItemID    string `json:"pluggy_item_id"`
		ConnectorID     int    `json:"connector_id"`
		InstitutionName string `json:"institution_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.PluggyItemID == "" {
		http.Error(w, "parâmetros inválidos", http.StatusBadRequest)
		return
	}

	if req.ConnectorID <= 0 {
		req.ConnectorID = 200
	}
	if req.InstitutionName == "" {
		req.InstitutionName = "Meu Pluggy (Open Finance)"
	}

	conn := &domain.FinanceConnection{
		UserID:          userID,
		PluggyItemID:    req.PluggyItemID,
		ConnectorID:     req.ConnectorID,
		InstitutionName: req.InstitutionName,
		Status:          domain.ConnectionStatusUpdated,
	}

	if err := h.financeSvc.CreateConnection(r.Context(), conn); err != nil {
		http.Error(w, "erro ao salvar conexão", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(conn)
}

// DeleteConnection desconecta e exclui uma instituição financeira.
func (h *FinanceHandler) DeleteConnection(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}

	connectionID := chi.URLParam(r, "id")
	if connectionID == "" {
		http.Error(w, "id da conexão obrigatório", http.StatusBadRequest)
		return
	}

	if err := h.financeSvc.DeleteConnection(r.Context(), userID, connectionID); err != nil {
		http.Error(w, "erro ao desconectar instituição", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// SyncPayload processa o Edge-Sync enviado pelo aplicativo mobile.
func (h *FinanceHandler) SyncPayload(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}

	var payload domain.FinanceSyncPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "payload json inválido", http.StatusBadRequest)
		return
	}

	if err := h.financeSvc.IngestSyncPayload(r.Context(), userID, &payload); err != nil {
		http.Error(w, "falha na ingestão do sync", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"processed_accounts":     len(payload.Accounts),
		"processed_transactions": len(payload.Transactions),
	})
}

// GetConnectToken gera o token para carregar o widget Meu Pluggy no smartphone.
func (h *FinanceHandler) GetConnectToken(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}

	token, err := h.financeSvc.GenerateConnectToken(r.Context(), userID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		if errors.Is(err, domain.ErrPluggyCredentialsMissing) {
			w.WriteHeader(http.StatusPreconditionRequired)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": err.Error(),
			})
			return
		}
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error": err.Error(),
		})
		return
	}

	apiKey, _ := h.financeSvc.GetSessionToken(r.Context())

	widgetURL := fmt.Sprintf("https://connect.pluggy.ai/?connect_token=%s&connectToken=%s&with_sandbox=true", url.QueryEscape(token), url.QueryEscape(token))

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"connect_token":      token,
		"widget_url":         widgetURL,
		"api_key":            apiKey,
		"expires_in_minutes": 30,
		"client_user_id":     userID,
	})
}

// GetSessionToken emite uma apiKey efêmera da Pluggy para o cliente móvel realizar o Edge-Sync.
func (h *FinanceHandler) GetSessionToken(w http.ResponseWriter, r *http.Request) {
	_, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}

	apiKey, err := h.financeSvc.GetSessionToken(r.Context())
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusPreconditionRequired)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"api_key": apiKey,
	})
}

// GetTestToken emite token de teste/sandbox para o MVP rápido.
func (h *FinanceHandler) GetTestToken(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		userID = "user_mvp_test"
	}

	token, _ := h.financeSvc.GenerateConnectToken(r.Context(), userID)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"connect_token":      token,
		"expires_in_minutes": 60,
		"client_user_id":     userID,
	})
}

// ListTransactions lista transações com paginação.
func (h *FinanceHandler) ListTransactions(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "não autorizado", http.StatusUnauthorized)
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	txs, err := h.financeSvc.ListTransactions(r.Context(), userID, limit, offset)
	if err != nil {
		http.Error(w, "erro ao listar transações", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(txs)
}
