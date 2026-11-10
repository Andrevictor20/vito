package toolsets_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

type mockMemoryRepo struct {
	mems []domain.Memory
}

func (m *mockMemoryRepo) ListByUser(userID string, limit int) ([]domain.Memory, error) {
	return m.mems, nil
}

func (m *mockMemoryRepo) SearchRelevant(userID, query string, limit int) ([]domain.Memory, error) {
	var res []domain.Memory
	for _, item := range m.mems {
		if strings.Contains(strings.ToLower(item.Content), strings.ToLower(query)) {
			res = append(res, item)
		}
	}
	return res, nil
}

func (m *mockMemoryRepo) Create(mem *domain.Memory) error {
	m.mems = append(m.mems, *mem)
	return nil
}

func TestMemoryProfileToolset_SearchRelevantMemories(t *testing.T) {
	repo := &mockMemoryRepo{
		mems: []domain.Memory{
			{
				ID:        "m-1",
				Category:  "hábito",
				Content:   "Café sem açúcar pela manhã",
				CreatedAt: time.Now(),
			},
			{
				ID:        "m-2",
				Category:  "trabalho",
				Content:   "Reunião diária às 10h",
				CreatedAt: time.Now(),
			},
		},
	}
	ts := toolsets.NewMemoryProfileToolset(repo)

	execCtx := &domain.ToolExecutionContext{
		UserID: "user-mem-test",
	}

	params, _ := json.Marshal(map[string]any{"query": "café"})
	res, err := ts.Execute(context.Background(), execCtx, "search_memories", params)
	if err != nil {
		t.Fatalf("falha ao executar busca de memórias: %v", err)
	}

	if !strings.Contains(res.SummaryForLLM, "Café sem açúcar") {
		t.Errorf("SummaryForLLM deve conter a memória sobre café: %s", res.SummaryForLLM)
	}
	if strings.Contains(res.SummaryForLLM, "Reunião diária") {
		t.Errorf("SummaryForLLM não deve conter memórias não relacionadas: %s", res.SummaryForLLM)
	}
}
