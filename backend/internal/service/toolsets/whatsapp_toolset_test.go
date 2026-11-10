package toolsets_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

type mockWhatsAppService struct {
	sentUser    string
	sentPhone   string
	sentMsg     string
	mockMsgs    []domain.WhatsAppConversationMessage
	mockChats   []ai.ChatContactSummary
}

func (m *mockWhatsAppService) SendMessage(ctx context.Context, userID, phone, message string) error {
	m.sentUser = userID
	m.sentPhone = phone
	m.sentMsg = message
	return nil
}

func (m *mockWhatsAppService) SearchMessages(ctx context.Context, userID, query string, limit int) ([]domain.WhatsAppConversationMessage, error) {
	return m.mockMsgs, nil
}

func (m *mockWhatsAppService) RecentChats(ctx context.Context, userID string) ([]ai.ChatContactSummary, error) {
	return m.mockChats, nil
}

func TestWhatsAppToolset_SearchMessages_ReturnsRealContent(t *testing.T) {
	svc := &mockWhatsAppService{
		mockMsgs: []domain.WhatsAppConversationMessage{
			{
				ID:         "msg-1",
				SenderName: "Carlos",
				Text:       "Segue a proposta de orçamento em anexo",
				CreatedAt:  time.Now(),
			},
		},
	}
	ts := toolsets.NewWhatsAppToolset(svc)

	execCtx := &domain.ToolExecutionContext{
		UserID: "user-test-wa",
	}

	params, _ := json.Marshal(map[string]any{"query": "orçamento"})
	res, err := ts.Execute(context.Background(), execCtx, "search_messages", params)
	if err != nil {
		t.Fatalf("falha ao executar busca no whatsapp: %v", err)
	}

	if !strings.Contains(res.SummaryForLLM, "Carlos") || !strings.Contains(res.SummaryForLLM, "proposta de orçamento") {
		t.Errorf("SummaryForLLM deve conter as mensagens reais encontradas: %s", res.SummaryForLLM)
	}
	if !res.MarksContextAsTainted {
		t.Errorf("Mensagens externas devem marcar contexto como tainted")
	}
}

func TestWhatsAppToolset_RecentChats_ReturnsContacts(t *testing.T) {
	svc := &mockWhatsAppService{
		mockChats: []ai.ChatContactSummary{
			{
				Name:    "Maria Silva",
				Preview: "Podemos falar amanhã?",
			},
		},
	}
	ts := toolsets.NewWhatsAppToolset(svc)

	execCtx := &domain.ToolExecutionContext{
		UserID: "user-test-wa",
	}

	res, err := ts.Execute(context.Background(), execCtx, "recent_chats", nil)
	if err != nil {
		t.Fatalf("falha ao listar conversas recentes: %v", err)
	}

	if !strings.Contains(res.SummaryForLLM, "Maria Silva") || !strings.Contains(res.SummaryForLLM, "Podemos falar amanhã?") {
		t.Errorf("SummaryForLLM deve conter as conversas recentes: %s", res.SummaryForLLM)
	}
}
