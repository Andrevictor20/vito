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

// intentGateway devolve uma intenção fixa e captura o input recebido.
type intentGateway struct {
	intent *ai.ParsedIntent
	inputs []ai.UserInput
}

func (m *intentGateway) ParseIntent(ctx context.Context, input ai.UserInput) (*ai.ParsedIntent, error) {
	m.inputs = append(m.inputs, input)
	return m.intent, nil
}

func (m *intentGateway) lastInput() ai.UserInput {
	if len(m.inputs) == 0 {
		return ai.UserInput{}
	}
	return m.inputs[len(m.inputs)-1]
}

// setupAssistantActions monta o assistente com o diretório de WhatsApp ligado.
func setupAssistantActions(t *testing.T, fx *contextualFixture, gateway *intentGateway) *service.AssistantService {
	t.Helper()
	astSvc := service.NewAssistantService(gateway, nil, nil, nil)
	dir := service.NewWhatsAppDirectoryService(fx.repo, service.DefaultWhatsAppContextConfig(), nil)
	astSvc.SetWhatsAppDirectory(dir)
	return astSvc
}

// QUERY_CONVERSATION: o Vito lê as mensagens REAIS da conversa e responde.
func TestAssistantActions_QueryConversationReadsRealMessages(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	now := time.Now().UTC()

	archiveChat(t, fx, "q1", friendJID(), domain.WhatsAppChatKindDirect, "Ana", "reuniao quinta as 10h", false, now.Add(-2*time.Hour))
	archiveChat(t, fx, "q2", friendJID(), domain.WhatsAppChatKindDirect, "Ana", "manda o contrato depois", false, now.Add(-time.Hour))

	gateway := &intentGateway{intent: &ai.ParsedIntent{
		Action:  ai.ActionQueryConversation,
		Message: "Vou olhar a conversa com a Ana.",
		Conversation: &ai.ParsedConversationQuery{
			Chat:  "Ana",
			Limit: 10,
		},
	}}
	astSvc := setupAssistantActions(t, fx, gateway)

	resp, err := astSvc.Process(context.Background(), "user-ctx-1", ai.UserInput{
		Text:                 "quais as ultimas mensagens que a Ana enviou?",
		Now:                  now,
		Timezone:             "America/Sao_Paulo",
		WhatsAppPrivateScope: true,
	})
	if err != nil {
		t.Fatalf("Process: %v", err)
	}

	// A 2ª chamada (resumo) recebe as mensagens reais como janela de contexto.
	var sawMessages bool
	for _, in := range gateway.inputs {
		for _, m := range in.ConversationWindow {
			if strings.Contains(m.Text, "reuniao quinta as 10h") {
				sawMessages = true
			}
		}
	}
	if !sawMessages {
		t.Errorf("a conversa real não chegou na janela do resumo: %+v", gateway.inputs)
	}
	if !strings.Contains(resp.Message, "Ana") {
		t.Errorf("a resposta não menciona a Ana: %q", resp.Message)
	}
}

// LIST_PENDING_CONVERSATIONS: lista as conversas que esperam resposta.
func TestAssistantActions_ListPendingConversations(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	now := time.Now().UTC()

	archiveChat(t, fx, "l1", friendJID(), domain.WhatsAppChatKindDirect, "Ana", "me ajuda com o contrato", false, now.Add(-30*time.Hour))
	archiveChat(t, fx, "l2", "5511888887778@s.whatsapp.net", domain.WhatsAppChatKindDirect, "João", "obrigado", true, now.Add(-20*time.Hour))

	gateway := &intentGateway{intent: &ai.ParsedIntent{
		Action:  ai.ActionListPendingConversations,
		Message: "Vou verificar.",
	}}
	astSvc := setupAssistantActions(t, fx, gateway)

	resp, err := astSvc.Process(context.Background(), "user-ctx-1", ai.UserInput{
		Text:                 "quem está me esperando?",
		Now:                  now,
		Timezone:             "America/Sao_Paulo",
		WhatsAppPrivateScope: true,
	})
	if err != nil {
		t.Fatalf("Process: %v", err)
	}
	if !strings.Contains(resp.Message, "Ana") {
		t.Errorf("esperava a Ana na lista de pendências, obteve %q", resp.Message)
	}
	if strings.Contains(resp.Message, "João") {
		t.Errorf("conversa já respondida não pode ser pendência: %q", resp.Message)
	}
}

// O diretório e as pendências só entram no prompt no escopo privado.
func TestAssistantActions_DirectoryOnlyInPrivateScope(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	now := time.Now().UTC()
	archiveChat(t, fx, "p1", friendJID(), domain.WhatsAppChatKindDirect, "Ana", "me ajuda", false, now.Add(-30*time.Hour))

	gateway := &intentGateway{intent: &ai.ParsedIntent{Action: ai.ActionGeneralChat, Message: "ok"}}
	astSvc := setupAssistantActions(t, fx, gateway)

	// Escopo privado (chat "Você" ou app): o diretório entra.
	if _, err := astSvc.Process(context.Background(), "user-ctx-1", ai.UserInput{
		Text: "quem está me esperando?", Now: now, Timezone: "America/Sao_Paulo", WhatsAppPrivateScope: true,
	}); err != nil {
		t.Fatalf("Process: %v", err)
	}
	if len(gateway.lastInput().ContactDirectory) == 0 {
		t.Error("esperava o diretório de contatos no escopo privado")
	}
	if len(gateway.lastInput().PendingConversations) == 0 {
		t.Error("esperava as pendências no escopo privado")
	}

	// Escopo de terceiro: NADA pode entrar (vazaria "a Ana te espera" para o João).
	if _, err := astSvc.Process(context.Background(), "user-ctx-1", ai.UserInput{
		Text: "quem está me esperando?", Now: now, Timezone: "America/Sao_Paulo", WhatsAppPrivateScope: false,
	}); err != nil {
		t.Fatalf("Process: %v", err)
	}
	if len(gateway.lastInput().ContactDirectory) != 0 {
		t.Errorf("o diretório NÃO pode entrar fora do escopo privado: %+v", gateway.lastInput().ContactDirectory)
	}
	if len(gateway.lastInput().PendingConversations) != 0 {
		t.Errorf("as pendências NÃO podem entrar fora do escopo privado")
	}
}
