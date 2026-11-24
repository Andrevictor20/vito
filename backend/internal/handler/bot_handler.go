package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/catalog"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

// BotHandler expõe os endpoints REST /api/v1/bots (§7 do Plano 04).
type BotHandler struct {
	db            *sql.DB
	botRepo       *repository.BotRepositorySQLite
	catalog       *catalog.Catalog
	runner        BotRunnerExecutor
	chatSvc       BotChatServicer
	confGate      *service.ConfirmationGateService
	aiProviderSvc *service.AIProviderService
	appChecker    AppConnectionChecker
	extraSpecs    []BotAppSpec
	registry      *toolsets.ToolsetsRegistry
	convRepo      *repository.ConversationStoreRepository
}

// NewBotHandler instancia o handler REST de bots.
func NewBotHandler(
	db *sql.DB,
	botRepo *repository.BotRepositorySQLite,
	cat *catalog.Catalog,
) *BotHandler {
	return &BotHandler{
		db:         db,
		botRepo:    botRepo,
		catalog:    cat,
		appChecker: &dbAppConnectionChecker{db: db},
	}
}

func (h *BotHandler) SetBotRunner(r BotRunnerExecutor)               { h.runner = r }
func (h *BotHandler) SetBotChatService(c BotChatServicer)            { h.chatSvc = c }
func (h *BotHandler) SetConfirmationGate(g *service.ConfirmationGateService) { h.confGate = g }
func (h *BotHandler) SetAIProviderService(s *service.AIProviderService) { h.aiProviderSvc = s }
func (h *BotHandler) SetAppConnectionChecker(c AppConnectionChecker) { h.appChecker = c }
func (h *BotHandler) SetExtraAppSpecs(specs []BotAppSpec)                          { h.extraSpecs = specs }
func (h *BotHandler) SetToolsetRegistry(reg *toolsets.ToolsetsRegistry)            { h.registry = reg }
func (h *BotHandler) SetConversationStore(repo *repository.ConversationStoreRepository) { h.convRepo = repo }

// ListBots lista os bots do usuário enriquecidos com pendências, apps, ações e contadores (GET /api/v1/bots).
func (h *BotHandler) ListBots(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	bots, err := h.botRepo.ListByUser(r.Context(), userID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "falha ao listar bots")
		return
	}
	connMap := h.userAppConnections(r.Context(), userID)
	out := make([]BotResponse, 0, len(bots))
	totalPending := 0
	for i := range bots {
		enriched := h.buildBotResponse(r.Context(), userID, &bots[i], connMap, false)
		totalPending += len(enriched.Pending)
		out = append(out, enriched)
	}
	catalogCount := 0
	if h.catalog != nil {
		catalogCount = len(h.catalog.Templates)
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"bots": out,
		"counts": map[string]int{
			"my":      len(out),
			"catalog": catalogCount,
			"pending": totalPending,
		},
	})
}

type createBotRequest struct {
	TemplateKey       string   `json:"template_key"`
	Title             string   `json:"title"`
	Goal              string   `json:"goal"`
	Category          string   `json:"category"`
	Icon              string   `json:"icon"`
	Color             string   `json:"color"`
	SkinJSON          string   `json:"skin_json"`
	Skin              any      `json:"skin"`
	Frequency         string   `json:"frequency"`
	ScheduledTime     string   `json:"scheduled_time"`
	DaysOfWeek        string   `json:"days_of_week"`
	QuietOnlyOnChange *bool    `json:"quiet_only_on_change"`
	Rules             []string `json:"rules"`
	Skills            []string `json:"skills"`
	Actions           []struct {
		ActionKey string              `json:"action_key"`
		Policy    domain.ActionPolicy `json:"policy"`
	} `json:"actions"`
}

