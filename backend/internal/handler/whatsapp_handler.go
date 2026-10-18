package handler

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

// WhatsAppHandler gerencia as rotas HTTP de integração com o WhatsApp.
type WhatsAppHandler struct {
	waSvc *service.WhatsAppService
}

// NewWhatsAppHandler instancia o handler para rotas de WhatsApp.
func NewWhatsAppHandler(waSvc *service.WhatsAppService) *WhatsAppHandler {
	return &WhatsAppHandler{waSvc: waSvc}
}

type requestPairingCodeInput struct {
	Phone string `json:"phone"`
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

// RequestPairingCode gera ou recupera o código de pareamento de 8 dígitos para o WhatsApp do usuário.
func (h *WhatsAppHandler) RequestPairingCode(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "não autorizado"})
		return
	}

	var input requestPairingCodeInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "payload JSON inválido"})
		return
	}

	if input.Phone == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "o campo 'phone' é obrigatório"})
		return
	}

	code, err := h.waSvc.RequestPairingCode(r.Context(), userID, input.Phone)
	if err != nil {
		if err == domain.ErrWhatsAppInvalidPhone {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "número de telefone inválido"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"pairing_code": code,
		"status":       domain.WhatsAppStatusConnecting,
	})
}

// GetStatus retorna o estado atual da conexão com o WhatsApp.
func (h *WhatsAppHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "não autorizado"})
		return
	}

	status, err := h.waSvc.GetStatus(r.Context(), userID)
	if err != nil {
		if err == domain.ErrWhatsAppIntegrationNotFound {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"status": domain.WhatsAppStatusDisconnected,
			})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "falha ao buscar status do whatsapp"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":                status.ID,
		"status":            status.Status,
		"phone":             status.Phone,
		"pairing_code":      status.PairingCode,
		"last_connected_at": status.LastConnectedAt,
	})
}

// Disconnect desconecta a sessão ativa do WhatsApp.
func (h *WhatsAppHandler) Disconnect(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "não autorizado"})
		return
	}

	if err := h.waSvc.Disconnect(r.Context(), userID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "falha ao desconectar whatsapp"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "WhatsApp desconectado com sucesso",
		"status":  domain.WhatsAppStatusDisconnected,
	})
}

// Webhook recebe notificações assíncronas enviadas pela Evolution API v2.
func (h *WhatsAppHandler) Webhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "falha ao ler corpo da requisição"})
		return
	}

	eventType := r.Header.Get("x-event-type")
	_ = h.waSvc.HandleWebhook(r.Context(), eventType, body)

	writeJSON(w, http.StatusOK, map[string]string{"status": "received"})
}
