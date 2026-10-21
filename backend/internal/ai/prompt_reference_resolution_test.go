package ai_test

import (
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
)

// AC-F1/AC-F2 — os blocos de contexto do WhatsApp são renderizados no prompt.
func TestBuildSystemPromptFromInput_WhatsAppQuotedAndWindowBlocks(t *testing.T) {
	prompt := ai.BuildSystemPromptFromInput(ai.UserInput{
		Now:           time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC),
		Timezone:      "America/Sao_Paulo",
		QuotedContext: "reunião com a Ana quinta às 10h",
		ConversationWindow: []ai.ChatMessageContext{
			{Sender: "Ana", Text: "pode ser quinta às 10h", Chat: "Ana"},
			{Sender: "Vito", Text: "Agendei: Café com a Ana", Chat: "Você"},
		},
	})

	if !strings.Contains(prompt, "MENSAGEM CITADA PELO USUÁRIO") {
		t.Error("esperava o bloco de mensagem citada no prompt")
	}
	if !strings.Contains(prompt, "reunião com a Ana quinta às 10h") {
		t.Error("esperava o texto citado no prompt")
	}
	if !strings.Contains(prompt, "CONTEXTO RECENTE DO WHATSAPP") {
		t.Error("esperava o bloco de contexto do WhatsApp no prompt")
	}
	if !strings.Contains(prompt, "[Ana] Ana: pode ser quinta às 10h") {
		t.Errorf("esperava a mensagem rotulada com o chat de origem, prompt não contém o rótulo:\n%s", prompt)
	}
}

// AC-F7/AC-F8 — as diretivas de resolução de referência e ação estão presentes.
func TestBuildSystemPromptFromInput_WhatsAppDirectives(t *testing.T) {
	prompt := ai.BuildSystemPromptFromInput(ai.UserInput{
		Now:                time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC),
		Timezone:           "America/Sao_Paulo",
		QuotedContext:      "algo citado",
		ConversationWindow: []ai.ChatMessageContext{{Sender: "Ana", Text: "oi", Chat: "Ana"}},
	})

	for _, expected := range []string{
		"DIRETRIZ DE CONTEXTO DO WHATSAPP",
		"NUNCA peça para o usuário repetir",
		"INFERIR AÇÃO PELO CONTEÚDO",
		"AGE E CONFIRME",
		"NÃO DUPLIQUE",
	} {
		if !strings.Contains(prompt, expected) {
			t.Errorf("esperava a diretiva %q no prompt", expected)
		}
	}
}

// Sem contexto de WhatsApp, as diretivas não aparecem (não alteram os demais canais).
func TestBuildSystemPromptFromInput_NoWhatsAppDirectivesWithoutContext(t *testing.T) {
	prompt := ai.BuildSystemPromptFromInput(ai.UserInput{
		Now:      time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC),
		Timezone: "America/Sao_Paulo",
		Text:     "olá",
	})

	if strings.Contains(prompt, "DIRETRIZ DE CONTEXTO DO WHATSAPP") {
		t.Error("as diretivas do WhatsApp não devem aparecer sem contexto de WhatsApp")
	}
	if strings.Contains(prompt, "CONTEXTO RECENTE DO WHATSAPP") {
		t.Error("o bloco de contexto do WhatsApp não deve aparecer sem contexto")
	}
}

// O Vito não pode responder "não sei" quando o contexto entregue tem a resposta.
func TestBuildSystemPromptFromInput_WhatsAppDirectiveForbidsDontKnow(t *testing.T) {
	prompt := ai.BuildSystemPromptFromInput(ai.UserInput{
		Now:                time.Date(2026, 10, 21, 12, 0, 0, 0, time.UTC),
		Timezone:           "America/Sao_Paulo",
		QuotedContext:      "algo citado",
		ConversationWindow: []ai.ChatMessageContext{{Sender: "Ana", Text: "reuniao quinta 10h", Chat: "Ana"}},
	})

	// Fragmentos ASCII: a diretiva precisa mandar o Vito varrer o bloco antes de
	// dizer que nao sabe, e tratar o contexto como memoria (nao como ruido).
	for _, expected := range []string{"CONT", "A RESPOSTA", "varra o bloco", "um erro"} {
		if !strings.Contains(prompt, expected) {
			t.Errorf("esperava o fragmento %q na diretiva de contexto", expected)
		}
	}
}

// O prompt leva o diretório de contatos e as pendências de resposta.
func TestBuildSystemPromptFromInput_ContactDirectoryAndPendingBlocks(t *testing.T) {
	prompt := ai.BuildSystemPromptFromInput(ai.UserInput{
		Now:      time.Date(2026, 10, 21, 12, 0, 0, 0, time.UTC),
		Timezone: "America/Sao_Paulo",
		ContactDirectory: []ai.ChatContactSummary{
			{Name: "Ana", Preview: "pode ser quinta as 10h", Age: "ha 2h"},
			{Name: "ALVIMAR", Preview: "manda o contrato", Age: "ontem"},
		},
		PendingConversations: []ai.ChatContactSummary{
			{Name: "Ana", Preview: "pode ser quinta as 10h", Age: "ha 2h", Pending: true},
		},
	})

	for _, expected := range []string{
		"SEUS CONTATOS",
		"Ana",
		"ALVIMAR",
		"PEND",
	} {
		if !strings.Contains(prompt, expected) {
			t.Errorf("esperava o fragmento %q no prompt", expected)
		}
	}

	// As diretivas do assistente de WhatsApp descrevem as novas ações.
	for _, expected := range []string{"QUERY_CONVERSATION", "LIST_PENDING_CONVERSATIONS", "DRAFT_REPLY", "SEND_WHATSAPP_MESSAGE", "CREATE_REPLY_REMINDER"} {
		if !strings.Contains(prompt, expected) {
			t.Errorf("esperava a acao %q no prompt", expected)
		}
	}
}

// Sem diretório nem pendências, as diretivas do WhatsApp não aparecem.
func TestBuildSystemPromptFromInput_NoWhatsAppAssistantDirectivesWithoutData(t *testing.T) {
	prompt := ai.BuildSystemPromptFromInput(ai.UserInput{
		Now:      time.Date(2026, 10, 21, 12, 0, 0, 0, time.UTC),
		Timezone: "America/Sao_Paulo",
		Text:     "olá",
	})
	if strings.Contains(prompt, "SEUS CONTATOS") {
		t.Error("o bloco de contatos não deve aparecer sem diretório")
	}
	if strings.Contains(prompt, "DIRETRIZ DE ASSISTENTE DE WHATSAPP") {
		t.Error("as diretivas do assistente de WhatsApp não devem aparecer sem dados")
	}
}
