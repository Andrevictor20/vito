package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

type mockSyncedContactRepo struct {
	contacts []domain.SyncedContact
}

func (m *mockSyncedContactRepo) UpsertBatch(ctx context.Context, contacts []domain.SyncedContact) (int64, error) {
	m.contacts = append(m.contacts, contacts...)
	return int64(len(contacts)), nil
}

func (m *mockSyncedContactRepo) ListByUserID(ctx context.Context, userID string) ([]domain.SyncedContact, error) {
	var out []domain.SyncedContact
	for _, c := range m.contacts {
		if c.UserID == userID {
			out = append(out, c)
		}
	}
	return out, nil
}

func (m *mockSyncedContactRepo) ListAll(ctx context.Context) ([]domain.SyncedContact, error) {
	return m.contacts, nil
}

func (m *mockSyncedContactRepo) FindByNameOrPhone(ctx context.Context, userID, query string) ([]domain.SyncedContact, error) {
	var out []domain.SyncedContact
	for _, c := range m.contacts {
		if c.UserID == userID {
			out = append(out, c)
		}
	}
	return out, nil
}

func (m *mockSyncedContactRepo) GetByJIDOrLID(ctx context.Context, userID, identifier string) (*domain.SyncedContact, error) {
	for _, c := range m.contacts {
		if c.UserID == userID && (c.JID == identifier || c.LID == identifier) {
			return &c, nil
		}
	}
	return nil, nil
}

// TestWhatsAppDirectory_ResolveChatFromSyncedContactsSemHistorico:
// Se o usuário tem o contato salvo na agenda mas nunca conversou com ele no WhatsApp
// (0 mensagens no shadow inbox), o ResolveChat deve conseguir resolver pelo repositório
// e gerar o JID sintético para envio.
func TestWhatsAppDirectory_ResolveChatFromSyncedContactsSemHistorico(t *testing.T) {
	ctx := context.Background()

	contactRepo := &mockSyncedContactRepo{
		contacts: []domain.SyncedContact{
			{
				UserID:      "u1",
				Phone:       "+55 (11) 97722-4455",
				PhoneDigits: "5511977224455",
				SavedName:   "Dr. Roberto",
				Source:      "phonebook",
			},
		},
	}

	// Repo de conversas vazio (0 mensagens)
	dir := service.NewWhatsAppDirectoryService(nil, service.WhatsAppContextConfig{MaxAge: 30 * 24 * time.Hour}, nil)
	dir.SetContactRepository(contactRepo)

	chat, err := dir.ResolveChat(ctx, "u1", "Dr. Roberto")
	if err != nil {
		t.Fatalf("esperava resolver contato salvo, obteve erro: %v", err)
	}
	if chat == nil {
		t.Fatal("esperava chat summary não nulo")
	}
	if chat.ChatJID != "5511977224455@s.whatsapp.net" {
		t.Errorf("esperava JID '5511977224455@s.whatsapp.net', obteve %q", chat.ChatJID)
	}
	if chat.ChatLabel != "Dr. Roberto" {
		t.Errorf("esperava label 'Dr. Roberto', obteve %q", chat.ChatLabel)
	}
}

// TestWhatsAppDirectory_DirectoryIncluiContatosSincronizados:
// O diretório deve enriquecer os contatos com a agenda (synced_contacts) para
// que a IA saiba imediatamente que "Isa" é a "Bella" e também veja contatos
// salvos mesmo que não tenham mensagens recentes.
func TestWhatsAppDirectory_DirectoryIncluiContatosSincronizados(t *testing.T) {
	ctx := context.Background()

	contactRepo := &mockSyncedContactRepo{
		contacts: []domain.SyncedContact{
			{
				UserID:      "u1",
				Phone:       "+55 21 99999-8888",
				PhoneDigits: "5521999998888",
				JID:         "5521999998888@s.whatsapp.net",
				LID:         "471331507024120@lid",
				SavedName:   "Isa",
				ProfileName: "Bella",
				Source:      "phonebook",
			},
		},
	}

	dir := service.NewWhatsAppDirectoryService(nil, service.WhatsAppContextConfig{MaxAge: 30 * 24 * time.Hour}, nil)
	dir.SetContactRepository(contactRepo)

	entries, err := dir.Directory(ctx, "u1")
	if err != nil {
		t.Fatalf("Directory falhou: %v", err)
	}
	if len(entries) == 0 {
		t.Fatal("esperava que o diretório contivesse ao menos 1 contato vindo de synced_contacts")
	}

	found := false
	for _, e := range entries {
		if e.Name == "Isa" {
			found = true
			if e.Alias != "Bella" {
				t.Errorf("esperava Alias 'Bella', obteve %q", e.Alias)
			}
		}
	}
	if !found {
		t.Errorf("contato 'Isa' não encontrado no diretório: %+v", entries)
	}
}

