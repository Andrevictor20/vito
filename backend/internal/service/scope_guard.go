package service

import (
	"regexp"
	"strings"
	"unicode"

	"github.com/andrevmp/vito/backend/internal/ai"
)

var (
	// Regex para detectar expressões matemáticas do tipo "923/342", "2 + 2", "15 * 8", "10 - 4"
	mathExprRegex = regexp.MustCompile(`(?i)\b\d+([\.,]\d+)?\s*[\+\-\*\/x\^÷]\s*\d+([\.,]\d+)?\b`)

	// Palavras-chave estritamente fora de escopo (trivia, piadas, redações, etc.)
	offTopicPhrases = []string{
		"quem descobriu",
		"quem foi",
		"quem é",
		"onde fica",
		"qual é a capital",
		"conte uma piada",
		"conte piada",
		"uma piada",
		"escreva um poema",
		"escreva uma redação",
		"crie um poema",
		"faça um poema",
		"me conte uma história",
		"traduza para",
		"quanto é",
		"calcule",
		"calcula",
	}

	// Termos que indicam compromissos, tarefas ou agenda (whitelist de proteção)
	scheduleWhitelist = []string{
		"agend", "reuni", "compromisso", "event", "lembr", "taref", "afazer", "todo",
		"horári", "calendári", "amanhã", "hoje", "consulta", "academia", "almoço",
		"jantar", "prazo", "entregar",
	}
)

// CheckLocalScopeGuard avalia se a mensagem deve ser bloqueada localmente com ZERO consumo de tokens.
// Retorna um AssistantResponse preenchido se fora de escopo, ou nil se for uma solicitação válida de agenda/tarefa.
func CheckLocalScopeGuard(text string) *AssistantResponse {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		msg := "Não entendi o que você precisa. Como posso ajudar com sua agenda ou tarefas?"
		return &AssistantResponse{
			Action:       ai.ActionOutOfScope,
			Intent:       string(ai.ActionOutOfScope),
			Message:      msg,
			Reply:        msg,
			ProviderUsed: "local-scope-guard",
		}
	}

	// Proteção contra payloads excessivos (> 500 caracteres) para evitar estouro de contexto
	if len(trimmed) > 500 {
		msg := "Sua mensagem é muito longa. Por favor, envie comandos curtos e diretos sobre sua rotina."
		return &AssistantResponse{
			Action:       ai.ActionOutOfScope,
			Intent:       string(ai.ActionOutOfScope),
			Message:      msg,
			Reply:        msg,
			ProviderUsed: "local-scope-guard",
		}
	}

	lower := strings.ToLower(trimmed)

	// Se contiver cálculo matemático evidente
	if isMathQuery(lower) {
		msg := "Sou o Vito, seu assistente pessoal de agenda e tarefas. Não realizo operações matemáticas para otimizar os recursos do app."
		return &AssistantResponse{
			Action:       ai.ActionOutOfScope,
			Intent:       string(ai.ActionOutOfScope),
			Message:      msg,
			Reply:        msg,
			ProviderUsed: "local-scope-guard",
		}
	}

	// Se contiver perguntas de conhecimento geral ou piadas sem relação com agenda
	if isOffTopicQuery(lower) {
		msg := "Sou o Vito, especializado em organizar sua rotina, compromissos e tarefas. Não respondo perguntas de conhecimentos gerais ou outros assuntos fora desse escopo."
		return &AssistantResponse{
			Action:       ai.ActionOutOfScope,
			Intent:       string(ai.ActionOutOfScope),
			Message:      msg,
			Reply:        msg,
			ProviderUsed: "local-scope-guard",
		}
	}

	return nil
}

func isMathQuery(s string) bool {
	// 1. Regex de expressão aritmética direta (ex: "923/342", "2 + 2", "15 * 8")
	if mathExprRegex.MatchString(s) {
		return true
	}

	// 2. Se começa com "quanto é", "calcule", "calcula"
	clean := strings.Map(func(r rune) rune {
		if unicode.IsPunct(r) {
			return ' '
		}
		return r
	}, s)
	clean = strings.Join(strings.Fields(clean), " ")

	if strings.HasPrefix(clean, "quanto e") || strings.HasPrefix(clean, "calcule") || strings.HasPrefix(clean, "calcula") {
		// Se não tiver nenhuma palavra da whitelist de agendamento
		for _, w := range scheduleWhitelist {
			if strings.Contains(clean, w) {
				return false
			}
		}
		return true
	}

	return false
}

func isOffTopicQuery(s string) bool {
	// Se tiver palavras de agendamento explícitas, não bloqueia
	for _, w := range scheduleWhitelist {
		if strings.Contains(s, w) {
			return false
		}
	}

	for _, phrase := range offTopicPhrases {
		if strings.Contains(s, phrase) {
			return true
		}
	}

	return false
}
