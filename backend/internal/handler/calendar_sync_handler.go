package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

// CalendarSyncHandler manipula endpoints HTTP relacionados a integrações com agendas externas.
type CalendarSyncHandler struct {
	syncSvc *service.CalendarSyncService
}

// NewCalendarSyncHandler instancia o handler de integrações.
func NewCalendarSyncHandler(syncSvc *service.CalendarSyncService) *CalendarSyncHandler {
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
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	integrations, err := h.syncSvc.ListIntegrations(r.Context(), userID)
	if err != nil {
		http.Error(w, `{"error":"falha ao listar integrações"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(integrations)
}

// ConnectIntegration estabelece e persiste uma nova conexão de calendário.
func (h *CalendarSyncHandler) ConnectIntegration(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	var req connectIntegrationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload JSON inválido"}`, http.StatusBadRequest)
		return
	}

	if req.Provider == "" || req.AccountEmail == "" || req.Credentials == "" {
		http.Error(w, `{"error":"campos 'provider', 'account_email' e 'credentials' são obrigatórios"}`, http.StatusBadRequest)
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
		http.Error(w, `{"error":"falha ao conectar integração: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	// Dispara sincronização inicial sincronamente
	errSync := h.syncSvc.SyncIntegration(r.Context(), userID, req.Provider)
	if errSync != nil {
		http.Error(w, `{"error":"Integração salva, mas falhou ao sincronizar: `+errSync.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(integ)
}

// SyncIntegration força uma sincronização imediata com o provedor especificado.
func (h *CalendarSyncHandler) SyncIntegration(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	provider := chi.URLParam(r, "provider")
	if provider == "" {
		http.Error(w, `{"error":"provedor não informado"}`, http.StatusBadRequest)
		return
	}

	if err := h.syncSvc.SyncIntegration(r.Context(), userID, provider); err != nil {
		http.Error(w, `{"error":"falha ao sincronizar: `+err.Error()+`"}`, http.StatusInternalServerError)
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
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	provider := chi.URLParam(r, "provider")
	if provider == "" {
		http.Error(w, `{"error":"provedor não informado"}`, http.StatusBadRequest)
		return
	}

	if err := h.syncSvc.DisconnectIntegration(r.Context(), userID, provider); err != nil {
		http.Error(w, `{"error":"falha ao desconectar: `+err.Error()+`"}`, http.StatusInternalServerError)
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
