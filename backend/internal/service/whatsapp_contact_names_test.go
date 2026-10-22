package service_test

import (
	"context"
	"database/sql"
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
)

// O caso real reportado: o contato está SALVO como "isa" no WhatsApp, mas a
// pessoa escolheu o nome de perfil "bella". O Vito só reconhecia "bella".
const (
	jidIsaSalvo   = "5511988887777@s.whatsapp.net"
	nomeSalvoIsa  = "isa"
	nomePerfilBel = "bella"
)

// TestWhatsAppContactsCache_GuardaOsDoisNomes: o cache precisa guardar o nome
// salvo E o nome de perfil — o antigo guardava só um e descartava o salvo.
func TestWhatsAppContactsCache_GuardaOsDoisNomes(t *testing.T) {
	cache := service.NewWhatsAppContactsCache(nil, time.Hour)
	cache.Set(jidIsaSalvo, nomeSalvoIsa, nomePerfilBel)

	if got := cache.Name(jidIsaSalvo); got != nomeSalvoIsa {
		t.Errorf("Name deveria devolver o nome SALVO (%q), obteve %q", nomeSalvoIsa, got)
	}
	if got := cache.ProfileName(jidIsaSalvo); got != nomePerfilBel {
		t.Errorf("ProfileName deveria devolver o nome de PERFIL (%q), obteve %q", nomePerfilBel, got)
	}
	if got := cache.Alias(jidIsaSalvo, nomeSalvoIsa); got != nomePerfilBel {
		t.Errorf("Alias deveria devolver o perfil quando o principal é o salvo, obteve %q", got)
	}
	if got := cache.Alias(jidIsaSalvo, nomePerfilBel); got != nomeSalvoIsa {
		t.Errorf("Alias deveria devolver o nome salvo quando o principal é o perfil, obteve %q", got)
	}
}

// TestWhatsAppContactsCache_NomeSalvoNumericoUsaPerfil: contato salvo só pelo
// telefone não pode virar rótulo ilegível.
func TestWhatsAppContactsCache_NomeSalvoNumericoUsaPerfil(t *testing.T) {
	cache := service.NewWhatsAppContactsCache(nil, time.Hour)
	cache.Set(jidIsaSalvo, "5511988887777", nomePerfilBel)

	if got := cache.Name(jidIsaSalvo); got != nomePerfilBel {
		t.Errorf("nome numérico deveria cair no nome de perfil, obteve %q", got)
	}
}

// TestWhatsAppDirectory_ExpoeOsDoisNomesNoDiretorio: o bloco SEUS CONTATOS
// precisa listar "isa (bella)".
func TestWhatsAppDirectory_ExpoeOsDoisNomesNoDiretorio(t *testing.T) {
	dir, convRepo, cleanup := setupDiretorioComNomes(t, nomeSalvoIsa, nomePerfilBel)
	defer cleanup()

	contatos, err := dir.Directory(context.Background(), "user-dir-1")
	if err != nil {
		t.Fatalf("Directory falhou: %v", err)
	}
	if len(contatos) == 0 {
		t.Fatal("esperava contatos no diretório")
	}
	var encontrado *ai.ChatContactSummary
	for i := range contatos {
		if contatos[i].Name == nomeSalvoIsa {
			encontrado = &contatos[i]
			break
		}
	}
	if encontrado == nil {
		t.Fatalf("esperava o contato com o nome salvo %q, diretório: %+v", nomeSalvoIsa, contatos)
	}
	if encontrado.Alias != nomePerfilBel {
		t.Errorf("esperava o alias %q, obteve %q", nomePerfilBel, encontrado.Alias)
	}
	_ = convRepo
}

// TestWhatsAppDirectory_ResolveChatAceitaSalvoEPerfil: "o que a isa mandou" e
// "o que a bella mandou" precisam achar o mesmo chat.
func TestWhatsAppDirectory_ResolveChatAceitaSalvoEPerfil(t *testing.T) {
	dir, _, cleanup := setupDiretorioComNomes(t, nomeSalvoIsa, nomePerfilBel)
	defer cleanup()

	for _, query := range []string{nomeSalvoIsa, nomePerfilBel, "ISA", "Isá"} {
		chat, err := dir.ResolveChat(context.Background(), "user-dir-1", query)
		if err != nil {
			t.Errorf("ResolveChat(%q) falhou: %v", query, err)
			continue
		}
		if chat.ChatJID != jidIsaSalvo {
			t.Errorf("ResolveChat(%q) achou o chat errado: %s", query, chat.ChatJID)
		}
	}
}

// TestPrompt_BlocoContatosMostraOsDoisNomes: o prompt precisa expor o alias.
func TestPrompt_BlocoContatosMostraOsDoisNomes(t *testing.T) {
	bloco := ai.ContactDirectoryBlock([]ai.ChatContactSummary{
		{Name: nomeSalvoIsa, Alias: nomePerfilBel, Age: "há 2h"},
	})
	if !strings.Contains(bloco, nomeSalvoIsa) {
		t.Errorf("o bloco deveria conter o nome salvo, obteve: %s", bloco)
	}
	if !strings.Contains(bloco, nomePerfilBel) {
		t.Errorf("o bloco deveria conter o nome de perfil (alias), obteve: %s", bloco)
	}
}

