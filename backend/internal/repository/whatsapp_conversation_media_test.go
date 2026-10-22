package repository

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
)

func novoShadowInboxTeste(t *testing.T) *WhatsAppConversationRepositorySQLite {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "shadow.db"))
	if err != nil {
		t.Fatalf("erro ao abrir banco de teste: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	// O shadow inbox tem FK para users(id): o usuário precisa existir.
	userRepo := NewUserRepository(db)
	if err := userRepo.Create(&domain.User{
		ID:        "u1",
		Email:     "u1@vito.local",
		Name:      "Teste",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}); err != nil {
		t.Fatalf("erro ao criar usuário de teste: %v", err)
	}
	return NewWhatsAppConversationRepository(db)
}

// TestPendingMediaOrdenaPorMaisAntigo trava a ordem do backlog de mídia e a
// idempotência do enriquecimento (mídia concluída não volta para a fila).
func TestPendingMediaOrdenaPorMaisAntigo(t *testing.T) {
	ctx := context.Background()
	repo := novoShadowInboxTeste(t)

	now := time.Now().UTC()
	ids := []string{"m3", "m1", "m2"}
	for i, id := range ids {
		ts := now.Add(-time.Duration(i+1) * time.Hour)
		err := repo.SaveMessage(ctx, &domain.WhatsAppConversationMessage{
			ID:               id,
			UserID:           "u1",
			InstanceName:     "inst",
			ChatJID:          "c1",
			ChatKind:         domain.WhatsAppChatKindSelf,
			Kind:             "image",
			MediaKind:        domain.WhatsAppMediaKindImage,
			MediaStatus:      domain.WhatsAppMediaStatusPending,
			MediaPayload:     `{"key":{"id":"x"}}`,
			MessageTimestamp: ts,
		})
		if err != nil {
			t.Fatalf("falha ao arquivar: %v", err)
		}
	}

	pending, err := repo.PendingMedia(ctx, "u1", 10, now.Add(-30*24*time.Hour))
	if err != nil {
		t.Fatalf("PendingMedia falhou: %v", err)
	}
	if len(pending) != 3 {
		t.Fatalf("esperava 3 mídias pendentes, obteve %d", len(pending))
	}
	if pending[0].ID != "m3" {
		t.Errorf("esperava a mais antiga primeiro (m3), obteve %s", pending[0].ID)
	}

	if err := repo.UpdateMediaResult(ctx, "u1", "m1", domain.WhatsAppMediaStatusDone, "uma foto de comida"); err != nil {
		t.Fatalf("UpdateMediaResult falhou: %v", err)
	}
	pending, err = repo.PendingMedia(ctx, "u1", 10, now.Add(-30*24*time.Hour))
	if err != nil {
		t.Fatalf("PendingMedia falhou: %v", err)
	}
	if len(pending) != 2 {
		t.Errorf("esperava 2 mídias pendentes após concluir uma, obteve %d", len(pending))
	}
	for _, m := range pending {
		if m.ID == "m1" {
			t.Error("mídia concluída não deveria voltar para o backlog")
		}
	}
}

// TestMediaStatusContaPorEstado alimenta a tela de contexto do WhatsApp.
func TestMediaStatusContaPorEstado(t *testing.T) {
	ctx := context.Background()
	repo := novoShadowInboxTeste(t)

	now := time.Now().UTC()
	for i, status := range []string{
		domain.WhatsAppMediaStatusPending,
		domain.WhatsAppMediaStatusDone,
		domain.WhatsAppMediaStatusFailed,
	} {
		err := repo.SaveMessage(ctx, &domain.WhatsAppConversationMessage{
			ID:               "s" + status,
			UserID:           "u1",
			InstanceName:     "inst",
			ChatJID:          "c1",
			ChatKind:         domain.WhatsAppChatKindSelf,
			Kind:             "image",
			MediaKind:        domain.WhatsAppMediaKindImage,
			MediaStatus:      status,
			MediaPayload:     `{"key":{"id":"x"}}`,
			MessageTimestamp: now.Add(-time.Duration(i) * time.Minute),
		})
		if err != nil {
			t.Fatalf("falha ao arquivar: %v", err)
		}
	}

	counts, err := repo.MediaStatus(ctx, "u1", now.Add(-30*24*time.Hour))
	if err != nil {
		t.Fatalf("MediaStatus falhou: %v", err)
	}
	if counts[domain.WhatsAppMediaStatusPending] != 1 ||
		counts[domain.WhatsAppMediaStatusDone] != 1 ||
		counts[domain.WhatsAppMediaStatusFailed] != 1 {
		t.Errorf("contagem de mídias incorreta: %v", counts)
	}
}

// TestSearchMessagesEncontraPorTermoEBuscaNaMidia valida a busca full-text:
// o texto E a descrição da mídia são indexados.
func TestSearchMessagesEncontraPorTermoEBuscaNaMidia(t *testing.T) {
	ctx := context.Background()
	repo := novoShadowInboxTeste(t)

	now := time.Now().UTC()
	if err := repo.SaveMessage(ctx, &domain.WhatsAppConversationMessage{
		ID:               "busca-1",
		UserID:           "u1",
		InstanceName:     "inst",
		ChatJID:          "c1",
		ChatKind:         domain.WhatsAppChatKindSelf,
		Kind:             "text",
		Text:             "a Ana me mandou o contrato do apartamento",
		MessageTimestamp: now.Add(-2 * time.Hour),
	}); err != nil {
		t.Fatalf("falha ao arquivar: %v", err)
	}
	if err := repo.SaveMessage(ctx, &domain.WhatsAppConversationMessage{
		ID:               "busca-2",
		UserID:           "u1",
		InstanceName:     "inst",
		ChatJID:          "c1",
		ChatKind:         domain.WhatsAppChatKindSelf,
		Kind:             "image",
		MediaKind:        domain.WhatsAppMediaKindImage,
		MediaStatus:      domain.WhatsAppMediaStatusDone,
		MediaText:        "recibo de energia elétrica de R$ 180,00",
		MediaPayload:     `{"key":{"id":"x"}}`,
		MessageTimestamp: now.Add(-3 * time.Hour),
	}); err != nil {
		t.Fatalf("falha ao arquivar: %v", err)
	}

	found, err := repo.SearchMessages(ctx, "u1", "contrato", 5)
	if err != nil {
		t.Fatalf("SearchMessages falhou: %v", err)
	}
	if len(found) == 0 {
		t.Fatal("esperava encontrar a mensagem pelo termo 'contrato'")
	}
	if found[0].ID != "busca-1" {
		t.Errorf("esperava a mensagem do contrato, obteve %s", found[0].ID)
	}

	found, err = repo.SearchMessages(ctx, "u1", "energia", 5)
	if err != nil {
		t.Fatalf("SearchMessages falhou: %v", err)
	}
	if len(found) == 0 {
		t.Fatal("esperava encontrar a mídia pela descrição ('energia')")
	}
	if found[0].ID != "busca-2" {
		t.Errorf("esperava a imagem do recibo, obteve %s", found[0].ID)
	}
}

// TestMessageByIDResolveACitada cobre a resolução da mensagem marcada.
func TestMessageByIDResolveACitada(t *testing.T) {
	ctx := context.Background()
	repo := novoShadowInboxTeste(t)

	if err := repo.SaveMessage(ctx, &domain.WhatsAppConversationMessage{
		ID:               "cit-1",
		UserID:           "u1",
		InstanceName:     "inst",
		ChatJID:          "c1",
		ChatKind:         domain.WhatsAppChatKindSelf,
		Kind:             "image",
		MediaKind:        domain.WhatsAppMediaKindImage,
		MediaStatus:      domain.WhatsAppMediaStatusDone,
		MediaText:        "foto do contrato assinado",
		MessageTimestamp: time.Now().UTC(),
	}); err != nil {
		t.Fatalf("falha ao arquivar: %v", err)
	}

	msg, err := repo.MessageByID(ctx, "u1", "cit-1")
	if err != nil {
		t.Fatalf("MessageByID falhou: %v", err)
	}
	if msg == nil {
		t.Fatal("esperava encontrar a mensagem citada")
	}
	if msg.MediaText != "foto do contrato assinado" {
		t.Errorf("esperava a descrição da mídia, obteve %q", msg.MediaText)
	}

	// Isolamento por usuário: a mesma id de outro usuário não é acessível.
	msg, err = repo.MessageByID(ctx, "outro", "cit-1")
	if err != nil {
		t.Fatalf("MessageByID falhou: %v", err)
	}
	if msg != nil {
		t.Error("mensagem de outro usuário não deveria ser acessível")
	}
}
