package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

func TestDeduplicateCandidates_MesmoNomeDiferentesJIDsNaoGeraLoop(t *testing.T) {
	now := time.Now().UTC()
	matches := []domain.WhatsAppChatSummary{
		{
			ChatJID:    "5521999999999@s.whatsapp.net",
			ChatLabel:  "Bella",
			ChatKind:   domain.WhatsAppChatKindDirect,
			LastAt:     now.Add(-10 * time.Minute),
			LastText:   "oi",
			LastFromMe: false,
		},
		{
			ChatJID:    "471331507024120@lid",
			ChatLabel:  "Bella",
			ChatKind:   domain.WhatsAppChatKindDirect,
			LastAt:     now.Add(-2 * time.Minute), // mais recente
			LastText:   "já baixou?",
			LastFromMe: true,
		},
	}

	best, err := service.DeduplicateCandidates("Bella", matches, func(c domain.WhatsAppChatSummary) string {
		return c.ChatLabel
	})

	if err != nil {
		t.Fatalf("não esperava erro de ambiguidade quando todos os matches têm o mesmo nome: %v", err)
	}
	if best == nil {
		t.Fatal("esperava um match selecionado")
	}
	// Deve preferir o mais recente ou o JID @s.whatsapp.net válido
	if best.ChatLabel != "Bella" {
		t.Errorf("esperava label Bella, obteve %q", best.ChatLabel)
	}
}

func TestDeduplicateCandidates_NomesDistintosRetornaAmbiguidadeSemRepeticao(t *testing.T) {
	now := time.Now().UTC()
	matches := []domain.WhatsAppChatSummary{
		{
			ChatJID:   "1@s.whatsapp.net",
			ChatLabel: "Ana",
			ChatKind:  domain.WhatsAppChatKindDirect,
			LastAt:    now,
		},
		{
			ChatJID:   "2@s.whatsapp.net",
			ChatLabel: "Ana Souza",
			ChatKind:  domain.WhatsAppChatKindDirect,
			LastAt:    now,
		},
		{
			ChatJID:   "3@lid",
			ChatLabel: "Ana", // mesmo nome que o primeiro
			ChatKind:  domain.WhatsAppChatKindDirect,
			LastAt:    now,
		},
	}

	best, err := service.DeduplicateCandidates("Ana", matches, func(c domain.WhatsAppChatSummary) string {
		return c.ChatLabel
	})

	if err == nil {
		t.Fatal("esperava erro de ambiguidade para Ana vs Ana Souza")
	}
	if best != nil {
		t.Fatal("não deveria retornar best em caso de ambiguidade")
	}

	ambiguous, ok := err.(*service.ErrAmbiguousChat)
	if !ok {
		t.Fatalf("esperava *service.ErrAmbiguousChat, obteve %T", err)
	}

	// Não deve ter "Ana" repetido!
	if len(ambiguous.Candidates) != 2 {
		t.Fatalf("esperava 2 candidatos únicos (Ana e Ana Souza), obteve %v", ambiguous.Candidates)
	}
	if ambiguous.Candidates[0] != "Ana" || ambiguous.Candidates[1] != "Ana Souza" {
		t.Errorf("candidatos inesperados: %v", ambiguous.Candidates)
	}
}

func TestWhatsAppDirectory_ResolveChatComDuplicataDeNomeSelecionaChatSemTravar(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	now := time.Now().UTC()
	dir := service.NewWhatsAppDirectoryService(fx.repo, service.DefaultWhatsAppContextConfig(), nil)

	// Duas conversas com o mesmo nome "Bella" no banco (ex: um @s.whatsapp.net e um @lid)
	archiveChat(t, fx, "b1", "5521999999999@s.whatsapp.net", domain.WhatsAppChatKindDirect, "Bella", "oi", false, now.Add(-time.Hour))
	archiveChat(t, fx, "b2", "471331507024120@lid", domain.WhatsAppChatKindDirect, "Bella", "já baixou?", false, now)

	// Resolver "Bella" deve funcionar imediatamente sem erro de "Você quer dizer bella ou bella?"
	chat, err := dir.ResolveChat(context.Background(), "user-ctx-1", "Bella")
	if err != nil {
		t.Fatalf("ResolveChat('Bella') falhou com erro: %v", err)
	}
	if chat == nil {
		t.Fatal("esperava chat resolvido")
	}
	if chat.ChatLabel != "Bella" {
		t.Errorf("esperava ChatLabel 'Bella', obteve %q", chat.ChatLabel)
	}
}

