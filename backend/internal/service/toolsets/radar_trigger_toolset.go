package toolsets

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/google/uuid"
)

type TriggerServiceContract interface {
	ListTriggers(userID string) ([]*domain.Trigger, error)
	CreateTrigger(t *domain.Trigger) error
	DeleteTrigger(id, userID string) error
}

type RadarTriggerToolset struct {
	svc TriggerServiceContract
}

func NewRadarTriggerToolset(svc ...TriggerServiceContract) *RadarTriggerToolset {
	if len(svc) > 0 && svc[0] != nil {
		return &RadarTriggerToolset{svc: svc[0]}
	}
	return &RadarTriggerToolset{}
}

func (t *RadarTriggerToolset) Name() domain.ToolsetName {
	return domain.ToolsetRadarTrigger
}

func (t *RadarTriggerToolset) Description() string {
	return "Gerencia radares proativos e vigílias automáticas de preços, notícias, vagas e compras."
}

func (t *RadarTriggerToolset) JSONSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"operation": {
				"type": "string",
				"enum": ["list_triggers", "create_trigger", "delete_trigger"],
				"description": "Operação de radar/vigília."
			},
			"params": {
				"type": "object",
				"properties": {
					"title": {"type": "string", "description": "Nome da vigília."},
					"user_intent": {"type": "string", "description": "Objetivo do radar."},
					"trigger_id": {"type": "string", "description": "ID da vigília."}
				}
			}
		},
		"required": ["operation"]
	}`)
}

func (t *RadarTriggerToolset) IsWriteOperation(op string, rawParams json.RawMessage) (bool, bool, map[string]any) {
	preview := make(map[string]any)
	_ = json.Unmarshal(rawParams, &preview)
	if op == "create_trigger" {
		return true, false, preview
	}
	if op == "delete_trigger" {
		return true, true, preview
	}
	return false, false, preview
}

func (t *RadarTriggerToolset) Execute(ctx context.Context, execCtx *domain.ToolExecutionContext, op string, rawParams json.RawMessage) (*domain.ToolExecutionResult, error) {
	if t.svc == nil {
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: "Serviço de vigílias e radares não configurado.",
		}, nil
	}

	var params struct {
		Title      string `json:"title"`
		UserIntent string `json:"user_intent"`
		TriggerID  string `json:"trigger_id"`
	}
	if len(rawParams) > 0 {
		_ = json.Unmarshal(rawParams, &params)
	}

	switch op {
	case "create_trigger":
		tr := &domain.Trigger{
			ID:         uuid.New().String(),
			UserID:     execCtx.UserID,
			Title:      params.Title,
			UserIntent: params.UserIntent,
			Status:     domain.TriggerStatusActive,
			Frequency:  domain.FrequencyDailyMorning,
		}
		if tr.Title == "" {
			tr.Title = "Novo Radar"
		}
		if err := t.svc.CreateTrigger(tr); err != nil {
			return nil, err
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: fmt.Sprintf("Radar '%s' criado com sucesso.", tr.Title),
			Cards: []domain.ChatCard{{
				ID:          tr.ID,
				Type:        "trigger",
				Title:       tr.Title,
				Subtitle:    "Radar ativo",
				ActionLabel: "Ver Radar",
			}},
		}, nil

	case "delete_trigger":
		if err := t.svc.DeleteTrigger(params.TriggerID, execCtx.UserID); err != nil {
			return nil, err
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: fmt.Sprintf("Radar %s removido com sucesso.", params.TriggerID),
		}, nil

	default: // "list_triggers"
		list, err := t.svc.ListTriggers(execCtx.UserID)
		if err != nil {
			return nil, err
		}
		if len(list) == 0 {
			return &domain.ToolExecutionResult{
				Status:        "COMPLETED",
				SummaryForLLM: "O usuário não possui nenhum radar ou vigília ativa no momento.",
			}, nil
		}
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("O usuário possui %d radares ativos:\n", len(list)))
		var cards []domain.ChatCard
		for _, tr := range list {
			sb.WriteString(fmt.Sprintf("- [ID: %s] %s (Status: %s)\n", tr.ID, tr.Title, tr.Status))
			cards = append(cards, domain.ChatCard{
				ID:          tr.ID,
				Type:        "trigger",
				Title:       tr.Title,
				Subtitle:    string(tr.Status),
				ActionLabel: "Ver Radar",
			})
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: sb.String(),
			Cards:         cards,
		}, nil
	}
}
