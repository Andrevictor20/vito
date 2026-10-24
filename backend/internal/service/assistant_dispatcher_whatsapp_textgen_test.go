package service_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

type textGenAIGateway struct {
	intent           *ai.ParsedIntent
	generateCalls    int
	lastSystemPrompt string
	lastUserPrompt   string
	generateResponse string
}

func (m *textGenAIGateway) ParseIntent(ctx context.Context, input ai.UserInput) (*ai.ParsedIntent, error) {
	return m.intent, nil
}

func (m *textGenAIGateway) GenerateText(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	m.generateCalls++
	m.lastSystemPrompt = systemPrompt
	m.lastUserPrompt = userPrompt
	return m.generateResponse, nil
}

func TestAssistantDispatcherWhatsApp_SummarizeConversation_UsesGenerateText(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	now := time.Now().UTC()

	archiveChat(t, fx, "tg-1", friendJID(), domain.WhatsAppChatKindDirect, "Carlos", "proposta enviada", false, now.Add(-time.Hour))

	gw := &textGenAIGateway{
		intent: &ai.ParsedIntent{
			Action:  ai.ActionQueryConversation,
			Message: "Consultando Carlos.",
			Conversation: &ai.ParsedConversationQuery{
				Chat:  "Carlos",
				Limit: 5,
			},
		},
		generateResponse: "Carlos avisou que enviou a proposta.",
	}

	astSvc := service.NewAssistantService(gw, nil, nil, nil)
	dir := service.NewWhatsAppDirectoryService(fx.repo, service.DefaultWhatsAppContextConfig(), nil)
	astSvc.SetWhatsAppDirectory(dir)

	resp, err := astSvc.Process(context.Background(), "user-ctx-1", ai.UserInput{
		Text:                 "o que o Carlos falou?",
		Now:                  now,
		Timezone:             "America/Sao_Paulo",
		WhatsAppPrivateScope: true,
	})
	if err != nil {
		t.Fatalf("Process falhou: %v", err)
	}

	if gw.generateCalls != 1 {
		t.Errorf("esperava 1 chamada para GenerateText, obteve %d", gw.generateCalls)
	}
	if !strings.Contains(gw.lastUserPrompt, "proposta enviada") {
		t.Errorf("prompt do GenerateText não continha o texto da conversa: %q", gw.lastUserPrompt)
	}
	if resp.Message != "Carlos avisou que enviou a proposta." {
		t.Errorf("resposta inesperada: %q", resp.Message)
	}
}

func TestAssistantDispatcherWhatsApp_SummarizeFoundMessages_UsesGenerateText(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	now := time.Now().UTC()

	archiveChat(t, fx, "tg-2", friendJID(), domain.WhatsAppChatKindDirect, "Beatriz", "revisão de contrato amanhã", false, now.Add(-time.Hour))

	gw := &textGenAIGateway{
		intent: &ai.ParsedIntent{
			Action:  ai.ActionSearchConversations,
			Message: "Buscando contrato.",
			Conversation: &ai.ParsedConversationQuery{
				Query: "contrato",
				Limit: 5,
			},
		},
		generateResponse: "Beatriz mencionou revisão de contrato amanhã.",
	}

	astSvc := service.NewAssistantService(gw, nil, nil, nil)
	dir := service.NewWhatsAppDirectoryService(fx.repo, service.DefaultWhatsAppContextConfig(), nil)
	astSvc.SetWhatsAppDirectory(dir)

	resp, err := astSvc.Process(context.Background(), "user-ctx-1", ai.UserInput{
		Text:                 "busque contrato no WhatsApp",
		Now:                  now,
		Timezone:             "America/Sao_Paulo",
		WhatsAppPrivateScope: true,
	})
	if err != nil {
		t.Fatalf("Process falhou: %v", err)
	}

	if gw.generateCalls != 1 {
		t.Errorf("esperava 1 chamada para GenerateText, obteve %d", gw.generateCalls)
	}
	if !strings.Contains(gw.lastUserPrompt, "revisão de contrato amanhã") {
		t.Errorf("prompt do GenerateText não continha o texto do trecho encontrado: %q", gw.lastUserPrompt)
	}
	if resp.Message != "Beatriz mencionou revisão de contrato amanhã." {
		t.Errorf("resposta inesperada: %q", resp.Message)
	}
}
