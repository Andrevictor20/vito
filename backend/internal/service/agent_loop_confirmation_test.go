package service_test

import (
	"context"
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

type mockWhatsAppSenderService struct {
	sentMessage bool
	sentPhone   string
	sentText    string
}

func (m *mockWhatsAppSenderService) SendMessage(ctx context.Context, userID, phone, message string) error {
	m.sentMessage = true
	m.sentPhone = phone
	m.sentText = message
	return nil
}

func (m *mockWhatsAppSenderService) SearchMessages(ctx context.Context, userID, query string, limit int) ([]domain.WhatsAppConversationMessage, error) {
	return nil, nil
}

func (m *mockWhatsAppSenderService) RecentChats(ctx context.Context, userID string) ([]ai.ChatContactSummary, error) {
	return nil, nil
}

type mockGmailSenderService struct {
	sentEmail   bool
	sentTo      string
	sentSubject string
	sentBody    string
}

func (m *mockGmailSenderService) SendEmail(ctx context.Context, userID, to, subject, body string) error {
	m.sentEmail = true
	m.sentTo = to
	m.sentSubject = subject
	m.sentBody = body
	return nil
}

func (m *mockGmailSenderService) CreateDraft(ctx context.Context, userID, to, subject, body string) error {
	return nil
}

func (m *mockGmailSenderService) ScanEmails(ctx context.Context, userID string) (*domain.GmailScanResult, error) {
	return nil, nil
}

func setupConfirmationTestEnv(t *testing.T, responses []*ai.AgentChatResponse, waSvc toolsets.WhatsAppServiceContract, gmSvc toolsets.GmailServiceContract) (*service.AgentLoop, string, string) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_confirmation_loop.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("falha ao abrir db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	userID := "user-confirm-1"
	_ = userRepo.Create(&domain.User{
		ID:        userID,
		Name:      "André Valente",
		Email:     "andre@example.com",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})

	convRepo := repository.NewConversationStoreRepository(db)
	thread, _ := convRepo.GetOrCreateThread(context.Background(), userID, "app_mobile", "")

	mockProv := &mockLoopProvider{responses: responses}
	router := ai.NewModelRouter(mockProv)
	guard := service.NewScopeGuard()
	gate := service.NewConfirmationGateService(db)

	registry := toolsets.NewToolsetsRegistry()
	registry.Register(toolsets.NewWhatsAppToolset(waSvc))
	registry.Register(toolsets.NewGmailToolset(gmSvc))

	loop := service.NewAgentLoop(router, registry, guard, gate, convRepo, nil)
	return loop, userID, thread.ID
}

// TestAgentLoop_WhatsAppConfirmationFlow testa a suspensão com card pronto e a execução real após 'sim, pode enviar'.
func TestAgentLoop_WhatsAppConfirmationFlow(t *testing.T) {
	waMock := &mockWhatsAppSenderService{}

	// Turno 1: LLM decide chamar whatsapp_manager.send_message
	args, _ := json.Marshal(map[string]any{
		"operation": "send_message",
		"params": map[string]any{
			"recipient": "Carlos",
			"message":   "Chego em 15 minutos.",
		},
	})
	toolCall := ai.ToolCall{
		ID:        "call-wa-1",
		Name:      string(domain.ToolsetWhatsApp),
		Arguments: args,
	}
	step0 := &ai.AgentChatResponse{
		Text:         "Vou preparar a mensagem para Carlos.",
		ToolCalls:    []ai.ToolCall{toolCall},
		ProviderName: "mock-gemini",
		ModelName:    "gemini-2.5-flash",
	}

	loop, userID, threadID := setupConfirmationTestEnv(t, []*ai.AgentChatResponse{step0}, waMock, nil)

	// Dispara o comando inicial
	req1 := domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: threadID,
		Channel:  "voice",
		Message:  "Manda um WhatsApp pro Carlos avisando que chego em 15 minutos",
	}
	res1, err := loop.Run(context.Background(), req1)
	if err != nil {
		t.Fatalf("Turno 1 falhou: %v", err)
	}

	// 1. Deve suspender sem enviar nada
	if waMock.sentMessage {
		t.Fatalf("REGRA DE OURO VIOLADA: WhatsApp disparado sem confirmação prévia!")
	}
	if !res1.RequiresConfirmation {
		t.Errorf("esperava RequiresConfirmation=true, obteve false")
	}
	if res1.PendingConfirmationID == "" {
		t.Errorf("esperava PendingConfirmationID preenchido")
	}
	if !strings.Contains(res1.Text, "Posso enviar?") {
		t.Errorf("esperava pergunta 'Posso enviar?', obteve: %q", res1.Text)
	}
	if res1.WhatsAppMessage == nil || res1.WhatsAppMessage.Status != "ready" {
		t.Errorf("esperava WhatsAppMessage com status 'ready', obteve: %+v", res1.WhatsAppMessage)
	}

	// Turno 2: Usuário responde 'Sim, pode enviar' por voz ou chat
	req2 := domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: threadID,
		Channel:  "voice",
		Message:  "Sim, pode enviar",
	}
	res2, err := loop.Run(context.Background(), req2)
	if err != nil {
		t.Fatalf("Turno 2 (confirmação) falhou: %v", err)
	}

	// 2. Agora DEVE ter executado a ferramenta de verdade
	if !waMock.sentMessage {
		t.Fatalf("FALHA CRÍTICA: confirmação recebida mas SendMessage NÃO foi executado!")
	}
	if waMock.sentPhone != "Carlos" || waMock.sentText != "Chego em 15 minutos." {
		t.Errorf("conteúdo incorreto enviado: phone=%q text=%q", waMock.sentPhone, waMock.sentText)
	}
	if res2.RequiresConfirmation {
		t.Errorf("RequiresConfirmation deveria ser false após resolução")
	}
	if res2.WhatsAppMessage == nil || res2.WhatsAppMessage.Status != "sent" {
		t.Errorf("esperava WhatsAppMessage com status 'sent', obteve: %+v", res2.WhatsAppMessage)
	}
}

