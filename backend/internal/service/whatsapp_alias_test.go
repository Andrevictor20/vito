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

// Bug Isa -> Pai: O Vito NUNCA pode aprender apelido se o usuário simplesmente
// mudou de assunto e perguntou por outro contato em vez de desambiguar.
func TestAssistantService_NaoAprendeApelidoQuandoUsuarioPerguntaOutroContato(t *testing.T) {
	ctx := context.Background()
	dir, convRepo, cleanup := setupDiretorioComNomes(t, "bella", "bella")
	defer cleanup()

	// Adiciona a conversa do Pai
	jidPai := "5511988887777@s.whatsapp.net"
	now := time.Now().UTC()
	if err := convRepo.SaveMessage(ctx, &domain.WhatsAppConversationMessage{
		ID: "dir-msg-pai", UserID: "user-dir-1", InstanceName: "inst",
		ChatJID: jidPai, ChatKind: domain.WhatsAppChatKindDirect,
		ChatLabel: "Pai", SenderName: "Pai", Kind: "text",
		Text: "bênção meu filho", MessageTimestamp: now,
	}); err != nil {
		t.Fatalf("falha ao arquivar mensagem do Pai: %v", err)
	}

	ast := service.NewAssistantService(&mockGatewayIntent{intent: &ai.ParsedIntent{
		Action:       ai.ActionQueryConversation,
		Conversation: &ai.ParsedConversationQuery{Chat: "isa"},
		Message:      "o que ela mandou?",
	}}, nil, nil, nil)
	ast.SetWhatsAppDirectory(dir)

	// 1ª rodada: "isa" não existe → o Vito pergunta quem é.
	res, err := ast.Process(ctx, "user-dir-1", ai.UserInput{Text: "o que a isa mandou?"})
	if err != nil {
		t.Fatalf("Process falhou: %v", err)
	}
	if res.Message == "" {
		t.Fatal("esperava resposta pedindo esclarecimento")
	}

	// 2ª rodada: o usuário NÃO desambiguou! Ele perguntou sobre OUTRO contato ("o que o Pai mandou?")
	gateway, ok := ast.AIGatewayForTest().(*mockGatewayIntent)
	if !ok {
		t.Fatal("esperava o gateway de teste")
	}
	gateway.intent = &ai.ParsedIntent{
		Action:       ai.ActionQueryConversation,
		Conversation: &ai.ParsedConversationQuery{Chat: "Pai"},
		Message:      "o que ele mandou?",
	}
	if _, err := ast.Process(ctx, "user-dir-1", ai.UserInput{Text: "o que o Pai mandou?"}); err != nil {
		t.Fatalf("Process (2ª rodada) falhou: %v", err)
	}

	// O apelido "isa" NUNCA pode ter sido aprendido apontando para o Pai!
	_, err = dir.ResolveChat(ctx, "user-dir-1", "isa")
	if err == nil {
		t.Fatal("ERRO GRAVE: 'isa' foi indevidamente associada ao Pai!")
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
