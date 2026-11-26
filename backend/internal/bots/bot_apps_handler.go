package bots

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/repository"
)

// BotAppSpec descreve um app integrável no catálogo de bots (§3 e Fase 5).
type BotAppSpec struct {
	AppKey      string `json:"app_key"`
	Name        string `json:"name"`
	Category    string `json:"category"`
	Description string `json:"description"`
	AlwaysLocal bool   `json:"always_local,omitempty"`
}

// BotAppActionDTO descreve uma ação disponível em um app integrável.
type BotAppActionDTO struct {
	ActionKey     string              `json:"action_key"`
	Label         string              `json:"label"`
	IsWrite       bool                `json:"is_write"`
	AlwaysAsk     bool                `json:"always_ask"`
	DefaultPolicy domain.ActionPolicy `json:"default_policy,omitempty"`
}

// BotAppStatusDTO representa o status de conexão de um app para o usuário atual.
type BotAppStatusDTO struct {
	AppKey      string            `json:"app_key"`
	Name        string            `json:"name"`
	Category    string            `json:"category,omitempty"`
	Description string            `json:"description,omitempty"`
	Connected   bool              `json:"connected"`
	Actions     []BotAppActionDTO `json:"actions,omitempty"`
}

// AppConnectionChecker verifica quais apps externos estão conectados para o usuário.
type AppConnectionChecker interface {
	ConnectedApps(ctx context.Context, userID string) map[string]bool
}

var defaultAppSpecs = []BotAppSpec{
	{AppKey: "vito", Name: "Vito", Category: "interno", Description: "Tarefas e notificações", AlwaysLocal: true},
	{AppKey: "web", Name: "Pesquisa Web", Category: "pesquisa", Description: "Busca e leitura de páginas", AlwaysLocal: true},
	{AppKey: "fin", Name: "Finanças", Category: "finanças", Description: "Gastos, contas e orçamentos", AlwaysLocal: true},
	{AppKey: "gcal", Name: "Google Agenda", Category: "agenda", Description: "Eventos e horários livres"},
	{AppKey: "gmail", Name: "Gmail", Category: "e-mail", Description: "Leitura e rascunhos de e-mail"},
	{AppKey: "wa", Name: "WhatsApp", Category: "mensagens", Description: "Leitura e envio com aprovação"},
	{AppKey: "outlook", Name: "Outlook", Category: "e-mail", Description: "E-mails e agenda Microsoft"},
	{AppKey: "maps", Name: "Google Maps", Category: "rotas", Description: "Rotas e hora de sair"},
	{AppKey: "trello", Name: "Trello", Category: "projetos", Description: "Cartões e quadros"},
}

type dbAppConnectionChecker struct {
	db *sql.DB
}

func (c *dbAppConnectionChecker) ConnectedApps(ctx context.Context, userID string) map[string]bool {
	res := map[string]bool{
		"vito": true,
		"web":  true,
		"fin":  true,
	}
	if strings.TrimSpace(os.Getenv("GOOGLE_MAPS_API_KEY")) != "" {
		res["maps"] = true
	}
	if c.db == nil || userID == "" {
		return res
	}
	var count int
	if err := c.db.QueryRowContext(ctx, `SELECT COUNT(1) FROM calendar_integrations WHERE user_id = ? AND status = 'active' AND provider = 'google'`, userID).Scan(&count); err == nil && count > 0 {
		res["gcal"] = true
	}
	count = 0
	if err := c.db.QueryRowContext(ctx, `SELECT COUNT(1) FROM gmail_integrations WHERE user_id = ? AND status = 'active'`, userID).Scan(&count); err == nil && count > 0 {
		res["gmail"] = true
	}
	count = 0
	if err := c.db.QueryRowContext(ctx, `SELECT COUNT(1) FROM whatsapp_integrations WHERE user_id = ? AND status = 'connected'`, userID).Scan(&count); err == nil && count > 0 {
		res["wa"] = true
	}
	count = 0
	if err := c.db.QueryRowContext(ctx, `SELECT COUNT(1) FROM calendar_integrations WHERE user_id = ? AND status = 'active' AND provider = 'outlook'`, userID).Scan(&count); err == nil && count > 0 {
		res["outlook"] = true
	}
	return res
}

