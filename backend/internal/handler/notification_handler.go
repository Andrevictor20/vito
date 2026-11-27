package handler

import (
	"encoding/json"
	"github.com/andrevmp/vito/backend/internal/platform/httpx"
	"net/http"
	"time"

	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

type NotificationHandler struct {
	notifSvc *service.NotificationService
}

func NewNotificationHandler(notifSvc *service.NotificationService) *NotificationHandler {
	return &NotificationHandler{notifSvc: notifSvc}
}

type registerDeviceTokenRequest struct {
	Token    string `json:"token"`
	Platform string `json:"platform,omitempty"`
}

type testNotificationRequest struct {
	Title    string `json:"title,omitempty"`
	Body     string `json:"body,omitempty"`
	Priority string `json:"priority,omitempty"` // "default", "wakeup", "silent"
}

// RegisterDeviceToken recebe e persiste o push token do dispositivo para o usuário autenticado.
func (h *NotificationHandler) RegisterDeviceToken(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	var req registerDeviceTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload inválido")
		return
	}

	dt, err := h.notifSvc.RegisterDeviceToken(userID, req.Token, req.Platform)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "registered",
		"token":  dt.Token,
	})
}

// UnregisterDeviceToken revoga o push token do dispositivo para o usuário autenticado.
func (h *NotificationHandler) UnregisterDeviceToken(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	var req registerDeviceTokenRequest
	token := r.URL.Query().Get("token")
	if token == "" {
		_ = json.NewDecoder(r.Body).Decode(&req)
		token = req.Token
	}

	if err := h.notifSvc.UnregisterDeviceToken(userID, token); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "unregistered",
		"token":  token,
	})
}

// SendTestNotification dispara uma notificação push de teste para o usuário autenticado.
func (h *NotificationHandler) SendTestNotification(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	var req testNotificationRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	title := req.Title
	if title == "" {
		title = "Notificação de teste"
	}
	body := req.Body
	if body == "" {
		body = "Tudo pronto · seus alertas do Vito estão chegando com o novo visual."
	}
	priority := req.Priority
	if priority == "" {
		priority = "default"
	}

	sentCount, err := h.notifSvc.SendPushToUser(userID, title, body, priority, map[string]interface{}{
		"type": "test_alert",
	})
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":     "sent",
		"dispatched": sentCount,
	})
}

// GetNotificationStatus retorna o status de registro de dispositivos para push do usuário autenticado.
func (h *NotificationHandler) GetNotificationStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	tokens, err := h.notifSvc.GetUserTokens(userID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	type deviceDTO struct {
		Platform  string    `json:"platform"`
		UpdatedAt time.Time `json:"updated_at"`
	}

	devices := make([]deviceDTO, 0, len(tokens))
	for _, t := range tokens {
		devices = append(devices, deviceDTO{
			Platform:  t.Platform,
			UpdatedAt: t.UpdatedAt,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"registered":   len(tokens) > 0,
		"device_count": len(tokens),
		"devices":      devices,
	})
}