// TestAgentLoop_WhatsAppCancellationFlow valida cancelamento limpo sem envio.
func TestAgentLoop_WhatsAppCancellationFlow(t *testing.T) {
	waMock := &mockWhatsAppSenderService{}

	args, _ := json.Marshal(map[string]any{
		"operation": "send_message",
		"params": map[string]any{
			"recipient": "Isa",
			"message":   "Oi Isa!",
		},
	})
	step0 := &ai.AgentChatResponse{
		Text:         "Preparando...",
		ToolCalls:    []ai.ToolCall{{ID: "call-wa-2", Name: string(domain.ToolsetWhatsApp), Arguments: args}},
		ProviderName: "mock-gemini",
		ModelName:    "gemini-2.5-flash",
	}

	loop, userID, threadID := setupConfirmationTestEnv(t, []*ai.AgentChatResponse{step0}, waMock, nil)

	req1 := domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: threadID,
		Channel:  "app_mobile",
		Message:  "Manda mensagem pra Isa dizendo Oi Isa!",
	}
	_, err := loop.Run(context.Background(), req1)
	if err != nil {
		t.Fatalf("Turno 1 falhou: %v", err)
	}

	// Usuário cancela: "Não, cancela"
	req2 := domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: threadID,
		Channel:  "app_mobile",
		Message:  "Não, cancela isso",
	}
	res2, err := loop.Run(context.Background(), req2)
	if err != nil {
		t.Fatalf("Turno 2 falhou: %v", err)
	}

	if waMock.sentMessage {
		t.Fatalf("ERRO: mensagem foi enviada mesmo após cancelamento explícito!")
	}
	if !strings.Contains(strings.ToLower(res2.Text), "cancelad") {
		t.Errorf("esperava mensagem confirmando cancelamento, obteve: %q", res2.Text)
	}
}