// ListCatalogTemplates lista os bots prontos do catálogo (GET /api/v1/bots/catalog/templates).
func (h *BotHandler) ListCatalogTemplates(w http.ResponseWriter, r *http.Request) {
	if h.catalog == nil {
		writeJSON(w, http.StatusOK, map[string]any{"templates": []any{}})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"templates": h.catalog.Templates})
}

// ListCatalogSkills lista os pacotes de habilidades do catálogo (GET /api/v1/bots/catalog/skills).
func (h *BotHandler) ListCatalogSkills(w http.ResponseWriter, r *http.Request) {
	if h.catalog == nil {
		writeJSON(w, http.StatusOK, map[string]any{"skills": []any{}})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"skills": h.catalog.Skills})
}

// ListApps retorna os apps disponíveis e seu status de conexão para o usuário (GET /api/v1/bots/apps).
func (h *BotHandler) ListApps(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	connMap := h.userAppConnections(r.Context(), userID)
	specs := append([]BotAppSpec{}, defaultAppSpecs...)
	specs = append(specs, h.extraSpecs...)

	apps := make([]BotAppStatusDTO, 0, len(specs))
	for _, s := range specs {
		apps = append(apps, BotAppStatusDTO{
			AppKey:      s.AppKey,
			Name:        s.Name,
			Category:    s.Category,
			Description: s.Description,
			Connected:   s.AlwaysLocal || connMap[s.AppKey],
			Actions:     actionsForAppKey(s.AppKey),
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"apps": apps})
}

func actionsForAppKey(appKey string) []BotAppActionDTO {
	out := make([]BotAppActionDTO, 0)
	for _, spec := range domain.ActionCatalog {
		if spec.AppKey != appKey {
			continue
		}
		out = append(out, BotAppActionDTO{
			ActionKey:     spec.ActionKey,
			Label:         spec.Label,
			IsWrite:       spec.IsWrite,
			AlwaysAsk:     spec.AlwaysAsk || domain.IsAlwaysAskAction(spec.ActionKey),
			DefaultPolicy: spec.DefaultPolicy,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].ActionKey < out[j].ActionKey
	})
	return out
}

// SuggestApp registra uma sugestão de novo app integrável (POST /api/v1/bots/apps/suggest).
func (h *BotHandler) SuggestApp(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	var req struct {
		Name   string `json:"name"`
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		writeJSONError(w, http.StatusBadRequest, "nome do app é obrigatório")
		return
	}
	id := uuid.NewString()
	if h.db != nil {
		_ = repository.ExecuteQueuedWrite(r.Context(), func() error {
			_, err := h.db.ExecContext(r.Context(), `
				INSERT OR IGNORE INTO proactive_events (id, user_id, event_type, payload_json, created_at)
				VALUES (?, ?, 'bot_app_suggestion', ?, ?)
			`, id, userID, mustJSONString(map[string]string{
				"name":   strings.TrimSpace(req.Name),
				"reason": strings.TrimSpace(req.Reason),
			}), time.Now().UTC())
			return err
		})
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"ok":     true,
		"id":     id,
		"name":   strings.TrimSpace(req.Name),
		"reason": strings.TrimSpace(req.Reason),
	})
}

