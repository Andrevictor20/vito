package ai_test

import (
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
)

// P1: o schema precisa conhecer QUERY_TODOS (consulta de tarefas/pendências).
func TestBuildSystemPrompt_QueryTodosAction(t *testing.T) {
	input := ai.UserInput{
		Now:      time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC),
		Timezone: "America/Sao_Paulo",
	}
	prompt := ai.BuildSystemPromptFromInput(input)

	if !strings.Contains(prompt, "QUERY_TODOS") {
		t.Errorf("esperava action QUERY_TODOS no schema do prompt")
	}
	for _, kw := range []string{"minhas tarefas", "pendente"} {
		if !strings.Contains(strings.ToLower(prompt), kw) {
			t.Errorf("esperava diretriz de consulta de tarefas contendo %q no prompt", kw)
		}
	}
}

// P2/P3: consulta de agenda precisa orientar data-alvo (ex: sábado) em vez de só hoje/amanhã.
func TestBuildSystemPrompt_QueryScheduleTargetDate(t *testing.T) {
	input := ai.UserInput{
		Now:      time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC),
		Timezone: "America/Sao_Paulo",
	}
	prompt := ai.BuildSystemPromptFromInput(input)

	for _, kw := range []string{"sábado", "start_at", "data-alvo"} {
		if !strings.Contains(strings.ToLower(prompt), kw) {
			t.Errorf("esperava orientação de data-alvo contendo %q no prompt", kw)
		}
	}
}