// TestAgentLoop_GmailConfirmationFlow valida suspensão e envio real de e-mail após aprovação.
func TestAgentLoop_GmailConfirmationFlow(t *testing.T) {
	gmMock := &mockGmailSenderService{}

	args, _ := json.Marshal(map[string]any{
		"operation": "send_email",
		"params": map[string]any{
			"to":      "contato@empresa.com",
			"subject": "Reunião de Alinhamento",
			"body":    "Segue a pauta da reunião.",
		},
	})
	step0 := &ai.AgentChatResponse{
		Text:         "Preparando e-mail...",
		ToolCalls:    []ai.ToolCall{{ID: "call-gm-1", Name: string(domain.ToolsetGmail), Arguments: args}},
		ProviderName: "mock-gemini",
		ModelName:    "gemini-2.5-flash",
	}

	loop, userID, threadID := setupConfirmationTestEnv(t, []*ai.AgentChatResponse{step0}, nil, gmMock)

	req1 := domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: threadID,
		Channel:  "voice",
		Message:  "Envia um email para contato@empresa.com com assunto Reunião de Alinhamento",
	}
	res1, err := loop.Run(context.Background(), req1)
	if err != nil {
		t.Fatalf("Turno 1 falhou: %v", err)
	}

	if gmMock.sentEmail {
		t.Fatalf("REGRA DE OURO VIOLADA: E-mail enviado sem confirmação expressa!")
	}
	if res1.GmailMessage == nil || res1.GmailMessage.Status != "ready" {
		t.Errorf("esperava GmailMessage pronto, obteve: %+v", res1.GmailMessage)
	}

	// Usuário confirma por ID pendente (ex: clique no card do app)
	req2 := domain.UnifiedAssistantRequest{
		UserID:           userID,
		ThreadID:         threadID,
		Channel:          "voice",
		ConfirmPendingID: res1.PendingConfirmationID,
	}
	res2, err := loop.Run(context.Background(), req2)
	if err != nil {
		t.Fatalf("Turno 2 falhou: %v", err)
	}

	if !gmMock.sentEmail {
		t.Fatalf("FALHA CRÍTICA: e-mail não enviado após confirmação via ConfirmPendingID!")
	}
	if gmMock.sentTo != "contato@empresa.com" || gmMock.sentSubject != "Reunião de Alinhamento" {
		t.Errorf("destinatário ou assunto incorreto: to=%s subj=%s", gmMock.sentTo, gmMock.sentSubject)
	}
	if res2.GmailMessage == nil || res2.GmailMessage.Status != "sent" {
		t.Errorf("esperava GmailMessage com status 'sent', obteve: %+v", res2.GmailMessage)
	}
}

// TestAgentLoop_ExplicitSendNow_ExecutesInTurn1 valida envio direto com 'agora'.
func TestAgentLoop_ExplicitSendNow_ExecutesInTurn1(t *testing.T) {
	waMock := &mockWhatsAppSenderService{}

	args, _ := json.Marshal(map[string]any{
		"operation": "send_message",
		"params": map[string]any{
			"recipient": "Carlos",
			"message":   "Cheguei!",
		},
	})
	step0 := &ai.AgentChatResponse{
		Text:         "Enviando...",
		ToolCalls:    []ai.ToolCall{{ID: "call-wa-now", Name: string(domain.ToolsetWhatsApp), Arguments: args}},
		ProviderName: "mock-gemini",
		ModelName:    "gemini-2.5-flash",
	}

	loop, userID, threadID := setupConfirmationTestEnv(t, []*ai.AgentChatResponse{step0}, waMock, nil)

	req := domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: threadID,
		Channel:  "voice",
		Message:  "Manda agora mensagem WhatsApp para Carlos: Cheguei!",
	}
	res, err := loop.Run(context.Background(), req)
	if err != nil {
		t.Fatalf("erro no loop: %v", err)
	}

	if !waMock.sentMessage {
		t.Fatalf("esperava envio imediato com 'agora' no comando!")
	}
	if res.RequiresConfirmation {
		t.Errorf("não deveria requerer confirmação se o comando já incluiu 'agora'")
	}
}
