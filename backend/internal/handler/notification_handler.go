package handler

import (
	"encoding/json"
	"net/http"

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
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	var req registerDeviceTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload inválido"}`, http.StatusBadRequest)
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

// SendTestNotification dispara uma notificação push de teste para o usuário autenticado.
func (h *NotificationHandler) SendTestNotification(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	var req testNotificationRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	title := req.Title
	if title == "" {
		title = "Vito — Lembrete de Teste"
	}
	body := req.Body
	if body == "" {
		if req.Priority == "wakeup" {
			body = "🚨 Alerta Crítico Wake-up Call ativado! Toque persistente e prioridade máxima."
		} else {
			body = "Notificação padrão de compromisso entregue com sucesso."
		}
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