func mustJSONString(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func (h *BotHandler) userAppConnections(ctx context.Context, userID string) map[string]bool {
	if h.appChecker == nil {
		return map[string]bool{"vito": true, "web": true, "fin": true}
	}
	return h.appChecker.ConnectedApps(ctx, userID)
}

func (h *BotHandler) buildBotResponse(ctx context.Context, userID string, b *domain.Bot, connMap map[string]bool, includeDetails bool) BotResponse {
	resp := BotResponse{
		ID:                  b.ID,
		UserID:              b.UserID,
		Title:               b.Title,
		Goal:                b.Goal,
		Rules:               b.Rules,
		Category:            b.Category,
		Icon:                b.Icon,
		Color:               b.Color,
		SkinJSON:            b.SkinJSON,
		TemplateKey:         b.TemplateKey,
		Status:              b.Status,
		Frequency:           b.Frequency,
		ScheduledTime:       b.ScheduledTime,
		DaysOfWeek:          b.DaysOfWeek,
		QuietOnlyOnChange:   b.QuietOnlyOnChange,
		ThreadID:            b.ThreadID,
		ConsecutiveFailures: b.ConsecutiveFailures,
		ModelPref:           b.ModelPref,
		EffortPref:          b.EffortPref,
		LastRunStatus:       b.LastRunStatus,
		LastError:           b.LastError,
		LastCheckedAt:       b.LastCheckedAt,
		NextCheckAt:         b.NextCheckAt,
		CreatedAt:           b.CreatedAt,
		UpdatedAt:           b.UpdatedAt,
		Actions:             make([]BotActionDTO, 0, len(b.Actions)),
		Skills:              make([]BotSkillDTO, 0, len(b.Skills)),
		Pending:             h.loadPendingForBot(ctx, userID, b.ThreadID),
		Apps:                make([]BotAppStatusDTO, 0),
	}
	if resp.Rules == nil {
		resp.Rules = []string{}
	}

	appSeen := make(map[string]bool)
	for _, a := range b.Actions {
		spec := domain.ActionCatalog[a.ActionKey]
		connected := spec.AppKey == "" || spec.AppKey == "vito" || spec.AppKey == "web" || spec.AppKey == "fin" || connMap[spec.AppKey]
		resp.Actions = append(resp.Actions, BotActionDTO{
			ID:           a.ID,
			BotID:        a.BotID,
			ActionKey:    a.ActionKey,
			AppKey:       spec.AppKey,
			Label:        spec.Label,
			IsWrite:      spec.IsWrite,
			AlwaysAsk:    spec.AlwaysAsk || domain.IsAlwaysAskAction(a.ActionKey),
			Policy:       a.Policy,
			AppConnected: connected,
			ConfigJSON:   a.ConfigJSON,
		})
		resp.ActionsSummary.Total++
		if !connected {
			resp.ActionsSummary.Locked++
		} else if a.Policy == domain.ActionPolicyAuto {
			resp.ActionsSummary.Auto++
		} else if a.Policy == domain.ActionPolicyAsk {
			resp.ActionsSummary.Ask++
		}
		if spec.AppKey != "" && !appSeen[spec.AppKey] {
			appSeen[spec.AppKey] = true
			resp.Apps = append(resp.Apps, BotAppStatusDTO{
				AppKey:    spec.AppKey,
				Name:      appDisplayName(spec.AppKey),
				Connected: connected,
			})
		}
	}

	for _, sk := range b.Skills {
		dto := BotSkillDTO{
			ID:       sk.ID,
			BotID:    sk.BotID,
			SkillKey: sk.SkillKey,
			Name:     sk.SkillKey,
			Version:  sk.Version,
		}
		if h.catalog != nil {
			if manifest, ok := h.catalog.Skill(sk.SkillKey); ok {
				dto.Name = manifest.Name
				dto.Icon = manifest.Icon
				dto.Description = manifest.Description
				dto.When = manifest.When
				dto.Steps = manifest.Steps
				dto.Actions = manifest.Actions
				dto.LatestVersion = manifest.Version
				if manifest.Version > sk.Version {
					dto.HasUpgrade = true
					dto.UpgradeNewActions, _ = h.botRepo.PendingSkillUpgradeActions(ctx, b.ID, userID, manifest)
				}
			}
		}
		resp.Skills = append(resp.Skills, dto)
	}

	logs := h.loadLogsForBot(ctx, b.ID, 10)
	if len(logs) > 0 {
		resp.Last = &BotLastRunDTO{
			Summary: logs[0].Message,
			At:      logs[0].TriggeredAt,
			Status:  b.LastRunStatus,
		}
	}
	if includeDetails {
		resp.Memories = b.Memories
		if resp.Memories == nil {
			resp.Memories = []domain.BotMemory{}
		}
		resp.Logs = logs
	}
	return resp
}

func appDisplayName(appKey string) string {
	for _, s := range defaultAppSpecs {
		if s.AppKey == appKey {
			return s.Name
		}
	}
	return appKey
}

func resolveActionKey(toolsetName, operation string) string {
	for k, spec := range domain.ActionCatalog {
		if spec.Toolset != toolsetName {
			continue
		}
		for _, op := range spec.Operations {
			if op == operation {
				return k
			}
		}
	}
	return ""
}

func (h *BotHandler) loadPendingForBot(ctx context.Context, userID, threadID string) []BotPendingConfirmationDTO {
	if h.db == nil || threadID == "" {
		return []BotPendingConfirmationDTO{}
	}
	rows, err := h.db.QueryContext(ctx, `
		SELECT id, toolset_name, operation, COALESCE(preview_json, '{}'), created_at
		FROM pending_confirmations
		WHERE user_id = ? AND thread_id = ? AND status = 'SUSPENDED'
		ORDER BY created_at DESC
	`, userID, threadID)
	if err != nil {
		return []BotPendingConfirmationDTO{}
	}
	defer rows.Close()
	out := make([]BotPendingConfirmationDTO, 0)
	for rows.Next() {
		var id, toolset, op, previewJSON, createdAt string
		if err := rows.Scan(&id, &toolset, &op, &previewJSON, &createdAt); err != nil {
			continue
		}
		actionKey := resolveActionKey(toolset, op)
		spec := domain.ActionCatalog[actionKey]
		label := spec.Label
		if label == "" {
			label = op
		}
		summary := label
		var preview map[string]any
		if json.Unmarshal([]byte(previewJSON), &preview) == nil {
			if s, ok := preview["summary"].(string); ok && s != "" {
				summary = s
			}
		}
		out = append(out, BotPendingConfirmationDTO{
			ConfirmationID: id,
			ActionKey:      actionKey,
			AppKey:         spec.AppKey,
			Label:          label,
			Summary:        summary,
			AlwaysAsk:      spec.AlwaysAsk || domain.IsAlwaysAskAction(actionKey),
			CreatedAt:      createdAt,
		})
	}
	return out
}

func (h *BotHandler) loadLogsForBot(ctx context.Context, botID string, limit int) []BotRunLogDTO {
	if h.db == nil {
		return []BotRunLogDTO{}
	}
	rows, err := h.db.QueryContext(ctx, `
		SELECT id, trigger_id, triggered_at, message, COALESCE(payload, '')
		FROM trigger_logs
		WHERE trigger_id = ?
		ORDER BY triggered_at DESC
		LIMIT ?
	`, botID, limit)
	if err != nil {
		return []BotRunLogDTO{}
	}
	defer rows.Close()
	out := make([]BotRunLogDTO, 0)
	for rows.Next() {
		var l BotRunLogDTO
		if err := rows.Scan(&l.ID, &l.BotID, &l.TriggeredAt, &l.Message, &l.Payload); err == nil {
			if l.Payload != "" {
				var rep domain.BotRunReport
				if json.Unmarshal([]byte(l.Payload), &rep) == nil && (rep.Summary != "" || len(rep.Verified) > 0 || len(rep.Did) > 0 || len(rep.Waiting) > 0 || len(rep.Cant) > 0) {
					l.Report = &rep
					l.ModelUsed = rep.ModelUsed
				}
			}
			out = append(out, l)
		}
	}
	return out
}