// CreateBot cria um bot a partir de um template do catálogo ou payload customizado (POST /api/v1/bots).
func (h *BotHandler) CreateBot(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	var req createBotRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "payload inválido")
		return
	}
	bot := &domain.Bot{
		UserID:            userID,
		Title:             strings.TrimSpace(req.Title),
		Goal:              strings.TrimSpace(req.Goal),
		Category:          strings.TrimSpace(req.Category),
		Icon:              strings.TrimSpace(req.Icon),
		Color:             strings.TrimSpace(req.Color),
		SkinJSON:          strings.TrimSpace(req.SkinJSON),
		TemplateKey:       strings.TrimSpace(req.TemplateKey),
		Frequency:         domain.TriggerFrequency(strings.TrimSpace(req.Frequency)),
		ScheduledTime:     strings.TrimSpace(req.ScheduledTime),
		DaysOfWeek:        strings.TrimSpace(req.DaysOfWeek),
		QuietOnlyOnChange: true,
		Rules:             req.Rules,
		Status:            domain.TriggerStatusActive,
	}
	if req.QuietOnlyOnChange != nil {
		bot.QuietOnlyOnChange = *req.QuietOnlyOnChange
	}
	if bot.SkinJSON == "" && req.Skin != nil {
		if raw, err := json.Marshal(req.Skin); err == nil {
			bot.SkinJSON = string(raw)
		}
	}

	if bot.TemplateKey != "" && h.catalog != nil {
		tpl, found := h.catalog.Template(bot.TemplateKey)
		if !found {
			writeJSONError(w, http.StatusNotFound, "template não encontrado no catálogo")
			return
		}
		h.applyTemplateToBot(bot, tpl)
	}
	if bot.Title == "" {
		writeJSONError(w, http.StatusUnprocessableEntity, "título do bot é obrigatório")
		return
	}
	if bot.Goal == "" {
		bot.Goal = bot.Title
	}
	if len(req.Skills) > 0 && h.catalog != nil {
		for _, skKey := range req.Skills {
			if sk, exists := h.catalog.Skill(skKey); exists {
				bot.Skills = append(bot.Skills, domain.BotSkill{SkillKey: sk.Key, Version: sk.Version})
				for _, actKey := range sk.Actions {
					if spec, ok := domain.ActionCatalog[actKey]; ok {
						bot.Actions = append(bot.Actions, domain.BotAction{ActionKey: actKey, Policy: spec.DefaultPolicy})
					}
				}
			}
		}
	}
	if len(req.Actions) > 0 {
		for _, a := range req.Actions {
			pol := a.Policy
			if pol == "" {
				if spec, ok := domain.ActionCatalog[a.ActionKey]; ok {
					pol = spec.DefaultPolicy
				} else {
					pol = domain.ActionPolicyAsk
				}
			}
			if err := domain.ValidateActionPolicy(a.ActionKey, pol); err != nil {
				respondError(w, err)
				return
			}
			bot.Actions = upsertActionSlice(bot.Actions, a.ActionKey, pol)
		}
	}
	if len(bot.Actions) == 0 {
		bot.Actions = []domain.BotAction{{ActionKey: "notify", Policy: domain.ActionPolicyAuto}}
	}
	if err := h.botRepo.Create(r.Context(), bot); err != nil {
		respondError(w, err)
		return
	}
	created, err := h.botRepo.GetByID(r.Context(), bot.ID, userID)
	if err != nil {
		respondError(w, err)
		return
	}
	connMap := h.userAppConnections(r.Context(), userID)
	writeJSON(w, http.StatusCreated, h.buildBotResponse(r.Context(), userID, created, connMap, true))
}

func (h *BotHandler) applyTemplateToBot(bot *domain.Bot, tpl catalog.BotTemplate) {
	if bot.Title == "" {
		bot.Title = tpl.Name
	}
	if bot.Goal == "" {
		bot.Goal = tpl.Goal
	}
	if bot.Category == "" {
		bot.Category = tpl.Category
	}
	if bot.Icon == "" {
		bot.Icon = tpl.Icon
	}
	if bot.Color == "" {
		bot.Color = tpl.Color
	}
	if len(bot.Rules) == 0 && len(tpl.DefaultRules) > 0 {
		bot.Rules = append([]string{}, tpl.DefaultRules...)
	}
	for _, skKey := range tpl.Skills {
		ver := 1
		if sk, ok := h.catalog.Skill(skKey); ok && sk.Version > 0 {
			ver = sk.Version
		}
		bot.Skills = append(bot.Skills, domain.BotSkill{SkillKey: skKey, Version: ver})
	}
	if actionsMap, err := h.catalog.ActionsForTemplate(tpl.Key); err == nil {
		for actKey, pol := range actionsMap {
			bot.Actions = upsertActionSlice(bot.Actions, actKey, pol)
		}
	}
}

