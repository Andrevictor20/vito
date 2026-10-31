package service_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func TestWhatsAppConversationBridge_NilRepo_Safe(t *testing.T) {
	bridge := service.NewWhatsAppConversationBridge(nil)
	ctx := context.Background()

	thread, err := bridge.RecordIncoming(ctx, "u1", "c1", "oi")
	if err != nil || thread != nil {
		t.Fatalf("esperava nil sem erro com repo nil, obteve thread=%v err=%v", thread, err)
	}

	err = bridge.RecordOutgoing(ctx, "u1", "t1", "resposta", "gpt")
	if err != nil {
		t.Fatalf("esperava nil ao gravar saída com repo nil: %v", err)
	}

	history, err := bridge.GetRecentHistory(ctx, "t1", 10)
	if err != nil || history != nil {
		t.Fatalf("esperava nil sem erro no histórico: %v", err)
	}

	tCreated, err := bridge.GetOrCreateThread(ctx, "u1", "c1")
	if err != nil || tCreated != nil {
		t.Fatalf("esperava nil sem erro em GetOrCreateThread: %v", err)
	}
}

func TestWhatsAppConversationBridge_Roundtrip(t *testing.T) {
	tmpDir := t.TempDir()
	db, err := database.Open(filepath.Join(tmpDir, "wa_bridge_test.db"))
	if err != nil {
		t.Fatalf("falha ao abrir sqlite de teste: %v", err)
	}
	defer db.Close()

	convRepo := repository.NewConversationStoreRepository(db)
	userRepo := repository.NewUserRepository(db)
	bridge := service.NewWhatsAppConversationBridge(convRepo)
	ctx := context.Background()
	userID := "user-wa-1"
	chatJID := "5511999998888@s.whatsapp.net"

	_ = userRepo.Create(&domain.User{
		ID:        userID,
		Name:      "User WA",
		Email:     "wa@example.com",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})

	// 1. Grava mensagem de entrada (user)
	thread, err := bridge.RecordIncoming(ctx, userID, chatJID, "Preciso agendar dentista amanha")
	if err != nil {
		t.Fatalf("falha ao gravar incoming: %v", err)
	}
	if thread == nil || thread.ID == "" {
		t.Fatal("thread retornada não pode ser nula")
	}
	if thread.Channel != "whatsapp" {
		t.Errorf("esperava canal whatsapp, obteve %s", thread.Channel)
	}

	// 2. Grava mensagem de saída (assistant)
	err = bridge.RecordOutgoing(ctx, userID, thread.ID, "Claro! Qual horário prefere?", "gemini-2.5-flash")
	if err != nil {
		t.Fatalf("falha ao gravar outgoing: %v", err)
	}

	// 3. Consulta histórico
	turns, err := bridge.GetRecentHistory(ctx, thread.ID, 10)
	if err != nil {
		t.Fatalf("falha ao buscar histórico: %v", err)
	}
	if len(turns) != 2 {
		t.Fatalf("esperava 2 turnos gravados, obteve %d", len(turns))
	}
	if turns[0].Role != "user" || turns[0].Content != "Preciso agendar dentista amanha" {
		t.Errorf("turno 0 incorreto: %+v", turns[0])
	}
	if turns[1].Role != "assistant" || turns[1].ModelUsed != "gemini-2.5-flash" {
		t.Errorf("turno 1 incorreto: %+v", turns[1])
	}
}
