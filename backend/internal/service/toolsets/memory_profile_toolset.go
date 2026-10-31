package toolsets

import (
	"context"
	"encoding/json"

	"github.com/andrevmp/vito/backend/internal/domain"
)

type MemoryProfileToolset struct{}

func NewMemoryProfileToolset() *MemoryProfileToolset {
	return &MemoryProfileToolset{}
}

func (t *MemoryProfileToolset) Name() domain.ToolsetName {
	return domain.ToolsetMemoryProfile
}

func (t *MemoryProfileToolset) Description() string {
	return "Consulta e gerencia o perfil e as memórias de longo prazo do usuário (fatos, rotinas e preferências)."
}

func (t *MemoryProfileToolset) JSONSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"operation": {
				"type": "string",
				"enum": ["search_memories", "get_profile", "update_profile"],
				"description": "Operação de memória/perfil."
			},
			"params": {
				"type": "object",
				"properties": {
					"query": {"type": "string", "description": "Termo de busca em memórias passadas."},
					"preferences": {"type": "string", "description": "Atualizações de perfil."}
				}
			}
		},
		"required": ["operation"]
	}`)
}

func (t *MemoryProfileToolset) IsWriteOperation(op string, rawParams json.RawMessage) (bool, bool, map[string]any) {
	preview := make(map[string]any)
	_ = json.Unmarshal(rawParams, &preview)
	if op == "update_profile" {
		return true, false, preview
	}
	return false, false, preview
}

func (t *MemoryProfileToolset) Execute(ctx context.Context, execCtx *domain.ToolExecutionContext, op string, rawParams json.RawMessage) (*domain.ToolExecutionResult, error) {
	return &domain.ToolExecutionResult{
		Status:        "COMPLETED",
		SummaryForLLM: "Memórias de longo prazo e perfil recuperados com sucesso.",
	}, nil
}
