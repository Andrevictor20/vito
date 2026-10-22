package service_test

import (
	"context"
	"testing"

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

// TestContactsCache_NomeSalvoNumericoNaoViraRotulo: contato salvo só pelo
// telefone continua usando o nome de perfil como rótulo (legibilidade).
func TestContactsCache_NomeSalvoNumericoNaoViraRotulo(t *testing.T) {
	cache := service.NewWhatsAppContactsCache(nil, 0)
	cache.Set("559888196462@s.whatsapp.net", "559888196462", "Bella")

	if got := cache.Name("559888196462@s.whatsapp.net"); got != "Bella" {
		t.Errorf("esperava o nome de perfil 'Bella', obteve %q", got)
	}
}
