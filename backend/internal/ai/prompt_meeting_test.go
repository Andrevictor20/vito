package ai_test

import (
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
)

func TestBuildSystemPrompt_MeetingDirectivesAndSchema(t *testing.T) {
	input := ai.UserInput{
		Now:      time.Date(2026, 10, 16, 14, 0, 0, 0, time.UTC),
		Timezone: "America/Sao_Paulo",
		UserName: "André Victor",
	}

	prompt := ai.BuildSystemPromptFromInput(input)

	// 1. O schema deve conter a chave "meeting"
	if !strings.Contains(prompt, `"meeting": {`) {
		t.Errorf("esperava chave \"meeting\" no schema JSON do prompt")
	}

	// 2. O schema deve detalhar slots e mode (group_consensus)
	if !strings.Contains(prompt, "group_consensus") {
		t.Errorf("esperava menção ao mode group_consensus no prompt")
	}

	// 3. Diretriz de diferenciação entre evento de calendário e reunião em grupo
	if !strings.Contains(prompt, "CREATE_MEETING") {
		t.Errorf("esperava CREATE_MEETING nas diretrizes operacionais do prompt")
	}

	if !strings.Contains(prompt, "consenso") || !strings.Contains(prompt, "votação") {
		t.Errorf("esperava diretiva de consenso/votação associada a CREATE_MEETING no prompt")
	}
}
