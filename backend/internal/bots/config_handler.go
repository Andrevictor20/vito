package bots

import (
	"context"
	"encoding/json"
	"github.com/andrevmp/vito/backend/internal/platform/httpx"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
)

// AddAction adiciona ou atualiza uma ação no bot (POST /api/v1/bots/{id}/actions).
func (h *BotHandler) AddAction(w http.ResponseWriter, r *http.Request) {
	userID, botID, bot, ok := h.requireOwnedBot(w, r)
	if !ok {
		return
	}
	var req struct {
		ActionKey string              `json:"action_key"`
		Policy    domain.ActionPolicy `json:"policy"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload inválido")
		return
	}
	if req.Policy == "" {
		if spec, exists := domain.ActionCatalog[req.ActionKey]; exists {
			req.Policy = spec.DefaultPolicy
		}
	}
	if err := h.botRepo.UpsertAction(r.Context(), &domain.BotAction{
		BotID:     botID,
		UserID:    userID,
		ActionKey: req.ActionKey,
		Policy:    req.Policy,
	}); err != nil {
		httpx.RespondError(w, err)
		return
	}
	var err error
	if bot.Actions, err = h.botRepo.ListActions(r.Context(), botID, userID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	h.respondWithBot(w, r, userID, bot, true)
}

// UpdateAction altera a política de uma ação do bot (PATCH /api/v1/bots/{id}/actions/{actionKey}).
func (h *BotHandler) UpdateAction(w http.ResponseWriter, r *http.Request) {
	userID, botID, bot, ok := h.requireOwnedBot(w, r)
	if !ok {
		return
	}
	actionKey := chi.URLParam(r, "actionKey")
	var req struct {
		Policy domain.ActionPolicy `json:"policy"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload inválido")
		return
	}
	if err := h.botRepo.UpdateActionPolicy(r.Context(), botID, userID, actionKey, req.Policy); err != nil {
		httpx.RespondError(w, err)
		return
	}
	var err error
	if bot.Actions, err = h.botRepo.ListActions(r.Context(), botID, userID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	h.respondWithBot(w, r, userID, bot, true)
}

// RemoveAction remove uma ação configurada do bot (DELETE /api/v1/bots/{id}/actions/{actionKey}).
func (h *BotHandler) RemoveAction(w http.ResponseWriter, r *http.Request) {
	userID, botID, bot, ok := h.requireOwnedBot(w, r)
	if !ok {
		return
	}
	actionKey := chi.URLParam(r, "actionKey")
	if err := h.botRepo.DeleteAction(r.Context(), botID, userID, actionKey); err != nil {
		httpx.RespondError(w, err)
		return
	}
	var err error
	if bot.Actions, err = h.botRepo.ListActions(r.Context(), botID, userID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	h.respondWithBot(w, r, userID, bot, true)
}

// AddSkill anexa um pacote de habilidade ao bot (POST /api/v1/bots/{id}/skills).
func (h *BotHandler) AddSkill(w http.ResponseWriter, r *http.Request) {
	userID, botID, bot, ok := h.requireOwnedBot(w, r)
	if !ok {
		return
	}
	var req struct {
		SkillKey string `json:"skill_key"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.SkillKey) == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "skill_key obrigatório")
		return
	}
	if h.catalog == nil {
		httpx.WriteJSONError(w, http.StatusServiceUnavailable, "catálogo não carregado")
		return
	}
	sk, exists := h.catalog.Skill(strings.TrimSpace(req.SkillKey))
	if !exists {
		httpx.RespondError(w, domain.ErrSkillNotFound)
		return
	}
	if err := h.botRepo.AttachSkill(r.Context(), botID, userID, sk); err != nil {
		httpx.RespondError(w, err)
		return
	}
	var err error
	if bot.Skills, err = h.botRepo.ListSkills(r.Context(), botID, userID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	if bot.Actions, err = h.botRepo.ListActions(r.Context(), botID, userID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	h.respondWithBot(w, r, userID, bot, true)
}

// RemoveSkill remove uma habilidade mantendo as ações do bot (DELETE /api/v1/bots/{id}/skills/{skillKey}).
func (h *BotHandler) RemoveSkill(w http.ResponseWriter, r *http.Request) {
	userID, botID, bot, ok := h.requireOwnedBot(w, r)
	if !ok {
		return
	}
	skillKey := chi.URLParam(r, "skillKey")
	if err := h.botRepo.RemoveSkill(r.Context(), botID, userID, skillKey); err != nil {
		httpx.RespondError(w, err)
		return
	}
	var err error
	if bot.Skills, err = h.botRepo.ListSkills(r.Context(), botID, userID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	h.respondWithBot(w, r, userID, bot, true)
}

// UpgradeSkill atualiza a versão da habilidade e concede as ações novas após confirmação (POST /api/v1/bots/{id}/skills/{skillKey}/upgrade).
func (h *BotHandler) UpgradeSkill(w http.ResponseWriter, r *http.Request) {
	userID, botID, bot, ok := h.requireOwnedBot(w, r)
	if !ok {
		return
	}
	skillKey := chi.URLParam(r, "skillKey")
	if h.catalog == nil {
		httpx.WriteJSONError(w, http.StatusServiceUnavailable, "catálogo não carregado")
		return
	}
	sk, exists := h.catalog.Skill(skillKey)
	if !exists {
		httpx.RespondError(w, domain.ErrSkillNotFound)
		return
	}
	if err := h.botRepo.UpgradeSkill(r.Context(), botID, userID, sk); err != nil {
		httpx.RespondError(w, err)
		return
	}
	var err error
	if bot.Skills, err = h.botRepo.ListSkills(r.Context(), botID, userID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	if bot.Actions, err = h.botRepo.ListActions(r.Context(), botID, userID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	h.respondWithBot(w, r, userID, bot, true)
}

// ListMemories lista as memórias isoladas do bot (GET /api/v1/bots/{id}/memories).
func (h *BotHandler) ListMemories(w http.ResponseWriter, r *http.Request) {
	userID, botID, _, ok := h.requireOwnedBot(w, r)
	if !ok {
		return
	}
	mems, err := h.botRepo.ListMemories(r.Context(), botID, userID)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao listar memórias do bot")
		return
	}
	if mems == nil {
		mems = []domain.BotMemory{}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"memories": mems})
}

// AddMemory adiciona uma memória isolada ao bot (POST /api/v1/bots/{id}/memories).
func (h *BotHandler) AddMemory(w http.ResponseWriter, r *http.Request) {
	userID, botID, _, ok := h.requireOwnedBot(w, r)
	if !ok {
		return
	}
	var req struct {
		Content string `json:"content"`
		Source  string `json:"source"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Content) == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "conteúdo da memória é obrigatório")
		return
	}
	mem := &domain.BotMemory{
		BotID:   botID,
		UserID:  userID,
		Content: strings.TrimSpace(req.Content),
		Source:  strings.TrimSpace(req.Source),
	}
	if err := h.botRepo.AddMemory(r.Context(), mem); err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, mem)
}

