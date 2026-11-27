package bots

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/platform/httpx"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

// RunBot dispara a execução imediata do bot (POST /api/v1/bots/{id}/run).
func (h *BotHandler) RunBot(w http.ResponseWriter, r *http.Request) {
	userID, botID, _, ok := h.requireOwnedBot(w, r)
	if !ok {
		return
	}
	if h.runner == nil {
		httpx.WriteJSONError(w, http.StatusServiceUnavailable, "executor de bots não configurado")
		return
	}
	report, err := h.runner.RunBotNow(r.Context(), userID, botID)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, report)
}

// GetBotChat lista o histórico de chat isolado do bot (GET /api/v1/bots/{id}/chat).
func (h *BotHandler) GetBotChat(w http.ResponseWriter, r *http.Request) {
	userID, botID, _, ok := h.requireOwnedBot(w, r)
	if !ok {
		return
	}
	if h.chatSvc == nil {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"messages": []BotChatMessageDTO{}})
		return
	}
	msgs, err := h.chatSvc.GetMessages(r.Context(), userID, botID)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao carregar chat do bot")
		return
	}
	if msgs == nil {
		msgs = []BotChatMessageDTO{}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"messages": msgs})
}

// SendBotChat envia uma mensagem para o chat isolado do bot (POST /api/v1/bots/{id}/chat).
func (h *BotHandler) SendBotChat(w http.ResponseWriter, r *http.Request) {
	userID, botID, _, ok := h.requireOwnedBot(w, r)
	if !ok {
		return
	}
	var req struct {
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Message) == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "mensagem obrigatória")
		return
	}
	if h.chatSvc == nil {
		httpx.WriteJSONError(w, http.StatusServiceUnavailable, "serviço de chat do bot não configurado")
		return
	}
	reply, err := h.chatSvc.SendMessage(r.Context(), userID, botID, strings.TrimSpace(req.Message))
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, reply)
}

