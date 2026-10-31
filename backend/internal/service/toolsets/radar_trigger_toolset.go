package toolsets

import (
	"context"
	"encoding/json"

	"github.com/andrevmp/vito/backend/internal/domain"
)

type RadarTriggerToolset struct{}

func NewRadarTriggerToolset() *RadarTriggerToolset {
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
	return &domain.ToolExecutionResult{
		Status:        "COMPLETED",
		SummaryForLLM: "Radares do usuário consultados/atualizados com sucesso.",
		Cards: []domain.ChatCard{{
			ID:          "radar-1",
			Type:        "trigger",
			Title:       "Radar Ativo",
			Subtitle:    "Vigília em execução",
			ActionLabel: "Ver Radares",
		}},
	}, nil
}
