package handler

import (
	"encoding/json"
	"errors"
	"github.com/andrevmp/vito/backend/internal/platform/httpx"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

// NotificationsInboxHandler expõe os endpoints REST da Central de Notificações (#s-notifs) e Preferências.
type NotificationsInboxHandler struct {
	svc *service.NotificationsInboxService
}

// NewNotificationsInboxHandler instancia o handler da central de notificações.
func NewNotificationsInboxHandler(svc *service.NotificationsInboxService) *NotificationsInboxHandler {
	return &NotificationsInboxHandler{svc: svc}
}

// ListNotifications retorna a caixa de notificações filtrada e agrupada do usuário autenticado (GET /api/v1/notifications).
func (h *NotificationsInboxHandler) ListNotifications(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	q := r.URL.Query()
	filter := domain.NotificationInboxFilter{
		Type:             strings.TrimSpace(q.Get("type")),
		UnreadOnly:       q.Get("unread_only") == "true" || q.Get("unread_only") == "1",
		IncludeDismissed: q.Get("include_dismissed") == "true" || q.Get("include_dismissed") == "1",
	}
	if rawLimit := strings.TrimSpace(q.Get("limit")); rawLimit != "" {
		if parsed, err := strconv.Atoi(rawLimit); err == nil && parsed > 0 {
			filter.Limit = parsed
		}
	}

	items, counts, err := h.svc.ListNotifications(r.Context(), userID, filter)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao listar notificações")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"notifications": items,
		"unread_count":  counts.Unread,
		"counts":        counts,
	})
}

// ExecuteAction resolve uma ação inline de notificação (POST /api/v1/notifications/{id}/action).
func (h *NotificationsInboxHandler) ExecuteAction(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	notifID := strings.TrimSpace(chi.URLParam(r, "id"))
	if notifID == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "id de notificação obrigatório")
		return
	}

	var req struct {
		Action   string `json:"action"`
		Decision string `json:"decision"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload inválido")
		return
	}

	res, err := h.svc.ResolveAction(r.Context(), userID, notifID, req.Action, req.Decision)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrNotificationNotFound):
			httpx.RespondError(w, err)
		case errors.Is(err, service.ErrUnauthorizedTenant):
			httpx.WriteJSONError(w, http.StatusForbidden, err.Error())
		case errors.Is(err, service.ErrConfirmationAlreadyResolved), errors.Is(err, service.ErrConfirmationCancelled):
			httpx.WriteJSONError(w, http.StatusConflict, err.Error())
		case errors.Is(err, domain.ErrInvalidNotificationAction), errors.Is(err, domain.ErrAlwaysAskPolicyViolation):
			httpx.RespondError(w, err)
		default:
			httpx.RespondError(w, err)
		}
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

// MarkAllRead marca todas as notificações não descartadas do usuário como lidas (POST /api/v1/notifications/read-all).
func (h *NotificationsInboxHandler) MarkAllRead(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	updated, err := h.svc.MarkAllRead(r.Context(), userID)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao marcar notificações como lidas")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"status":       "ok",
		"updated":      updated,
		"unread_count": 0,
	})
}

// GetPreferences retorna as preferências granulares de notificação (GET /api/v1/notifications/preferences).
func (h *NotificationsInboxHandler) GetPreferences(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	prefs, err := h.svc.GetPreferences(r.Context(), userID)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao carregar preferências de notificação")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, prefs)
}

// UpdatePreferences atualiza as preferências de notificação do usuário (PUT /api/v1/notifications/preferences).
func (h *NotificationsInboxHandler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	var upd domain.NotificationPreferencesUpdate
	if err := json.NewDecoder(r.Body).Decode(&upd); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload inválido")
		return
	}
	prefs, err := h.svc.UpdatePreferences(r.Context(), userID, upd)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao salvar preferências de notificação")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, prefs)
}
