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

// RunBot dispara a execução imediata do bot (POST /api/v1/bots/{id}/run).
func (h *BotHandler) RunBot(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	botID := chi.URLParam(r, "id")
	if _, err := h.botRepo.GetByID(r.Context(), botID, userID); err != nil {
		respondError(w, err)
		return
	}
	if h.runner == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "executor de bots não configurado")
		return
	}
	report, err := h.runner.RunBotNow(r.Context(), userID, botID)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, report)
}

// GetBotChat lista o histórico de chat isolado do bot (GET /api/v1/bots/{id}/chat).
func (h *BotHandler) GetBotChat(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	botID := chi.URLParam(r, "id")
	if _, err := h.botRepo.GetByID(r.Context(), botID, userID); err != nil {
		respondError(w, err)
		return
	}
	if h.chatSvc == nil {
		writeJSON(w, http.StatusOK, map[string]any{"messages": []BotChatMessageDTO{}})
		return
	}
	msgs, err := h.chatSvc.GetMessages(r.Context(), userID, botID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "falha ao carregar chat do bot")
		return
	}
	if msgs == nil {
		msgs = []BotChatMessageDTO{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"messages": msgs})
}

// SendBotChat envia uma mensagem para o chat isolado do bot (POST /api/v1/bots/{id}/chat).
func (h *BotHandler) SendBotChat(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	botID := chi.URLParam(r, "id")
	if _, err := h.botRepo.GetByID(r.Context(), botID, userID); err != nil {
		respondError(w, err)
		return
	}
	var req struct {
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Message) == "" {
		writeJSONError(w, http.StatusBadRequest, "mensagem obrigatória")
		return
	}
	if h.chatSvc == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "serviço de chat do bot não configurado")
		return
	}
	reply, err := h.chatSvc.SendMessage(r.Context(), userID, botID, strings.TrimSpace(req.Message))
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, reply)
}

// ResolvePending aprova ou nega uma confirmação pendente do bot (POST /api/v1/bots/{id}/pending/{confirmationId}/resolve).
func (h *BotHandler) ResolvePending(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	botID := chi.URLParam(r, "id")
	confID := chi.URLParam(r, "confirmationId")
	if _, err := h.botRepo.GetByID(r.Context(), botID, userID); err != nil {
		respondError(w, err)
		return
	}
	var req struct {
		Decision string `json:"decision"`
		Action   string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "payload inválido")
		return
	}
	decision := strings.TrimSpace(req.Decision)
	if decision == "" {
		decision = strings.TrimSpace(req.Action)
	}
	if decision != "allow_once" && decision != "always_allow" && decision != "deny" {
		writeJSONError(w, http.StatusUnprocessableEntity, "decisão inválida: use allow_once, always_allow ou deny")
		return
	}
	if h.confGate == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "serviço de confirmação não configurado")
		return
	}
	pending, err := h.confGate.GetByID(r.Context(), confID, userID)
	if err != nil {
		if errors.Is(err, service.ErrUnauthorizedTenant) {
			writeJSONError(w, http.StatusForbidden, err.Error())
			return
		}
		writeJSONError(w, http.StatusNotFound, "confirmação pendente não encontrada")
		return
	}
	actionKey := resolveActionKey(pending.ToolsetName, pending.Operation)
	if decision == "always_allow" {
		if spec, exists := domain.ActionCatalog[actionKey]; (exists && spec.AlwaysAsk) || domain.IsAlwaysAskAction(actionKey) {
			respondError(w, domain.ErrAlwaysAskPolicyViolation)
			return
		}
		if actionKey != "" {
			if err := h.botRepo.UpsertAction(r.Context(), &domain.BotAction{
				BotID: botID, UserID: userID, ActionKey: actionKey, Policy: domain.ActionPolicyAuto,
			}); err != nil {
				respondError(w, err)
				return
			}
		}
	}
	if decision == "deny" {
		if err := h.confGate.CancelWithReason(r.Context(), confID, userID, "negado pelo usuário"); err != nil {
			writeJSONError(w, http.StatusConflict, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "denied", "decision": decision})
		return
	}
	if _, err := h.confGate.Resume(r.Context(), confID, userID); err != nil {
		writeJSONError(w, http.StatusConflict, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "approved", "decision": decision, "action_key": actionKey})
}

// UpdateBotModelPref atualiza o modelo preferido do bot (PATCH /api/v1/bots/{id}/model).
func (h *BotHandler) UpdateBotModelPref(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	botID := strings.TrimSpace(chi.URLParam(r, "id"))
	var body domain.ModelPreferenceUpdate
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "payload JSON inválido")
		return
	}
	bot, err := h.botRepo.GetByID(r.Context(), botID, userID)
	if err != nil {
		respondError(w, err)
		return
	}
	if h.aiProviderSvc != nil {
		if err := h.aiProviderSvc.UpdateTriggerModelPref(r.Context(), userID, botID, body.ModelPref, body.EffortPref); err != nil {
			writeJSONError(w, http.StatusBadRequest, err.Error())
			return
		}
		bot, _ = h.botRepo.GetByID(r.Context(), botID, userID)
	} else {
		bot.ModelPref = strings.TrimSpace(body.ModelPref)
		bot.EffortPref = strings.TrimSpace(body.EffortPref)
		if err := h.botRepo.Update(r.Context(), bot); err != nil {
			respondError(w, err)
			return
		}
	}
	connMap := h.userAppConnections(r.Context(), userID)
	writeJSON(w, http.StatusOK, h.buildBotResponse(r.Context(), userID, bot, connMap, false))
}
