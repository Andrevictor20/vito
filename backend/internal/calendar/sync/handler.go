package calsync

import (
	"context"
	"encoding/json"
	"github.com/andrevmp/vito/backend/internal/platform/httpx"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/handler/middleware"
)

// CalendarSyncHandler manipula endpoints HTTP relacionados a integrações com agendas externas.
type CalendarSyncHandler struct {
	syncSvc *CalendarSyncService
}

// NewCalendarSyncHandler instancia o handler de integrações.
func NewCalendarSyncHandler(syncSvc *CalendarSyncService) *CalendarSyncHandler {
	return &CalendarSyncHandler{syncSvc: syncSvc}
}

type connectIntegrationRequest struct {
	Provider     string `json:"provider"`
	AccountEmail string `json:"account_email"`
	Credentials  string `json:"credentials"`
	CalendarID   string `json:"calendar_id"`
	CalendarName string `json:"calendar_name"`
}

// ListIntegrations lista todas as integrações de calendário ativas do usuário.
func (h *CalendarSyncHandler) ListIntegrations(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	integrations, err := h.syncSvc.ListIntegrations(r.Context(), userID)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao listar integrações")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(integrations)
}

// ConnectIntegration estabelece e persiste uma nova conexão de calendário.
func (h *CalendarSyncHandler) ConnectIntegration(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	var req connectIntegrationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload JSON inválido")
		return
	}

	if req.Provider == "" || req.AccountEmail == "" || req.Credentials == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "campos 'provider', 'account_email' e 'credentials' são obrigatórios")
		return
	}

	integ, err := h.syncSvc.ConnectIntegration(
		r.Context(),
		userID,
		req.Provider,
		req.AccountEmail,
		req.Credentials,
		req.CalendarID,
		req.CalendarName,
	)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao conectar integração: "+err.Error())
		return
	}

	// Dispara sincronização inicial em background
	go func(uID, prov string) {
		_ = h.syncSvc.SyncIntegration(context.Background(), uID, prov)
	}(userID, req.Provider)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(integ)
}

// SyncIntegration força uma sincronização imediata com o provedor especificado.
func (h *CalendarSyncHandler) SyncIntegration(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	provider := chi.URLParam(r, "provider")
	if provider == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "provedor não informado")
		return
	}

	if err := h.syncSvc.SyncIntegration(r.Context(), userID, provider); err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao sincronizar: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status":   "synced",
		"provider": provider,
	})
}

// DisconnectIntegration desativa a integração e limpa as credenciais locais.
func (h *CalendarSyncHandler) DisconnectIntegration(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	provider := chi.URLParam(r, "provider")
	if provider == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "provedor não informado")
		return
	}

	if err := h.syncSvc.DisconnectIntegration(r.Context(), userID, provider); err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao desconectar: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status":   "disconnected",
		"provider": provider,
	})
}

// GoogleWebhook recebe notificações push do Google Calendar.
func (h *CalendarSyncHandler) GoogleWebhook(w http.ResponseWriter, r *http.Request) {
	// Responde 200 OK imediatamente para o Google
	w.WriteHeader(http.StatusOK)
}

// RegisterRoutes registra os endpoints de sincronização de agendas externas no roteador protegido.
func (h *CalendarSyncHandler) RegisterRoutes(r chi.Router) {
	if h == nil {
		return
	}
	r.Route("/integrations/calendars", func(ir chi.Router) {
		ir.Get("/", h.ListIntegrations)
		ir.Post("/connect", h.ConnectIntegration)
		ir.Post("/{provider}/sync", h.SyncIntegration)
		ir.Delete("/{provider}", h.DisconnectIntegration)
		ir.Post("/google/webhook", h.GoogleWebhook)
	})
}
