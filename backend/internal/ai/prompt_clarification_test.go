package ai_test

import (
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
)

func TestBuildSystemPrompt_ClarificationDirective(t *testing.T) {
	input := ai.UserInput{
		Now:      time.Date(2026, 10, 12, 12, 0, 0, 0, time.UTC),
		Timezone: "America/Sao_Paulo",
	}
	prompt := ai.BuildSystemPromptFromInput(input)

	if !strings.Contains(prompt, "NEEDS_CLARIFICATION") {
		t.Errorf("esperava action NEEDS_CLARIFICATION no schema do prompt")
	}
	if !strings.Contains(prompt, "COLETA PROGRESSIVA") {
		t.Errorf("esperava diretriz de coleta progressiva (perguntar antes de criar) no prompt")
	}
	for _, kw := range []string{"Qual o nome", "sugiro", "recorrente", "BOOKING", "RADAR", "TAREFA"} {
		if !strings.Contains(prompt, kw) {
			t.Errorf("esperava orientação de esclarecimento contendo %q no prompt", kw)
		}
	}
}
