package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

// newContactsCacheVazio cria um cache de contatos sem cliente.
func newContactsCacheVazio() *service.WhatsAppContactsCache {
	return service.NewWhatsAppContactsCache(nil, 0)
}

// TestContactsCache_SetSavedFromLabelsRecuperaNomeSalvo
//
// O rótulo do shadow inbox guarda o nome SALVO (persistido pelo import do app);
// quando ele difere do pushName, é o nome que o dono usa e precisa voltar ao
// cache — senão, depois de um deploy, o Vito volta a só conhecer o perfil.
func TestContactsCache_SetSavedFromLabelsRecuperaNomeSalvo(t *testing.T) {
	cache := newContactsCacheVazio()
	profiles := map[string]string{"559888196462@s.whatsapp.net": "ALVIMAR"}
	labels := map[string]string{"559888196462@s.whatsapp.net": "Isa"}

	cache.SetProfiles(profiles)
	cache.SetSavedFromLabels(labels, profiles)

	if got := cache.Name("559888196462@s.whatsapp.net"); got != "Isa" {
		t.Errorf("esperava o nome salvo 'Isa' (persistido no rótulo), obteve %q", got)
	}
	if got := cache.Alias("559888196462@s.whatsapp.net", "Isa"); got != "ALVIMAR" {
		t.Errorf("esperava o alias de perfil 'ALVIMAR', obteve %q", got)
	}
}

// TestContactsCache_SetSavedFromLabelsIgnoraRotulosGenericosEPerfis
func TestContactsCache_SetSavedFromLabelsIgnoraRotulosGenericosEPerfis(t *testing.T) {
	cache := newContactsCacheVazio()
	profiles := map[string]string{
		"559888196462@s.whatsapp.net": "ALVIMAR",
		"559870215218@s.whatsapp.net": ".",
	}
	labels := map[string]string{
		"559888196462@s.whatsapp.net": "ALVIMAR", // é só o perfil
		"559870215218@s.whatsapp.net": ".",       // idem
		"outro@s.whatsapp.net":        "Contato", // genérico
		"vazio@s.whatsapp.net":        "Você",    // genérico
	}

	cache.SetProfiles(profiles)
	cache.SetSavedFromLabels(labels, profiles)

	if got := cache.Name("559888196462@s.whatsapp.net"); got != "ALVIMAR" {
		t.Errorf("o rótulo igual ao perfil não deve virar nome salvo, obteve %q", got)
	}
	if got := cache.Name("outro@s.whatsapp.net"); got != "" {
		t.Errorf("rótulo genérico não deve virar nome salvo, obteve %q", got)
	}
}

// TestWhatsAppService_RelabelNaoApagaNomeSalvo
//
// O `Relabel` do backfill sobrescreve o rótulo: se rodar com o nome de perfil,
// apaga o nome salvo importado pelo app. Com o `Saved` no cache, ele reescreve
// o mesmo valor (idempotente).
func TestWhatsAppService_RelabelNaoApagaNomeSalvo(t *testing.T) {
	ctx := context.Background()
	repo, cleanup := novoShadowInboxDB(t, "user-alias-1")
	defer cleanup()

	svc := service.NewWhatsAppContextService(repo, service.DefaultWhatsAppContextConfig())
	if err := repo.SaveMessage(ctx, &domain.WhatsAppConversationMessage{
		ID: "msg-1", UserID: "user-alias-1", InstanceName: "inst",
		ChatJID: "559888196462@s.whatsapp.net", ChatKind: domain.WhatsAppChatKindDirect,
		ChatLabel: "Isa", Kind: "text", Text: "oi",
		MessageTimestamp: time.Now().UTC(),
	}); err != nil {
		t.Fatalf("erro ao arquivar: %v", err)
	}

	// O cache de contatos do usuário tem o nome salvo e o perfil.
	cache := service.NewWhatsAppContactsCache(nil, 0)
	cache.Set("559888196462@s.whatsapp.net", "Isa", "ALVIMAR")

	// O Relabel roda com o que o cache devolve (que prioriza o nome salvo).
	if _, err := svc.Relabel(ctx, "user-alias-1", cache.Names()); err != nil {
		t.Fatalf("Relabel falhou: %v", err)
	}

	labels, err := svc.ChatLabels(ctx, "user-alias-1")
	if err != nil {
		t.Fatalf("ChatLabels falhou: %v", err)
	}
	if labels["559888196462@s.whatsapp.net"] != "Isa" {
		t.Errorf("o nome salvo foi apagado pelo Relabel, rótulo agora: %q", labels["559888196462@s.whatsapp.net"])
	}
}
