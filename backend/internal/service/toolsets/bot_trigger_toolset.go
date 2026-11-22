package toolsets

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/google/uuid"
)

// TriggerServiceContract define o contrato mínimo para gerenciar bots/gatilhos proativos.
type TriggerServiceContract interface {
	ListTriggers(userID string) ([]*domain.Trigger, error)
	CreateTrigger(t *domain.Trigger) error
	DeleteTrigger(id, userID string) error
}

// BotTriggerToolset implementa o toolset do sub-agente vito_bots_architect (substitui RadarTriggerToolset).
type BotTriggerToolset struct {
	svc TriggerServiceContract
}

// RadarTriggerToolset é um alias de compatibilidade para wiring legado até a migração completa.
type RadarTriggerToolset = BotTriggerToolset

// NewBotTriggerToolset cria o toolset de gerenciamento de Bots para o vito_bots_architect.
func NewBotTriggerToolset(svc ...TriggerServiceContract) *BotTriggerToolset {
	if len(svc) > 0 && svc[0] != nil {
		return &BotTriggerToolset{svc: svc[0]}
	}
	return &BotTriggerToolset{}
}

// NewRadarTriggerToolset é um alias de compatibilidade para NewBotTriggerToolset.
func NewRadarTriggerToolset(svc ...TriggerServiceContract) *BotTriggerToolset {
	return NewBotTriggerToolset(svc...)
}

func (t *BotTriggerToolset) Name() domain.ToolsetName {
	return domain.ToolsetRadarTrigger
}

func (t *BotTriggerToolset) Description() string {
	return "Gerencia bots proativos e automações agendadas para acompanhar preços, notícias, e-mails, viagens e rotina."
}

func (t *BotTriggerToolset) JSONSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"operation": {
				"type": "string",
				"enum": ["list_bots", "create_bot", "delete_bot", "propose_bot", "list_triggers", "create_trigger", "delete_trigger"],
				"description": "Operação de gerenciamento de bot."
			},
			"params": {
				"type": "object",
				"properties": {
					"title": {"type": "string", "description": "Nome do bot."},
					"goal": {"type": "string", "description": "Função principal do bot."},
					"user_intent": {"type": "string", "description": "Objetivo do bot."},
					"bot_id": {"type": "string", "description": "ID do bot."},
					"trigger_id": {"type": "string", "description": "Alias legado para ID do bot."},
					"template_key": {"type": "string", "description": "Chave opcional de bot pronto do catálogo."},
					"suggested_skill": {"type": "string", "description": "Habilidade sugerida."},
					"actions": {"type": "array", "items": {"type": "string"}, "description": "Ações sugeridas."}
				}
			}
		},
		"required": ["operation"]
	}`)
}

func (t *BotTriggerToolset) IsWriteOperation(op string, rawParams json.RawMessage) (bool, bool, map[string]any) {
	preview := make(map[string]any)
	_ = json.Unmarshal(rawParams, &preview)
	switch op {
	case "create_bot", "create_trigger":
		return true, false, preview
	case "delete_bot", "delete_trigger":
		return true, true, preview
	default:
		return false, false, preview
	}
}

func (t *BotTriggerToolset) Execute(ctx context.Context, execCtx *domain.ToolExecutionContext, op string, rawParams json.RawMessage) (*domain.ToolExecutionResult, error) {
	var params struct {
		Title          string   `json:"title"`
		Goal           string   `json:"goal"`
		UserIntent     string   `json:"user_intent"`
		BotID          string   `json:"bot_id"`
		TriggerID      string   `json:"trigger_id"`
		TemplateKey    string   `json:"template_key"`
		SuggestedSkill string   `json:"suggested_skill"`
		Actions        []string `json:"actions"`
	}
	if len(rawParams) > 0 {
		_ = json.Unmarshal(rawParams, &params)
	}

	if op == "propose_bot" {
		title := strings.TrimSpace(params.Title)
		if title == "" {
			title = "Novo Bot"
		}
		goal := strings.TrimSpace(params.Goal)
		if goal == "" {
			goal = strings.TrimSpace(params.UserIntent)
		}
		subtitle := goal
		if params.SuggestedSkill != "" {
			subtitle = fmt.Sprintf("%s · Habilidade sugerida: %s", goal, params.SuggestedSkill)
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: fmt.Sprintf("Proposta de bot '%s' preparada para confirmação do usuário.", title),
			Data: map[string]any{
				"title":           title,
				"goal":            goal,
				"template_key":    params.TemplateKey,
				"suggested_skill": params.SuggestedSkill,
				"actions":         params.Actions,
			},
			Cards: []domain.ChatCard{{
				ID:          uuid.New().String(),
				Type:        "bot_proposal",
				Title:       title,
				Subtitle:    subtitle,
				ActionLabel: "Criar",
				ActionValue: params.TemplateKey,
				Confirm:     true,
				Dismiss:     true,
			}},
		}, nil
	}

	if t.svc == nil {
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: "Serviço de bots não configurado.",
		}, nil
	}

	targetID := strings.TrimSpace(params.BotID)
	if targetID == "" {
		targetID = strings.TrimSpace(params.TriggerID)
	}

	switch op {
	case "create_bot", "create_trigger":
		intent := strings.TrimSpace(params.Goal)
		if intent == "" {
			intent = strings.TrimSpace(params.UserIntent)
		}
		tr := &domain.Trigger{
			ID:         uuid.New().String(),
			UserID:     execCtx.UserID,
			Title:      strings.TrimSpace(params.Title),
			UserIntent: intent,
			Status:     domain.TriggerStatusActive,
			Frequency:  domain.FrequencyDailyMorning,
		}
		if tr.Title == "" {
			tr.Title = "Novo Bot"
		}
		if err := t.svc.CreateTrigger(tr); err != nil {
			return nil, err
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: fmt.Sprintf("Bot '%s' criado com sucesso.", tr.Title),
			Cards: []domain.ChatCard{{
				ID:          tr.ID,
				Type:        "bot",
				Title:       tr.Title,
				Subtitle:    "Bot ativo",
				ActionLabel: "Ver Bot",
			}},
		}, nil

	case "delete_bot", "delete_trigger":
		if err := t.svc.DeleteTrigger(targetID, execCtx.UserID); err != nil {
			return nil, err
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: fmt.Sprintf("Bot %s removido com sucesso.", targetID),
		}, nil

	default: // "list_bots", "list_triggers"
		list, err := t.svc.ListTriggers(execCtx.UserID)
		if err != nil {
			return nil, err
		}
		if len(list) == 0 {
			return &domain.ToolExecutionResult{
				Status:        "COMPLETED",
				SummaryForLLM: "O usuário não possui nenhum bot ativo no momento.",
			}, nil
		}
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("O usuário possui %d bots ativos:\n", len(list)))
		var cards []domain.ChatCard
		for _, tr := range list {
			sb.WriteString(fmt.Sprintf("- [ID: %s] %s (Status: %s)\n", tr.ID, tr.Title, tr.Status))
			cards = append(cards, domain.ChatCard{
				ID:          tr.ID,
				Type:        "bot",
				Title:       tr.Title,
				Subtitle:    string(tr.Status),
				ActionLabel: "Ver Bot",
			})
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: sb.String(),
			Cards:         cards,
		}, nil
	}
}
