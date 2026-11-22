package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

// SetAIProviderService conecta o serviço de preferências BYOK para configurar modelo por bot/trigger.
func (h *TriggerHandler) SetAIProviderService(svc *service.AIProviderService) {
	h.aiProviderSvc = svc
}

// UpdateBotModelPref atualiza model_pref e effort_pref de um bot/trigger (PATCH /api/v1/bots/{id}/model).
func (h *TriggerHandler) UpdateBotModelPref(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	if h.aiProviderSvc == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "serviço de provedores de IA não configurado")
		return
	}
	botID := strings.TrimSpace(chi.URLParam(r, "id"))
	if botID == "" {
		writeJSONError(w, http.StatusBadRequest, "id do bot obrigatório")
		return
	}
	var body domain.ModelPreferenceUpdate
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "payload JSON inválido")
		return
	}
	if err := h.aiProviderSvc.UpdateTriggerModelPref(r.Context(), userID, botID, body.ModelPref, body.EffortPref); err != nil {
		if errors.Is(err, domain.ErrTriggerNotFound) {
			writeJSONError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, body)
}