// TestWhatsAppService_RotuloDoUsaNomeSalvo: o chat arquivado é rotulado pelo
// nome salvo pelo dono, não pelo nome de perfil.
func TestWhatsAppService_RotuloDoUsaNomeSalvo(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)
	mockClient.mockContacts = []service.WhatsAppContact{
		{ID: jidIsaSalvo, Name: nomeSalvoIsa, PushName: nomePerfilBel, Number: "5511988887777"},
	}
	// Repopula o cache com o contato do caso real.
	cache := service.NewWhatsAppContactsCache(mockClient, time.Hour)
	if _, err := cache.Fetch(context.Background(), "vito_conv_user"); err != nil {
		t.Fatalf("erro ao popular o cache: %v", err)
	}
	svc.SetContactsCache(cache)

	gateway := &mockGatewayCapturador{}
	svc.SetAssistantService(service.NewAssistantService(gateway, nil, nil, nil))
	svc.SetAsyncRunner(func(fn func()) { fn() })

	// Mensagem recebida da pessoa (pushName = "bella").
	if err := svc.HandleWebhook(context.Background(), "messages.upsert",
		payloadComVito(jidIsaSalvo, "msg-rotulo-1", "oi, tudo bem?", false)); err != nil {
		t.Fatalf("HandleWebhook retornou erro: %v", err)
	}

	archived, err := svc.ContextMessageByID(context.Background(), "user-conv-1", "msg-rotulo-1")
	if err != nil {
		t.Fatalf("falha ao buscar a mensagem: %v", err)
	}
	if archived == nil {
		t.Fatal("mensagem não arquivada")
	}
	if archived.ChatLabel != nomeSalvoIsa {
		t.Errorf("o rótulo do chat deveria ser o nome salvo (%q), obteve %q", nomeSalvoIsa, archived.ChatLabel)
	}
}

// TestWhatsAppContactsCache_SetProfilePreservaOSalvo: o pushName visto nas
// mensagens completa o alias sem sobrescrever o nome salvo.
func TestWhatsAppContactsCache_SetProfilePreservaOSalvo(t *testing.T) {
	cache := service.NewWhatsAppContactsCache(nil, time.Hour)
	cache.Set(jidIsaSalvo, nomeSalvoIsa, "")
	cache.SetProfile(jidIsaSalvo, nomePerfilBel)

	if got := cache.Name(jidIsaSalvo); got != nomeSalvoIsa {
		t.Errorf("o nome salvo não pode ser sobrescrito pelo perfil, obteve %q", got)
	}
	if got := cache.ProfileName(jidIsaSalvo); got != nomePerfilBel {
		t.Errorf("esperava o perfil %q, obteve %q", nomePerfilBel, got)
	}
	if got := cache.Alias(jidIsaSalvo, nomeSalvoIsa); got != nomePerfilBel {
		t.Errorf("esperava o alias %q, obteve %q", nomePerfilBel, got)
	}
}

// openShadowInboxDB abre um shadow inbox isolado para os testes.
func openShadowInboxDB(t *testing.T) (*sql.DB, error) {
	t.Helper()
	return database.Open(filepath.Join(t.TempDir(), "dir.db"))
}

// setupDiretorioComNomes monta um diretório com um contato salvo como "saved" e
// de perfil como "profile".
func setupDiretorioComNomes(t *testing.T, saved, profile string) (*service.WhatsAppDirectoryService, *repository.WhatsAppConversationRepositorySQLite, func()) {
	t.Helper()
	db, err := openShadowInboxDB(t)
	if err != nil {
		t.Fatalf("erro ao abrir banco: %v", err)
	}
	userRepo := repository.NewUserRepository(db)
	if err := userRepo.Create(&domain.User{
		ID: "user-dir-1", Email: "dir@vito.local", Name: "Dir",
		CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
	}); err != nil {
		t.Fatalf("erro ao criar usuário: %v", err)
	}
	convRepo := repository.NewWhatsAppConversationRepository(db)
	now := time.Now().UTC()
	if err := convRepo.SaveMessage(context.Background(), &domain.WhatsAppConversationMessage{
		ID: "dir-msg-1", UserID: "user-dir-1", InstanceName: "inst",
		ChatJID: jidIsaSalvo, ChatKind: domain.WhatsAppChatKindDirect,
		ChatLabel: profile, SenderName: profile, Kind: "text",
		Text: "a reunião é quinta às 10h", MessageTimestamp: now,
	}); err != nil {
		t.Fatalf("erro ao arquivar: %v", err)
	}

	mockClient := &mockExtendedEvolutionClient{
		mockState: "open",
		mockContacts: []service.WhatsAppContact{
			{ID: jidIsaSalvo, Name: saved, PushName: profile, Number: "5511988887777"},
		},
	}
	cache := service.NewWhatsAppContactsCache(mockClient, time.Hour)
	if _, err := cache.Fetch(context.Background(), "inst"); err != nil {
		t.Fatalf("erro ao popular o cache: %v", err)
	}
	dir := service.NewWhatsAppDirectoryService(convRepo, service.DefaultWhatsAppContextConfig(), cache)
	return dir, convRepo, func() { _ = db.Close() }
}

var _ = json.Marshal
