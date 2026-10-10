package ai_test

import (
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
)

func TestBuildSystemPromptFromInput_EnhancedContextAndDirectives(t *testing.T) {
	now := time.Date(2026, 10, 10, 14, 30, 0, 0, time.UTC)
	input := ai.UserInput{
		Now:      now,
		Timezone: "America/Sao_Paulo",
		UserName: "André Victor",
		ContextMemories: []string{
			"[preferência] Toma café sem açúcar",
			"[família] Esposa se chama Carolina",
		},
		ActiveSchedule: []string{
			"10/10/2026 (16:00 às 17:00): Reunião de Arquitetura",
		},
		PendingTodos: []string{
			"[high - 10/10 18:00] Revisar PR do backend",
		},
		ActiveTriggers: []string{
			"[finance - diário 08:30] PETR3 (Acompanhar acima de R$ 35)",
		},
		ConversationHistory: []ai.ChatMessageContext{
			{Sender: "user", Text: "Você entende de matemática?"},
			{Sender: "vito", Text: "Sim, aprecio muito a matemática e suas aplicações."},
		},
	}

	prompt := ai.BuildSystemPromptFromInput(input)

	// 1. Contexto temporal e de usuário
	if !strings.Contains(prompt, "André Victor") {
		t.Errorf("esperava nome do usuário no prompt")
	}
	if !strings.Contains(prompt, "DISPARADORES E VIGÍLIAS ATIVAS NO APP") && !strings.Contains(prompt, "VIGÍLIAS E DISPARADORES ATIVOS") {
		t.Errorf("esperava seção de disparadores/vigílias ativas no prompt")
	}
	if !strings.Contains(prompt, "PETR3") {
		t.Errorf("esperava disparador PETR3 no prompt")
	}

	// 2. Histórico da conversa recente
	if !strings.Contains(prompt, "HISTÓRICO RECENTE DA CONVERSA") {
		t.Errorf("esperava seção de histórico recente da conversa no prompt")
	}
	if !strings.Contains(prompt, "Você entende de matemática?") {
		t.Errorf("esperava turno anterior do usuário no prompt")
	}

	// 3. Diretriz de proatividade e temas externos (ex: matemática)
	if !strings.Contains(prompt, "PROATIVIDADE") {
		t.Errorf("esperava diretriz de proatividade no prompt")
	}
	if !strings.Contains(prompt, "matemática") {
		t.Errorf("esperava menção a matemática ou temas de interesse no prompt")
	}

	// 4. Aprendizado contínuo e persistência de memória
	if !strings.Contains(prompt, "APRENDIZADO CONTÍNUO") {
		t.Errorf("esperava diretriz de aprendizado contínuo no prompt")
	}
	if !strings.Contains(prompt, "memory_content") {
		t.Errorf("esperava memory_content mencionado no prompt")
	}

	// 5. Anti-emoji do Material Design 3
	if !strings.Contains(prompt, "ANTI-EMOJI") {
		t.Errorf("esperava diretriz anti-emoji preservada")
	}
}
