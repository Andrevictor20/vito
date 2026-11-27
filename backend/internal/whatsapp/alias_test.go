package whatsapp_test

import (
	"context"
	"github.com/andrevmp/vito/backend/internal/whatsapp"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/repository"
)

// TestWhatsAppDirectory_AliasAprendidoResolveContato
//
// Os chats @lid têm identificador opaco (não casam com telefone) e a Evolution
// não expõe a agenda — então o único jeito de o Vito reconhecer "isa" é o
// próprio usuário dizer uma vez a quem o Vito se refere.
func TestWhatsAppDirectory_AliasAprendidoResolveContato(t *testing.T) {
	ctx := context.Background()
	dir, convRepo, cleanup := setupDiretorioComNomes(t, "bella", "bella")
	defer cleanup()
	_ = convRepo

	// Antes de aprender, "isa" não resolve.
	if _, err := dir.ResolveChat(ctx, "user-dir-1", "isa"); err == nil {
		t.Fatal("esperava falha ao resolver um nome desconhecido")
	}

	// O usuário diz a quem se refere → o Vito aprende o apelido.
	if err := dir.SaveAlias(ctx, "user-dir-1", jidIsaSalvo, "isa"); err != nil {
		t.Fatalf("SaveAlias falhou: %v", err)
	}

	chat, err := dir.ResolveChat(ctx, "user-dir-1", "isa")
	if err != nil {
		t.Fatalf("o apelido aprendido deveria resolver o contato: %v", err)
	}
	if chat.ChatJID != jidIsaSalvo {
		t.Errorf("esperava o chat %q, obteve %q", jidIsaSalvo, chat.ChatJID)
	}
}

// Filtra e rejeita apelidos que coincidem com contatos reais existentes.
func TestWhatsAppDirectory_FiltraELimpaApelidosCoincidentesComContatosReais(t *testing.T) {
	ctx := context.Background()
	dir, convRepo, cleanup := setupDiretorioComNomes(t, "bella", "bella")
	defer cleanup()

	jidPai := "5511988887777@s.whatsapp.net"
	now := time.Now().UTC()
	if err := convRepo.SaveMessage(ctx, &domain.WhatsAppConversationMessage{
		ID: "dir-msg-pai-2", UserID: "user-dir-1", InstanceName: "inst",
		ChatJID: jidPai, ChatKind: domain.WhatsAppChatKindDirect,
		ChatLabel: "Pai", SenderName: "Pai", Kind: "text",
		Text: "oi", MessageTimestamp: now,
	}); err != nil {
		t.Fatalf("falha ao salvar: %v", err)
	}

	// Tentar salvar alias "Pai" para o chat da Isa/Bella deve ser ignorado/rejeitado
	// porque "Pai" é o nome de um contato real já existente.
	if err := dir.SaveAlias(ctx, "user-dir-1", jidIsaSalvo, "Pai"); err != nil {
		t.Fatalf("SaveAlias erro: %v", err)
	}

	// Se salvarmos diretamente no banco um alias espúrio "Pai" apontando para jidIsaSalvo:
	if err := convRepo.SaveAlias(ctx, "user-dir-1", jidIsaSalvo, "Pai"); err != nil {
		t.Fatalf("SaveAlias direto no repo: %v", err)
	}

	// Ao resolver "Pai", DEVE resolver para jidPai, e limpar o alias espúrio!
	chat, err := dir.ResolveChat(ctx, "user-dir-1", "Pai")
	if err != nil {
		t.Fatalf("ResolveChat falhou: %v", err)
	}
	if chat.ChatJID != jidPai {
		t.Fatalf("esperava resolver para jidPai (%s), mas resolveu para %s", jidPai, chat.ChatJID)
	}

	// O alias espúrio foi limpo do banco
	aliases, err := convRepo.AliasesByName(ctx, "user-dir-1", "Pai")
	if err != nil {
		t.Fatalf("AliasesByName: %v", err)
	}
	if len(aliases) > 0 {
		t.Errorf("o alias espúrio deveria ter sido limpo, mas ainda existem %d registros", len(aliases))
	}
}

// novoShadowInboxDB cria um shadow inbox isolado.
func novoShadowInboxDB(t *testing.T, userID string) (*whatsapp.WhatsAppConversationRepositorySQLite, func()) {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "alias.db"))
	if err != nil {
		t.Fatalf("erro ao abrir banco: %v", err)
	}
	userRepo := repository.NewUserRepository(db)
	if err := userRepo.Create(&domain.User{
		ID: userID, Email: userID + "@vito.local", Name: "Teste",
		CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
	}); err != nil {
		t.Fatalf("erro ao criar usuário: %v", err)
	}
	repo := whatsapp.NewWhatsAppConversationRepository(db)
	return repo, func() { _ = db.Close() }
}