func upsertActionSlice(list []domain.BotAction, key string, pol domain.ActionPolicy) []domain.BotAction {
	for i := range list {
		if list[i].ActionKey == key {
			list[i].Policy = pol
			return list
		}
	}
	return append(list, domain.BotAction{ActionKey: key, Policy: pol})
}

// GetBot retorna detalhes completos de um bot (GET /api/v1/bots/{id}).
func (h *BotHandler) GetBot(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	botID := chi.URLParam(r, "id")
	bot, err := h.botRepo.GetByID(r.Context(), botID, userID)
	if err != nil {
		respondError(w, err)
		return
	}
	connMap := h.userAppConnections(r.Context(), userID)
	writeJSON(w, http.StatusOK, h.buildBotResponse(r.Context(), userID, bot, connMap, true))
}

type updateBotRequest struct {
	Title             *string  `json:"title"`
	Goal              *string  `json:"goal"`
	Status            *string  `json:"status"`
	Category          *string  `json:"category"`
	Icon              *string  `json:"icon"`
	Color             *string  `json:"color"`
	SkinJSON          *string  `json:"skin_json"`
	Skin              any      `json:"skin"`
	Frequency         *string  `json:"frequency"`
	ScheduledTime     *string  `json:"scheduled_time"`
	DaysOfWeek        *string  `json:"days_of_week"`
	QuietOnlyOnChange *bool    `json:"quiet_only_on_change"`
	Rules             []string `json:"rules"`
}

// UpdateBot atualiza campos editáveis de um bot (PATCH /api/v1/bots/{id}).
func (h *BotHandler) UpdateBot(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	botID := chi.URLParam(r, "id")
	bot, err := h.botRepo.GetByID(r.Context(), botID, userID)
	if err != nil {
		respondError(w, err)
		return
	}
	var req updateBotRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "payload inválido")
		return
	}
	if req.Title != nil && strings.TrimSpace(*req.Title) != "" {
		bot.Title = strings.TrimSpace(*req.Title)
	}
	if req.Goal != nil {
		bot.Goal = strings.TrimSpace(*req.Goal)
	}
	if req.Status != nil {
		bot.Status = domain.TriggerStatus(strings.TrimSpace(*req.Status))
		if bot.Status == domain.TriggerStatusActive {
			bot.ConsecutiveFailures = 0
		}
	}
	if req.Category != nil {
		bot.Category = strings.TrimSpace(*req.Category)
	}
	if req.Icon != nil {
		bot.Icon = strings.TrimSpace(*req.Icon)
	}
	if req.Color != nil {
		bot.Color = strings.TrimSpace(*req.Color)
	}
	if req.SkinJSON != nil {
		bot.SkinJSON = strings.TrimSpace(*req.SkinJSON)
	} else if req.Skin != nil {
		if raw, err := json.Marshal(req.Skin); err == nil {
			bot.SkinJSON = string(raw)
		}
	}
	if req.Frequency != nil {
		bot.Frequency = domain.TriggerFrequency(strings.TrimSpace(*req.Frequency))
	}
	if req.ScheduledTime != nil {
		bot.ScheduledTime = strings.TrimSpace(*req.ScheduledTime)
	}
	if req.DaysOfWeek != nil {
		bot.DaysOfWeek = strings.TrimSpace(*req.DaysOfWeek)
	}
	if req.QuietOnlyOnChange != nil {
		bot.QuietOnlyOnChange = *req.QuietOnlyOnChange
	}
	if req.Rules != nil {
		bot.Rules = req.Rules
	}
	if err := h.botRepo.Update(r.Context(), bot); err != nil {
		respondError(w, err)
		return
	}
	connMap := h.userAppConnections(r.Context(), userID)
	writeJSON(w, http.StatusOK, h.buildBotResponse(r.Context(), userID, bot, connMap, true))
}

// DeleteBot exclui um bot do usuário (DELETE /api/v1/bots/{id}).
func (h *BotHandler) DeleteBot(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	if err := h.botRepo.Delete(r.Context(), chi.URLParam(r, "id"), userID); err != nil {
		respondError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