// ResolvePending aprova ou nega uma confirmação pendente do bot (POST /api/v1/bots/{id}/pending/{confirmationId}/resolve).
func (h *BotHandler) ResolvePending(w http.ResponseWriter, r *http.Request) {
	userID, botID, _, ok := h.requireOwnedBot(w, r)
	if !ok {
		return
	}
	confID := chi.URLParam(r, "confirmationId")
	var req struct {
		Decision string `json:"decision"`
		Action   string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload inválido")
		return
	}
	decision := strings.TrimSpace(req.Decision)
	if decision == "" {
		decision = strings.TrimSpace(req.Action)
	}
	if decision != "allow_once" && decision != "always_allow" && decision != "deny" {
		httpx.WriteJSONError(w, http.StatusUnprocessableEntity, "decisão inválida: use allow_once, always_allow ou deny")
		return
	}
	if h.confGate == nil {
		httpx.WriteJSONError(w, http.StatusServiceUnavailable, "serviço de confirmação não configurado")
		return
	}
	pending, err := h.confGate.GetByID(r.Context(), confID, userID)
	if err != nil {
		if errors.Is(err, service.ErrUnauthorizedTenant) {
			httpx.WriteJSONError(w, http.StatusForbidden, err.Error())
			return
		}
		httpx.WriteJSONError(w, http.StatusNotFound, "confirmação pendente não encontrada")
		return
	}
	actionKey := resolveActionKey(pending.ToolsetName, pending.Operation)
	if decision == "always_allow" {
		if spec, exists := domain.ActionCatalog[actionKey]; (exists && spec.AlwaysAsk) || domain.IsAlwaysAskAction(actionKey) {
			httpx.RespondError(w, domain.ErrAlwaysAskPolicyViolation)
			return
		}
		if actionKey != "" {
			if err := h.botRepo.UpsertAction(r.Context(), &domain.BotAction{
				BotID: botID, UserID: userID, ActionKey: actionKey, Policy: domain.ActionPolicyAuto,
			}); err != nil {
				httpx.RespondError(w, err)
				return
			}
		}
	}
	if decision == "deny" {
		if err := h.confGate.CancelWithReason(r.Context(), confID, userID, "negado pelo usuário"); err != nil {
			httpx.WriteJSONError(w, http.StatusConflict, err.Error())
			return
		}
		if h.botRepo != nil {
			_ = h.botRepo.AddMemory(r.Context(), &domain.BotMemory{
				ID:        uuid.NewString(),
				BotID:     botID,
				UserID:    userID,
				Source:    "user_denied",
				IsActive:  true,
				Content:   fmt.Sprintf("Usuário recusou a ação '%s' (%s). Não repetir sem pedir permissão explícita.", actionKey, pending.Operation),
				CreatedAt: time.Now().UTC(),
				UpdatedAt: time.Now().UTC(),
			})
		}
		if h.convRepo != nil {
			_ = h.convRepo.CreateTurn(r.Context(), &repository.ConversationTurn{
				ID:        uuid.NewString(),
				ThreadID:  "bot_" + botID,
				UserID:    userID,
				Channel:   "bot_chat",
				Role:      "assistant",
				Content:   fmt.Sprintf("Entendido, não executei a ação (%s) e anotei sua preferência.", pending.Operation),
				CreatedAt: time.Now().UTC(),
			})
		}
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "denied", "decision": decision})
		return
	}
	resumed, err := h.confGate.Resume(r.Context(), confID, userID)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusConflict, err.Error())
		return
	}

	var execSummary string
	if h.registry != nil {
		ts, exists := h.registry.Get(domain.ToolsetName(resumed.ToolsetName))
		if !exists || ts == nil {
			_ = h.confGate.SaveExecutionResult(r.Context(), confID, `{"error":"toolset não encontrado"}`)
			httpx.WriteJSONError(w, http.StatusUnprocessableEntity, fmt.Sprintf("toolset '%s' não encontrado", resumed.ToolsetName))
			return
		}
		execCtx := &domain.ToolExecutionContext{
			UserID:                  userID,
			ThreadID:                resumed.ThreadID,
			Channel:                 resumed.Channel,
			BotID:                   botID,
			AutonomyLevel:           "confirmed",
			TaintedByUntrustedInput: resumed.TaintedContext,
		}
		res, execErr := ts.Execute(r.Context(), execCtx, resumed.Operation, json.RawMessage(resumed.ArgumentsJSON))
		if execErr != nil {
			_ = h.confGate.SaveExecutionResult(r.Context(), confID, fmt.Sprintf(`{"error":%q}`, execErr.Error()))
			httpx.WriteJSONError(w, http.StatusInternalServerError, fmt.Sprintf("falha ao executar ação aprovada: %v", execErr))
			return
		}
		if res != nil {
			execSummary = res.SummaryForLLM
		}
		resJSON, _ := json.Marshal(res)
		_ = h.confGate.SaveExecutionResult(r.Context(), confID, string(resJSON))
	}
	if h.convRepo != nil {
		msg := fmt.Sprintf("Ação aprovada (%s) executada com sucesso.", resumed.Operation)
		if execSummary != "" {
			msg = execSummary
		}
		_ = h.convRepo.CreateTurn(r.Context(), &repository.ConversationTurn{
			ID:        uuid.NewString(),
			ThreadID:  "bot_" + botID,
			UserID:    userID,
			Channel:   "bot_chat",
			Role:      "assistant",
			Content:   msg,
			CreatedAt: time.Now().UTC(),
		})
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"status":     "approved",
		"decision":   decision,
		"action_key": actionKey,
		"summary":    execSummary,
	})
}

// UpdateBotModelPref atualiza o modelo preferido do bot (PATCH /api/v1/bots/{id}/model).
func (h *BotHandler) UpdateBotModelPref(w http.ResponseWriter, r *http.Request) {
	userID, botID, bot, ok := h.requireOwnedBot(w, r)
	if !ok {
		return
	}
	var body domain.ModelPreferenceUpdate
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload JSON inválido")
		return
	}
	if h.aiProviderSvc != nil {
		if err := h.aiProviderSvc.UpdateTriggerModelPref(r.Context(), userID, botID, body.ModelPref, body.EffortPref); err != nil {
			httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
			return
		}
		bot, _ = h.botRepo.GetByID(r.Context(), botID, userID)
	} else {
		bot.ModelPref = strings.TrimSpace(body.ModelPref)
		bot.EffortPref = strings.TrimSpace(body.EffortPref)
		if err := h.botRepo.Update(r.Context(), bot); err != nil {
			httpx.RespondError(w, err)
			return
		}
	}
	h.respondWithBot(w, r, userID, bot, false)
}
