package service_test

import (
	"context"
	"testing"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

// TestContactsCache_ImportSavedNamesGravaNomeSalvo: o nome salvo na agenda do
// celular precisa ficar disponível para o Vito (é o nome que o dono usa).
func TestContactsCache_ImportSavedNamesGravaNomeSalvo(t *testing.T) {
	cache := service.NewWhatsAppContactsCache(nil, 0)

	imported := cache.ImportSavedNames(context.Background(), "inst", []service.SavedContactName{
		{Phone: "+55 11 98841-7165", Name: "Isa"},
	})
	if imported != 1 {
		t.Fatalf("esperava 1 nome importado, obteve %d", imported)
	}

	// Indexado pelo número (com e sem formatação).
	if got := cache.Name("5511988417165@s.whatsapp.net"); got != "Isa" {
		t.Errorf("esperava o nome salvo 'Isa' para o JID do número, obteve %q", got)
	}
	if got := cache.Name("+55 11 98841-7165"); got != "Isa" {
		t.Errorf("esperava o nome salvo 'Isa' para o telefone, obteve %q", got)
	}
}

// TestContactsCache_ImportSavedNamesIgnoraEntradasVazias: entrada sem nome ou
// sem telefone não pode sujar o cache.
func TestContactsCache_ImportSavedNamesIgnoraEntradasVazias(t *testing.T) {
	cache := service.NewWhatsAppContactsCache(nil, 0)

	imported := cache.ImportSavedNames(context.Background(), "inst", []service.SavedContactName{
		{Phone: "551988417165", Name: "  "},
		{Phone: "", Name: "Isa"},
	})
	if imported != 0 {
		t.Errorf("esperava 0 nomes importados, obteve %d", imported)
	}
	if got := cache.Name("551988417165@s.whatsapp.net"); got != "" {
		t.Errorf("o cache deveria estar vazio, obteve %q", got)
	}
}

// TestContactsCache_HydrateFromContacts: contatos do SQLite reidratam o cache no boot.
func TestContactsCache_HydrateFromContacts(t *testing.T) {
	cache := service.NewWhatsAppContactsCache(nil, 0)

	contacts := []domain.SyncedContact{
		{
			UserID:      "u1",
			Phone:       "+55 (98) 98881-9646",
			PhoneDigits: "5598988819646",
			JID:         "5598988819646@s.whatsapp.net",
			LID:         "25419827364@lid",
			SavedName:   "Isa",
			ProfileName: "Bella",
		},
		{
			UserID:      "u1",
			Phone:       "+55 11 97722-4455",
			PhoneDigits: "5511977224455",
			SavedName:   "Roberto Jr",
		},
	}

	hydrated := cache.HydrateFromContacts(contacts)
	if hydrated != 2 {
		t.Fatalf("esperava 2 contatos reidratados, obteve %d", hydrated)
	}

	// Testa resolução por JID, LID e número
	if got := cache.Name("5598988819646@s.whatsapp.net"); got != "Isa" {
		t.Errorf("esperava 'Isa' para o JID, obteve %q", got)
	}
	if got := cache.Name("25419827364@lid"); got != "Isa" {
		t.Errorf("esperava 'Isa' para o LID, obteve %q", got)
	}
	if got := cache.ProfileName("25419827364@lid"); got != "Bella" {
		t.Errorf("esperava 'Bella' para o perfil no LID, obteve %q", got)
	}
	if got := cache.Name("5511977224455@s.whatsapp.net"); got != "Roberto Jr" {
		t.Errorf("esperava 'Roberto Jr' para o JID do segundo contato, obteve %q", got)
	}
}
