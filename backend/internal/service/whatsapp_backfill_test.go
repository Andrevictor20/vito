package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

// AC-F6 — o backfill importa o histórico da Evolution API de forma idempotente.
func TestWhatsAppBackfill_ImportsHistoryIdempotently(t *testing.T) {
	fx := setupContextualWhatsApp(t)

	now := time.Now().UTC()
	fx.client.mockMessages = []service.WhatsAppChatMessage{
		{
			ID:               "hist-1",
			RemoteJID:        friendJID(),
			PushName:         "Ana",
			Text:             "pode ser quinta às 10h",
			MessageTimestamp: now.Add(-2 * time.Hour),
		},
		{
			ID:               "hist-2",
			RemoteJID:        friendJID(),
			PushName:         "Ana",
			Text:             "me manda o contrato",
			MessageTimestamp: now.Add(-3 * time.Hour),
		},
	}

	ownerCache := service.NewWhatsAppOwnerCache(fx.client, time.Hour)
	fx.client.mockOwnerJID = "559884097322@s.whatsapp.net"
	backfill := service.NewWhatsAppBackfillService(
		fx.client,
		fx.contextSvc,
		fx.groupMeta,
		ownerCache,
		fx.waRepo,
		service.DefaultWhatsAppBackfillConfig(),
	)

	imported, err := backfill.Run(context.Background())
	if err != nil {
		t.Fatalf("backfill retornou erro: %v", err)
	}
	if imported != 2 {
		t.Fatalf("esperava 2 mensagens importadas, obteve %d", imported)
	}

	msgs, err := fx.repo.RecentMessagesAcrossChats(context.Background(), "user-ctx-1", 50, time.Now().Add(-72*time.Hour))
	if err != nil {
		t.Fatalf("falha ao ler inbox: %v", err)
	}
	if len(msgs) != 2 {
		t.Fatalf("esperava 2 mensagens no shadow inbox, obteve %d", len(msgs))
	}
	// A janela é entregue em ordem cronológica.
	if msgs[0].Text != "me manda o contrato" {
		t.Errorf("esperava ordem cronológica, primeiro item = %q", msgs[0].Text)
	}
	if msgs[0].ChatLabel != "Ana" {
		t.Errorf("esperava o rótulo do contato 'Ana', obteve %q", msgs[0].ChatLabel)
	}

	// Reexecutar não pode duplicar.
	if _, err := backfill.Run(context.Background()); err != nil {
		t.Fatalf("segundo backfill: %v", err)
	}
	msgs, err = fx.repo.RecentMessagesAcrossChats(context.Background(), "user-ctx-1", 50, time.Now().Add(-72*time.Hour))
	if err != nil {
		t.Fatalf("falha ao reler inbox: %v", err)
	}
	if len(msgs) != 2 {
		t.Fatalf("esperava 2 mensagens após reexecutar (idempotência), obteve %d", len(msgs))
	}
}

// AC-F6 — o backfill respeita o kill switch (WHATSAPP_BACKFILL_ENABLED=false).
func TestWhatsAppBackfill_DisabledDoesNothing(t *testing.T) {
	fx := setupContextualWhatsApp(t)

	fx.client.mockMessages = []service.WhatsAppChatMessage{
		{ID: "hist-off-1", RemoteJID: friendJID(), Text: "ignorar", MessageTimestamp: time.Now().UTC()},
	}

	cfg := service.DefaultWhatsAppBackfillConfig()
	cfg.Enabled = false
	backfill := service.NewWhatsAppBackfillService(fx.client, fx.contextSvc, fx.groupMeta, service.NewWhatsAppOwnerCache(fx.client, time.Hour), fx.waRepo, cfg)

	imported, err := backfill.Run(context.Background())
	if err != nil {
		t.Fatalf("backfill retornou erro: %v", err)
	}
	if imported != 0 {
		t.Fatalf("esperava 0 importações com o backfill desligado, obteve %d", imported)
	}
	if fx.client.findMessagesCount != 0 {
		t.Fatalf("o backfill desligado não deve chamar a Evolution API")
	}
}

// AC-F11 — o usuário configura o escopo e o tamanho da janela.
func TestWhatsAppContextSettings_UpdateAndPersist(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	ctx := context.Background()

	settings, err := fx.contextSvc.UpdateSettings(ctx, "user-ctx-1", domain.WhatsAppContextScopeChat, 24)
	if err != nil {
		t.Fatalf("UpdateSettings: %v", err)
	}
	if settings.Scope != domain.WhatsAppContextScopeChat || settings.WindowSize != 24 {
		t.Fatalf("preferências persistidas incorretas: %+v", settings)
	}

	// Novo serviço (simula restart) deve ler as mesmas preferências.
	restarted := service.NewWhatsAppContextService(fx.repo, service.DefaultWhatsAppContextConfig())
	loaded, err := restarted.Settings(ctx, "user-ctx-1")
	if err != nil {
		t.Fatalf("Settings: %v", err)
	}
	if loaded.Scope != domain.WhatsAppContextScopeChat || loaded.WindowSize != 24 {
		t.Fatalf("esperava as preferências persistidas, obteve %+v", loaded)
	}
}

// AC-F11 — escopo inválido é rejeitado.
func TestWhatsAppContextSettings_RejectsInvalidScope(t *testing.T) {
	fx := setupContextualWhatsApp(t)

	if _, err := fx.contextSvc.UpdateSettings(context.Background(), "user-ctx-1", "invalido", 12); err == nil {
		t.Fatal("esperava erro para scope inválido")
	}
	if _, err := fx.contextSvc.UpdateSettings(context.Background(), "user-ctx-1", domain.WhatsAppContextScopeAll, 999); err == nil {
		t.Fatal("esperava erro para window_size acima do limite")
	}
}

// AC-F13 — a exclusão da conta remove o shadow inbox em cascata (LGPD).
func TestWhatsAppContext_CascadeOnUserDeletion(t *testing.T) {
	fx := setupContextualWhatsApp(t)
	ctx := context.Background()

	if err := fx.svc.HandleWebhook(ctx, "messages.upsert", buildPayload(selfJID(), "msg-lgpd-1", "algo a apagar")); err != nil {
		t.Fatalf("HandleWebhook: %v", err)
	}
	msgs, err := fx.repo.RecentMessagesAcrossChats(ctx, "user-ctx-1", 50, time.Now().Add(-72*time.Hour))
	if err != nil {
		t.Fatalf("falha ao ler inbox: %v", err)
	}
	if len(msgs) == 0 {
		t.Fatal("esperava mensagem arquivada")
	}

	// A exclusão do usuário dispara o ON DELETE CASCADE das tabelas do contexto.
	if err := fx.userRepo.Delete("user-ctx-1"); err != nil {
		t.Fatalf("Delete do usuário: %v", err)
	}

	msgs, err = fx.repo.RecentMessagesAcrossChats(ctx, "user-ctx-1", 50, time.Now().Add(-72*time.Hour))
	if err != nil {
		t.Fatalf("falha ao reler inbox: %v", err)
	}
	if len(msgs) != 0 {
		t.Fatalf("esperava o inbox vazio após a exclusão da conta, restaram %d", len(msgs))
	}
}