// DeleteMemory remove uma memória isolada do bot (DELETE /api/v1/bots/{id}/memories/{memId}).
func (h *BotHandler) DeleteMemory(w http.ResponseWriter, r *http.Request) {
	userID, botID, _, ok := h.requireOwnedBot(w, r)
	if !ok {
		return
	}
	memID := chi.URLParam(r, "memId")
	if err := h.botRepo.DeleteMemory(r.Context(), botID, userID, memID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// BotActivityItemDTO representa um evento na linha do tempo de atividade dos bots.
type BotActivityItemDTO struct {
	ID          string `json:"id"`
	BotID       string `json:"bot_id"`
	BotTitle    string `json:"bot_title"`
	BotIcon     string `json:"bot_icon,omitempty"`
	BotColor    string `json:"bot_color,omitempty"`
	TriggeredAt string `json:"triggered_at"`
	Message     string `json:"message"`
	Status      string `json:"status,omitempty"`
}

// GetActivity lista a atividade recente entre os bots do usuário (GET /api/v1/bots/activity?limit=20).
func (h *BotHandler) GetActivity(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	limit := 20
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}
	items := h.loadRecentActivity(r.Context(), userID, limit)
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"activity": items})
}

func (h *BotHandler) loadRecentActivity(ctx context.Context, userID string, limit int) []BotActivityItemDTO {
	if h.db == nil {
		return []BotActivityItemDTO{}
	}
	rows, err := h.db.QueryContext(ctx, `
		SELECT l.id, l.trigger_id, t.title, COALESCE(t.icon, 'radar'), COALESCE(t.color, 'orange'),
		       l.triggered_at, l.message, COALESCE(t.last_run_status, '')
		FROM trigger_logs l
		JOIN triggers t ON t.id = l.trigger_id
		WHERE t.user_id = ?
		ORDER BY l.triggered_at DESC
		LIMIT ?
	`, userID, limit)
	if err != nil {
		return []BotActivityItemDTO{}
	}
	defer rows.Close()
	out := make([]BotActivityItemDTO, 0)
	for rows.Next() {
		var item BotActivityItemDTO
		if err := rows.Scan(&item.ID, &item.BotID, &item.BotTitle, &item.BotIcon, &item.BotColor, &item.TriggeredAt, &item.Message, &item.Status); err == nil {
			out = append(out, item)
		}
	}
	return out
}
