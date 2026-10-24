package service

import (
	"context"
	"strings"
	"testing"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// fakeWASender mocka o envio de WhatsApp
type fakeWASender struct {
	sentMsg bool
	sentJID string
	sentTxt string
}

func (f *fakeWASender) SendWhatsAppMessage(ctx context.Context, userID, chatJID, text string) error {
	f.sentMsg = true
	f.sentJID = chatJID
	f.sentTxt = text
	return nil
}

type mockSyncedContactRepo struct {
	contacts []domain.SyncedContact
}

func (m *mockSyncedContactRepo) UpsertBatch(ctx context.Context, contacts []domain.SyncedContact) (int64, error) {
	m.contacts = append(m.contacts, contacts...)
	return int64(len(contacts)), nil
}
func (m *mockSyncedContactRepo) ListByUserID(ctx context.Context, userID string) ([]domain.SyncedContact, error) {
	return m.contacts, nil
}
func (m *mockSyncedContactRepo) ListAll(ctx context.Context) ([]domain.SyncedContact, error) {
	return m.contacts, nil
}
func (m *mockSyncedContactRepo) FindByNameOrPhone(ctx context.Context, userID, query string) ([]domain.SyncedContact, error) {
	return m.contacts, nil
}
func (m *mockSyncedContactRepo) GetByJIDOrLID(ctx context.Context, userID, identifier string) (*domain.SyncedContact, error) {
	if len(m.contacts) > 0 {
		return &m.contacts[0], nil
	}
	return nil, nil
}

func TestConfirmationGate_ExplicitPhrases(t *testing.T) {
	tests := []struct {
		text     string
		history  []ai.ChatMessageContext
		expected bool
	}{
		{"sim, pode enviar", nil, true},
		{"pode mandar", nil, true},
		{"Enviar e-mail para ana@teste.com", nil, true},
		{"Enviar mensagem WhatsApp para Camila", nil, true},
		{"Confirmar e enviar WhatsApp para bella: \"Testando pelo pc\"", nil, true},
		{"Confirmar e enviar e-mail para ana@teste.com", nil, true},
		{"confirmar e enviar", nil, true},
		{"confirmo o envio", nil, true},
		{"sim", []ai.ChatMessageContext{{Sender: "vito", Text: "Posso enviar para André?"}}, true},
		{"manda", []ai.ChatMessageContext{{Sender: "vito", Text: "Preparei o rascunho de e-mail. Posso enviar?"}}, true},
		{"não, cancela", nil, false},
		{"de forma mais formal a seguinte mensagem: bom dia", nil, false},
		{"sim", []ai.ChatMessageContext{{Sender: "vito", Text: "Você tem 3 compromissos hoje."}}, false},
	}

	for _, tt := range tests {
		input := ai.UserInput{
			Text:                tt.text,
			ConversationHistory: tt.history,
		}
		got := isExplicitSendConfirmation(input)
		if got != tt.expected {
			t.Errorf("isExplicitSendConfirmation(%q) = %v; want %v", tt.text, got, tt.expected)
		}
	}
}

func TestAssistant_RefineMessage_IsolatedText_NeverSendsOrAssignsRecipient(t *testing.T) {
	svc := &AssistantService{}

	intent := &ai.ParsedIntent{
		Action: ai.ActionRefineMessage,
		RefinedMessage: &ai.ParsedMessageRefinement{
			OriginalText: "bom dia, você já analisou o repositório do app Vito?",
			RefinedText:  "Prezado(a), espero que este e-mail o(a) encontre bem. Gostaria de saber se já analisou o repositório.",
			Directive:    "formal",
			Target:       "", // Sem destinatário!
			SendNow:      false,
		},
	}

	input := ai.UserInput{
		Text: "de forma mais formal a seguinte mensagem: bom dia, você já analisou o repositório do app Vito?",
	}
	res := &AssistantResponse{}

	out, err := svc.executeRefineMessage(context.Background(), "user-1", intent, input, res)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if out.GmailMessage != nil {
		t.Errorf("expected out.GmailMessage to be nil, got %+v", out.GmailMessage)
	}
	if out.WhatsAppMessage != nil {
		t.Errorf("expected out.WhatsAppMessage to be nil, got %+v", out.WhatsAppMessage)
	}
	if !strings.Contains(out.Message, "Aqui está a versão formal") {
		t.Errorf("expected out.Message to contain formal introduction, got %q", out.Message)
	}
}

func TestAssistant_SendWhatsApp_InitialRequest_DowngradesToReadyCard(t *testing.T) {
	waSender := &fakeWASender{}
	dir := NewWhatsAppDirectoryService(nil, DefaultWhatsAppContextConfig(), nil)
	dir.SetContactRepository(&mockSyncedContactRepo{
		contacts: []domain.SyncedContact{
			{UserID: "user-1", Phone: "+5511999999999", PhoneDigits: "5511999999999", SavedName: "Camila"},
		},
	})

	svc := &AssistantService{
		waSender:    waSender,
		waDirectory: dir,
	}

	intent := &ai.ParsedIntent{
		Action: ai.ActionSendWhatsAppMessage,
		WhatsAppMessage: &ai.ParsedWhatsAppMessage{
			Chat: "Camila",
			Text: "Oi Camila, confirmando nossa reunião.",
		},
	}

	input := ai.UserInput{
		Text: "manda uma mensagem no whatsapp pra Camila confirmando a reunião",
	}
	res := &AssistantResponse{}

	out, err := svc.actionSendWhatsAppMessage(context.Background(), "user-1", intent, input, res)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if waSender.sentMsg {
		t.Fatalf("REGRA DE OURO VIOLADA: WhatsApp enviado sem confirmação expressa prévia!")
	}
	if out.WhatsAppMessage == nil {
		t.Fatalf("esperava card out.WhatsAppMessage preenchido, recebeu nil")
	}
	if out.WhatsAppMessage.Status != "ready" {
		t.Errorf("esperava status 'ready', recebeu %q", out.WhatsAppMessage.Status)
	}
	if !strings.Contains(out.Message, "Posso enviar?") {
		t.Errorf("esperava mensagem perguntando 'Posso enviar?', recebeu %q", out.Message)
	}
}

func TestAssistant_SendWhatsApp_WithExplicitApproval_SendsAndMarksSent(t *testing.T) {
	waSender := &fakeWASender{}
	dir := NewWhatsAppDirectoryService(nil, DefaultWhatsAppContextConfig(), nil)
	dir.SetContactRepository(&mockSyncedContactRepo{
		contacts: []domain.SyncedContact{
			{UserID: "user-1", Phone: "+5511999999999", PhoneDigits: "5511999999999", SavedName: "Camila"},
		},
	})

	svc := &AssistantService{
		waSender:    waSender,
		waDirectory: dir,
	}

	intent := &ai.ParsedIntent{
		Action: ai.ActionSendWhatsAppMessage,
		WhatsAppMessage: &ai.ParsedWhatsAppMessage{
			Chat: "Camila",
			Text: "Oi Camila, confirmando nossa reunião.",
		},
	}

	input := ai.UserInput{
		Text: "sim, pode enviar",
		ConversationHistory: []ai.ChatMessageContext{
			{Sender: "vito", Text: "Preparei a mensagem para Camila. Posso enviar?"},
		},
	}
	res := &AssistantResponse{}

	out, err := svc.actionSendWhatsAppMessage(context.Background(), "user-1", intent, input, res)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !waSender.sentMsg {
		t.Fatalf("esperava envio de WhatsApp após aprovação expressa!")
	}
	if out.WhatsAppMessage == nil || out.WhatsAppMessage.Status != "sent" {
		t.Errorf("esperava status 'sent', recebeu %+v", out.WhatsAppMessage)
	}
}
