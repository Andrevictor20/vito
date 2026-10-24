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

type mockWhatsAppSender struct {
	sentTo   string
	sentText string
}

func (m *mockWhatsAppSender) SendWhatsAppMessage(ctx context.Context, userID, to, text string) error {
	m.sentTo = to
	m.sentText = text
	return nil
}

func TestAssistantService_RefineWhatsAppMessage_Draft(t *testing.T) {
	astSvc, mockAI, _, _, _, _, _, userID := setupExtendedCrudTest(t)
	ctx := context.Background()

	mockAI.intent = &ai.ParsedIntent{
		Action: ai.ActionRefineMessage,
		RefinedMessage: &ai.ParsedMessageRefinement{
			Channel:      "whatsapp",
			Target:       "Marcos",
			Directive:    "formal",
			OriginalText: "Fala Marcos, não vou conseguir ir na reunião hoje.",
			RefinedText:  "Olá Marcos, infelizmente não poderei comparecer à nossa reunião hoje devido a um imprevisto.",
			SendNow:      false,
		},
	}

	resp, err := astSvc.Process(ctx, userID, ai.UserInput{Text: "Deixa mais formal essa mensagem pro Marcos", Now: time.Now()})
	if err != nil {
		t.Fatalf("ProcessMessage falhou: %v", err)
	}

	if !strings.Contains(resp.Message, "Marcos") {
		t.Errorf("resposta deveria mencionar Marcos, veio: %q", resp.Message)
	}
	if !strings.Contains(resp.Message, "não enviei") {
		t.Errorf("resposta em modo rascunho deve indicar que não enviou, veio: %q", resp.Message)
	}
	if !strings.Contains(resp.Message, "Olá Marcos, infelizmente não poderei comparecer") {
		t.Errorf("resposta deve conter o texto refinado, veio: %q", resp.Message)
	}
}

func TestAssistantService_RefineWhatsAppMessage_SendNow(t *testing.T) {
	astSvc, mockAI, _, _, _, _, _, userID := setupExtendedCrudTest(t)
	ctx := context.Background()

	mockSender := &mockWhatsAppSender{}
	astSvc.SetWhatsAppSender(mockSender)

	contactRepo := &mockSyncedContactRepo{
		contacts: []domain.SyncedContact{
			{
				UserID:      userID,
				Phone:       "+55 11 98877-6655",
				PhoneDigits: "5511988776655",
				SavedName:   "Marcos",
			},
		},
	}
	dir := service.NewWhatsAppDirectoryService(nil, service.WhatsAppContextConfig{MaxAge: 30 * 24 * time.Hour}, nil)
	dir.SetContactRepository(contactRepo)
	astSvc.SetWhatsAppDirectory(dir)

	mockAI.intent = &ai.ParsedIntent{
		Action: ai.ActionRefineMessage,
		RefinedMessage: &ai.ParsedMessageRefinement{
			Channel:      "whatsapp",
			Target:       "Marcos",
			Directive:    "commercial",
			OriginalText: "Segue a proposta",
			RefinedText:  "Olá Marcos! Conforme conversamos, segue nossa proposta comercial detalhada.",
			SendNow:      true,
		},
	}

	resp, err := astSvc.Process(ctx, userID, ai.UserInput{Text: "Melhora a proposta e manda pro Marcos agora", Now: time.Now()})
	if err != nil {
		t.Fatalf("ProcessMessage falhou: %v", err)
	}

	if !strings.Contains(resp.Message, "enviei") {
		t.Errorf("resposta deveria confirmar envio, veio: %q", resp.Message)
	}
	if mockSender.sentTo != "5511988776655@s.whatsapp.net" {
		t.Errorf("esperava envio para '5511988776655@s.whatsapp.net', veio %q", mockSender.sentTo)
	}
	if mockSender.sentText != "Olá Marcos! Conforme conversamos, segue nossa proposta comercial detalhada." {
		t.Errorf("texto enviado incorreto: %q", mockSender.sentText)
	}
}

func TestAssistantService_RefineEmail_Draft(t *testing.T) {
	astSvc, mockAI, _, _, _, _, _, userID := setupExtendedCrudTest(t)
	ctx := context.Background()

	mockAI.intent = &ai.ParsedIntent{
		Action: ai.ActionRefineMessage,
		RefinedMessage: &ai.ParsedMessageRefinement{
			Channel:      "email",
			Target:       "cliente@empresa.com",
			Subject:      "Alinhamento Estratégico",
			Directive:    "concise",
			OriginalText: "Texto longo de 5 parágrafos",
			RefinedText:  "Prezado cliente,\n\nConfirmamos o alinhamento para amanhã às 10h.\n\nAtenciosamente,\nAndré",
			SendNow:      false,
		},
	}

	resp, err := astSvc.Process(ctx, userID, ai.UserInput{Text: "Deixa mais conciso o e-mail pro cliente", Now: time.Now()})
	if err != nil {
		t.Fatalf("ProcessMessage falhou: %v", err)
	}

	if !strings.Contains(resp.Message, "cliente@empresa.com") {
		t.Errorf("deveria citar o e-mail de destino, veio: %q", resp.Message)
	}
	if !strings.Contains(resp.Message, "Alinhamento Estratégico") {
		t.Errorf("deveria citar o assunto, veio: %q", resp.Message)
	}
	if !strings.Contains(resp.Message, "não enviei") {
		t.Errorf("deveria indicar que é rascunho não enviado, veio: %q", resp.Message)
	}
}

func TestAssistantService_RefineGrammar_GenericDraft(t *testing.T) {
	astSvc, mockAI, _, _, _, _, _, userID := setupExtendedCrudTest(t)
	ctx := context.Background()

	mockAI.intent = &ai.ParsedIntent{
		Action: ai.ActionRefineMessage,
		RefinedMessage: &ai.ParsedMessageRefinement{
			Directive:    "grammar",
			OriginalText: "Nos fomos na reuniao ontem e nao tinhamos visto os relatorio",
			RefinedText:  "Fomos à reunião ontem e não tínhamos visto os relatórios.",
			SendNow:      false,
		},
	}

	resp, err := astSvc.Process(ctx, userID, ai.UserInput{Text: "Corrige a gramática deste texto", Now: time.Now()})
	if err != nil {
		t.Fatalf("Process falhou: %v", err)
	}

	if !strings.Contains(resp.Message, "Fomos à reunião ontem e não tínhamos visto os relatórios.") {
		t.Errorf("deveria conter o texto corrigido, veio: %q", resp.Message)
	}
	if !strings.Contains(resp.Message, "não enviei") {
		t.Errorf("deveria indicar que é rascunho não enviado, veio: %q", resp.Message)
	}
}
