package service_test

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

// archiveChat grava uma mensagem de uma conversa qualquer.
func archiveChat(t *testing.T, fx *contextualFixture, id, chatJID, chatKind, label, text string, fromMe bool, ts time.Time) {
	t.Helper()
	if err := fx.repo.SaveMessage(context.Background(), &domain.WhatsAppConversationMessage{
		ID:               id,
		UserID:           "user-ctx-1",
		InstanceName:     "vito_ctx_user",
		ChatJID:          chatJID,
		ChatKind:         chatKind,
		ChatLabel:        label,
		SenderName:       "André",
		FromMe:           fromMe,
		Text:             text,
		MessageTimestamp: ts,
		CreatedAt:        ts,
	}); err != nil {
		t.Fatalf("SaveMessage: %v", err)
	}
}

// O diretório devolve uma linha por conversa, com a última mensagem.
func TestWhatsAppDirectory_ChatsSummarizesEachConversation(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	now := time.Now().UTC()
	dir := service.NewWhatsAppDirectoryService(fx.repo, service.DefaultWhatsAppContextConfig(), nil)

	archiveChat(t, fx, "d1", friendJID(), domain.WhatsAppChatKindDirect, "Ana", "oi", false, now.Add(-2*time.Hour))
	archiveChat(t, fx, "d2", friendJID(), domain.WhatsAppChatKindDirect, "Ana", "pode ser quinta?", false, now.Add(-time.Hour))
	archiveChat(t, fx, "d3", "471331507024120@lid", domain.WhatsAppChatKindDirect, "Contato", "oi tbm", false, now.Add(-3*time.Hour))

	chats, err := dir.Chats(context.Background(), "user-ctx-1")
	if err != nil {
		t.Fatalf("Chats: %v", err)
	}
	if len(chats) != 2 {
		t.Fatalf("esperava 2 conversas, obteve %d", len(chats))
	}
	for _, c := range chats {
		if c.ChatJID == friendJID() {
			if c.LastText != "pode ser quinta?" {
				t.Errorf("esperava a última mensagem da conversa, obteve %q", c.LastText)
			}
			if c.MessageCount != 2 {
				t.Errorf("esperava 2 mensagens na conversa, obteve %d", c.MessageCount)
			}
		}
	}
}

// Pendência = conversa direta cuja última mensagem NÃO é do usuário.
func TestWhatsAppDirectory_PendingOnlyDirectAndNotAnswered(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	now := time.Now().UTC()
	dir := service.NewWhatsAppDirectoryService(fx.repo, service.DefaultWhatsAppContextConfig(), nil)

	// 1) direta sem resposta => pendente
	archiveChat(t, fx, "p1", friendJID(), domain.WhatsAppChatKindDirect, "Ana", "me ajuda aqui", false, now.Add(-30*time.Hour))
	// 2) direta já respondida => não é pendente
	archiveChat(t, fx, "p2", "5511888887778@s.whatsapp.net", domain.WhatsAppChatKindDirect, "João", "beleza", false, now.Add(-40*time.Hour))
	archiveChat(t, fx, "p3", "5511888887778@s.whatsapp.net", domain.WhatsAppChatKindDirect, "João", "obrigado", true, now.Add(-39*time.Hour))
	// 3) grupo => fora do escopo
	archiveChat(t, fx, "p4", groupJID(), domain.WhatsAppChatKindGroup, "Grupo", "alguem me ajuda", false, now.Add(-30*time.Hour))
	// 4) o próprio "Você" => fora do escopo
	archiveChat(t, fx, "p5", selfJID(), domain.WhatsAppChatKindSelf, "Você", "oi", false, now.Add(-30*time.Hour))

	pending, err := dir.Pending(context.Background(), "user-ctx-1")
	if err != nil {
		t.Fatalf("Pending: %v", err)
	}
	if len(pending) != 1 {
		t.Fatalf("esperava 1 pendência, obteve %d: %+v", len(pending), pending)
	}
	if pending[0].ChatLabel != "Ana" {
		t.Errorf("esperava a pendência da Ana, obteve %q", pending[0].ChatLabel)
	}
}

// Resolver o nome do contato: exato, por JID e ambíguo.
func TestWhatsAppDirectory_ResolveChat(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	now := time.Now().UTC()
	dir := service.NewWhatsAppDirectoryService(fx.repo, service.DefaultWhatsAppContextConfig(), nil)

	archiveChat(t, fx, "r1", friendJID(), domain.WhatsAppChatKindDirect, "Ana", "oi", false, now)
	archiveChat(t, fx, "r2", "5511888887778@s.whatsapp.net", domain.WhatsAppChatKindDirect, "Ana Souza", "oi", false, now)

	chat, err := dir.ResolveChat(context.Background(), "user-ctx-1", "Ana Souza")
	if err != nil {
		t.Fatalf("ResolveChat: %v", err)
	}
	if chat.ChatJID != "5511888887778@s.whatsapp.net" {
		t.Errorf("resolveu para o JID errado: %q", chat.ChatJID)
	}

	// Nome exato com 2 conversas de mesmo rótulo => ambíguo.
	archiveChat(t, fx, "r3", "5511888887779@s.whatsapp.net", domain.WhatsAppChatKindDirect, "Ana", "oi", false, now)
	_, err = dir.ResolveChat(context.Background(), "user-ctx-1", "Ana")
	if err == nil {
		t.Fatal("esperava erro de ambiguidade")
	}
	var ambiguous *service.ErrAmbiguousChat
	if !asAmbiguous(err, &ambiguous) {
		t.Fatalf("esperava ErrAmbiguousChat, obteve %T", err)
	}
	if len(ambiguous.Candidates) != 2 {
		t.Errorf("esperava 2 candidatos, obteve %v", ambiguous.Candidates)
	}

	// Nome inexistente.
	_, err = dir.ResolveChat(context.Background(), "user-ctx-1", "Fulano")
	if err == nil {
		t.Fatal("esperava erro de não encontrado")
	}
}

// asAmbiguous evita importar errors no teste com o helper do serviço.
func asAmbiguous(err error, target **service.ErrAmbiguousChat) bool {
	if e, ok := err.(*service.ErrAmbiguousChat); ok {
		*target = e
		return true
	}
	return false
}

// As mensagens de uma conversa vêm do shadow inbox (não da janela).
func TestWhatsAppDirectory_MessagesOfReadsInbox(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	now := time.Now().UTC()
	dir := service.NewWhatsAppDirectoryService(fx.repo, service.DefaultWhatsAppContextConfig(), nil)

	for i := 0; i < 5; i++ {
		archiveChat(t, fx, fmt.Sprintf("m-%d", i), friendJID(), domain.WhatsAppChatKindDirect, "Ana",
			fmt.Sprintf("mensagem %d", i), false, now.Add(-time.Duration(i)*time.Minute))
	}

	messages, err := dir.MessagesOf(context.Background(), "user-ctx-1", friendJID(), 3)
	if err != nil {
		t.Fatalf("MessagesOf: %v", err)
	}
	if len(messages) != 3 {
		t.Fatalf("esperava 3 mensagens, obteve %d", len(messages))
	}
	// As mais recentes vêm primeiro (o repositório devolve em ordem cronológica).
	if !strings.Contains(messages[len(messages)-1].Text, "mensagem 0") {
		t.Errorf("esperava a mensagem mais antiga no fim, obteve %q", messages[len(messages)-1].Text)
	}
}
