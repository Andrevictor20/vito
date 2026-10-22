package service_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
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

// TestAssistantService_AprendeApelidoQuandoUsuarioConfirma
//
// Fluxo completo: o Vito não conhece "isa" → pergunta → o usuário responde
// "a Bella" → o Vito resolve Bella e APRENDE que Isa é Bella.
func TestAssistantService_AprendeApelidoQuandoUsuarioConfirma(t *testing.T) {
	ctx := context.Background()
	dir, _, cleanup := setupDiretorioComNomes(t, "bella", "bella")
	defer cleanup()

	ast := service.NewAssistantService(&mockGatewayIntent{intent: &ai.ParsedIntent{
		Action:       ai.ActionQueryConversation,
		Conversation: &ai.ParsedConversationQuery{Chat: "isa"},
		Message:      "o que ela mandou?",
	}}, nil, nil, nil)
	ast.SetWhatsAppDirectory(dir)

	// 1ª rodada: "isa" não existe → o Vito pergunta.
	res, err := ast.Process(ctx, "user-dir-1", ai.UserInput{Text: "o que a isa mandou?"})
	if err != nil {
		t.Fatalf("Process falhou: %v", err)
	}
	if res.Message == "" {
		t.Fatal("esperava uma resposta de esclarecimento")
	}

	// 2ª rodada: o usuário confirma ("a Bella") → o Vito resolve.
	gateway, ok := ast.AIGatewayForTest().(*mockGatewayIntent)
	if !ok {
		t.Fatal("esperava o gateway de teste")
	}
	gateway.intent = &ai.ParsedIntent{
		Action:       ai.ActionQueryConversation,
		Conversation: &ai.ParsedConversationQuery{Chat: "bella"},
		Message:      "o que ela mandou?",
	}
	if _, err := ast.Process(ctx, "user-dir-1", ai.UserInput{Text: "é a bella"}); err != nil {
		t.Fatalf("Process (2ª rodada) falhou: %v", err)
	}

	// O apelido aprendido precisa resolver na próxima consulta.
	chat, err := dir.ResolveChat(ctx, "user-dir-1", "isa")
	if err != nil {
		t.Fatalf("o apelido deveria ter sido aprendido: %v", err)
	}
	if chat.ChatJID != jidIsaSalvo {
		t.Errorf("esperava o chat %q, obteve %q", jidIsaSalvo, chat.ChatJID)
	}
}

// mockGatewayIntent devolve a intenção configurada (mutável entre rodadas).
type mockGatewayIntent struct {
	intent *ai.ParsedIntent
}

func (m *mockGatewayIntent) ParseIntent(ctx context.Context, input ai.UserInput) (*ai.ParsedIntent, error) {
	if m.intent == nil {
		return &ai.ParsedIntent{Action: ai.ActionGeneralChat, Message: "ok"}, nil
	}
	res := *m.intent
	res.ProviderUsed = "mock"
	return &res, nil
}

// novoShadowInboxDB cria um shadow inbox isolado.
func novoShadowInboxDB(t *testing.T, userID string) (*repository.WhatsAppConversationRepositorySQLite, func()) {
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
	repo := repository.NewWhatsAppConversationRepository(db)
	return repo, func() { _ = db.Close() }
}
