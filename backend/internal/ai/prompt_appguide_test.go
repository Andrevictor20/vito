package ai_test

import (
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
)

// W3: anti-drift entre docs/app e o prompt — toda aba/função documentada
// aparece no guia, e a regra de profundidade adaptativa está presente.
func TestBuildSystemPrompt_AppGuideCoverage(t *testing.T) {
	input := ai.UserInput{
		Now:      time.Date(2026, 10, 13, 12, 0, 0, 0, time.UTC),
		Timezone: "America/Sao_Paulo",
		UserName: "André",
	}
	prompt := ai.BuildSystemPromptFromInput(input)

	for _, anchor := range []string{
		"APP_GUIDE",
		"TOPOLOGIA FÍSICA E NAVEGAÇÃO",
		"Tarefas e Pendências",
		"Radares",
		"Booking",
		"Perfil (ícone de pessoa",
		"PROIBIÇÃO ABSOLUTA (ANTI-ALUCINAÇÃO DO HEADER)",
		"NUNCA existe menu de perfil",
		"COMO ALTERAR O TEMA DO APP",
		"Nível 1",
		"Nível 2",
		"Nível 3",
		"remind_repeat",
		"17:30",
	} {
		if !strings.Contains(prompt, anchor) {
			t.Errorf("esperava âncora %q no guia do app", anchor)
		}
	}
}
