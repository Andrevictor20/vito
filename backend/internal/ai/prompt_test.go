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

func TestBuildSystemPrompt_AutonomyMode_Assisted(t *testing.T) {
	input := ai.UserInput{
		Now:          time.Date(2026, 10, 10, 10, 0, 0, 0, time.UTC),
		Timezone:     "America/Sao_Paulo",
		AutonomyMode: "assisted",
	}

	prompt := ai.BuildSystemPromptFromInput(input)

	if !strings.Contains(prompt, "AUTONOMIA") || !strings.Contains(prompt, "ASSISTIDO") {
		t.Errorf("esperava menção ao nível de autonomia assistido no prompt: %s", prompt)
	}
	if !strings.Contains(prompt, "confirmação") {
		t.Errorf("esperava diretiva de confirmação no modo assistido: %s", prompt)
	}
}

func TestBuildSystemPromptFromInput_TriggerAlertsBlock(t *testing.T) {
	now := time.Date(2026, 10, 10, 10, 0, 0, 0, time.UTC)
	withAlerts := ai.UserInput{
		Now:      now,
		Timezone: "America/Sao_Paulo",
		ActiveTriggerAlerts: []string{
			"[TV 55 polegadas] Preço atingido: 3499.00 (alvo R$ 3.500)",
		},
	}
	prompt := ai.BuildSystemPromptFromInput(withAlerts)
	if !strings.Contains(prompt, "ALERTAS RECENTES DOS RADARES") {
		t.Errorf("esperava bloco de alertas recentes dos radares no prompt")
	}
	if !strings.Contains(prompt, "3499.00") {
		t.Errorf("esperava valor do alerta no prompt")
	}

	withoutAlerts := ai.UserInput{Now: now, Timezone: "America/Sao_Paulo"}
	plain := ai.BuildSystemPromptFromInput(withoutAlerts)
	if strings.Contains(plain, "ALERTAS RECENTES DOS RADARES") {
		t.Errorf("sem alertas o bloco não deveria aparecer")
	}
}

func TestManualRadarModule_CitesProposalRules(t *testing.T) {
	got := ai.ManualModuleFor("marque reunião sobre o que meu radar achou")
	if !strings.Contains(got, "PROPOSTA") && !strings.Contains(got, "proposta") {
		t.Errorf("módulo radar deveria orientar proposta com confirmação, veio: %q", got)
	}
}

func TestBuildSystemPrompt_AutonomyMode_Proactive(t *testing.T) {
	input := ai.UserInput{
		Now:          time.Date(2026, 10, 10, 10, 0, 0, 0, time.UTC),
		Timezone:     "America/Sao_Paulo",
		AutonomyMode: "proactive",
	}

	prompt := ai.BuildSystemPromptFromInput(input)

	if !strings.Contains(prompt, "AUTONOMIA") || !strings.Contains(prompt, "PROATIVO") {
		t.Errorf("esperava menção ao nível de autonomia proativo no prompt: %s", prompt)
	}
	if !strings.Contains(prompt, "iniciativa") {
		t.Errorf("esperava diretiva de iniciativa no modo proativo: %s", prompt)
	}
}

func TestSystemPrompt_TokenBudget(t *testing.T) {
	now := time.Date(2026, 10, 10, 10, 0, 0, 0, time.UTC)
	base := ai.BuildSystemPrompt(now, "America/Sao_Paulo")
	t.Logf("system prompt base: %d chars (~%d tokens)", len(base), len(base)/4)
	full := ai.BuildSystemPromptFromInput(ai.UserInput{
		Now:             now,
		Timezone:        "America/Sao_Paulo",
		UserName:        "André",
		ContextMemories: []string{"[pref] Café sem açúcar"},
		ActiveSchedule:  []string{"10/10/2026 (16:00 às 17:00): Reunião"},
		ActiveTriggers:  []string{"[finance] PETR3"},
	})
	t.Logf("system prompt com contexto: %d chars (~%d tokens)", len(full), len(full)/4)
	// Groq free: 8000 TPM por minuto; base deve deixar folga p/ histórico+memórias.
	if len(base) > 20000 {
		t.Errorf("base acima do orçamento (20k chars): %d", len(base))
	}
}

func TestBuildSystemPromptFromInput_FocusModes(t *testing.T) {
	now := time.Date(2026, 10, 10, 10, 0, 0, 0, time.UTC)
	modes := map[string]string{
		"calendar": "MODO DE FOCO ATIVO: AGENDA & EVENTOS",
		"tasks":    "MODO DE FOCO ATIVO: TAREFAS & PRIORIDADES",
		"triggers": "MODO DE FOCO ATIVO: VIGÍLIAS & RADARES",
		"meetings": "MODO DE FOCO ATIVO: BOOKING & REUNIÕES",
		"briefing": "MODO DE FOCO ATIVO: BRIEFING EXECUTIVO",
		"memory":   "MODO DE FOCO ATIVO: MEMÓRIA & ROTINAS",
	}

	for mode, expectedPhrase := range modes {
		t.Run(mode, func(t *testing.T) {
			input := ai.UserInput{
				Now:       now,
				Timezone:  "America/Sao_Paulo",
				FocusMode: mode,
			}
			prompt := ai.BuildSystemPromptFromInput(input)
			if !strings.Contains(prompt, expectedPhrase) {
				t.Fatalf("esperava que o prompt contivesse %q para o modo %q", expectedPhrase, mode)
			}
		})
	}

	t.Run("empty_focus_mode", func(t *testing.T) {
		input := ai.UserInput{
			Now:      now,
			Timezone: "America/Sao_Paulo",
		}
		prompt := ai.BuildSystemPromptFromInput(input)
		if strings.Contains(prompt, "MODO DE FOCO ATIVO") {
			t.Fatalf("não esperava bloco de foco ativo para modo vazio")
		}
	})
}

func TestBuildSystemPrompt_VoiceAndGeneralSearchAndScopeDirectives(t *testing.T) {
	input := ai.UserInput{
		Now:      time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC),
		Timezone: "America/Sao_Paulo",
	}
	prompt := ai.BuildSystemPromptFromInput(input)

	expectedDirectives := []string{
		"MODO DE VOZ, PESQUISA GERAL E CONVERSAÇÃO CONTÍNUA",
		"CONVERSAÇÃO HUMANA & FLUIDA",
		"RESPOSTAS PARA MODO DE VOZ / ÁUDIO",
		"PESQUISA DE ASSUNTOS GERAIS",
		"FRONTEIRA ESTRITA DE ESCOPO (OUT_OF_SCOPE)",
		"NUNCA redija monografias",
		"NUNCA resolva cálculos avançados",
		"NUNCA escreva, refatore ou depure códigos de programação",
	}

	for _, directive := range expectedDirectives {
		if !strings.Contains(prompt, directive) {
			t.Errorf("esperava diretriz %q no system prompt", directive)
		}
	}
}
