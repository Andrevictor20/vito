package toolsets

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/google/uuid"
)

type MemoryRepositoryContract interface {
	ListByUser(userID string, limit int) ([]domain.Memory, error)
	SearchRelevant(userID, query string, limit int) ([]domain.Memory, error)
	Create(m *domain.Memory) error
}

type MemoryProfileToolset struct {
	repo MemoryRepositoryContract
}

func NewMemoryProfileToolset(repo ...MemoryRepositoryContract) *MemoryProfileToolset {
	if len(repo) > 0 && repo[0] != nil {
		return &MemoryProfileToolset{repo: repo[0]}
	}
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
	if t.repo == nil {
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: "Repositório de memórias de longo prazo não configurado.",
		}, nil
	}

	var params struct {
		Query       string `json:"query"`
		Preferences string `json:"preferences"`
	}
	if len(rawParams) > 0 {
		_ = json.Unmarshal(rawParams, &params)
	}

	switch op {
	case "update_profile":
		if strings.TrimSpace(params.Preferences) != "" {
			m := &domain.Memory{
				ID:         uuid.New().String(),
				UserID:     execCtx.UserID,
				Category:   "preference",
				Content:    params.Preferences,
				Importance: 3,
				Confidence: 1.0,
				CreatedAt:  time.Now().UTC(),
				UpdatedAt:  time.Now().UTC(),
			}
			_ = t.repo.Create(m)
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: "Perfil e preferências do usuário atualizados nas memórias de longo prazo.",
		}, nil

	default: // "search_memories", "get_profile"
		var mems []domain.Memory
		var err error
		if q := strings.TrimSpace(params.Query); q != "" {
			mems, err = t.repo.SearchRelevant(execCtx.UserID, q, 10)
		} else {
			mems, err = t.repo.ListByUser(execCtx.UserID, 10)
		}
		if err != nil {
			return nil, err
		}
		if len(mems) == 0 {
			if params.Query != "" {
				return &domain.ToolExecutionResult{
					Status:        "COMPLETED",
					SummaryForLLM: fmt.Sprintf("Nenhuma memória relevante encontrada sobre %q.", params.Query),
				}, nil
			}
			return &domain.ToolExecutionResult{
				Status:        "COMPLETED",
				SummaryForLLM: "Nenhuma memória ou preferência explícita registrada ainda para este usuário.",
			}, nil
		}
		var sb strings.Builder
		sb.WriteString("Memórias e fatos conhecidos sobre o usuário:\n")
		for _, m := range mems {
			sb.WriteString(fmt.Sprintf("- [%s] %s\n", m.Category, m.Content))
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: sb.String(),
		}, nil
	}
}
