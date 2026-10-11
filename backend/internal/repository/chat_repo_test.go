package repository_test

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func setupTestChatDB(t *testing.T) (*sql.DB, *repository.ChatRepositorySQLite) {
	t.Helper()
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_chat.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("erro ao abrir banco de teste: %v", err)
	}

	// Cria usuário de teste
	_, err = db.Exec("INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES ('user-1', 'André', 'andre@teste.com', 'hash', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
	if err != nil {
		t.Fatalf("erro ao criar usuário: %v", err)
	}

	repo := repository.NewChatRepository(db)
	return db, repo
}

func TestChatRepository_SaveAndListSessions(t *testing.T) {
	db, repo := setupTestChatDB(t)
	defer db.Close()
	ctx := context.Background()

	now := time.Now().UTC()
	sess1 := &domain.ChatSession{
		ID:        "session-1",
		UserID:    "user-1",
		Title:     "Planejamento Semanal",
		Preview:   "Olá! Como posso ajudar?",
		CreatedAt: now.Add(-1 * time.Hour),
		UpdatedAt: now.Add(-1 * time.Hour),
	}
	sess2 := &domain.ChatSession{
		ID:        "session-2",
		UserID:    "user-1",
		Title:     "Design do Vito",
		Preview:   "Vamos alinhar os próximos passos",
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := repo.SaveSession(ctx, sess1); err != nil {
		t.Fatalf("falha ao salvar sess1: %v", err)
	}
	if err := repo.SaveSession(ctx, sess2); err != nil {
		t.Fatalf("falha ao salvar sess2: %v", err)
	}

	sessions, err := repo.ListSessions(ctx, "user-1")
	if err != nil {
		t.Fatalf("falha ao listar sessões: %v", err)
	}

	if len(sessions) != 2 {
		t.Fatalf("esperava 2 sessões, obteve %d", len(sessions))
	}
	// Ordenação por UpdatedAt DESC: session-2 deve ser a primeira
	if sessions[0].ID != "session-2" {
		t.Errorf("esperava session-2 primeiro, obteve %s", sessions[0].ID)
	}
}

func TestChatRepository_MessagesAndCascadingDelete(t *testing.T) {
	db, repo := setupTestChatDB(t)
	defer db.Close()
	ctx := context.Background()

	now := time.Now().UTC()
	sess := &domain.ChatSession{
		ID:        "session-1",
		UserID:    "user-1",
		Title:     "Reunião de Alinhamento",
		Preview:   "Marcando horário",
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := repo.SaveSession(ctx, sess); err != nil {
		t.Fatalf("falha ao salvar sessão: %v", err)
	}

	msgs := []domain.ChatMessage{
		{
			ID:        "msg-1",
			SessionID: "session-1",
			UserID:    "user-1",
			Sender:    "user",
			Text:      "Quero marcar uma reunião",
			Timestamp: now.Add(-2 * time.Minute),
		},
		{
			ID:        "msg-2",
			SessionID: "session-1",
			UserID:    "user-1",
			Sender:    "vito",
			Text:      "Perfeito! Qual horário?",
			Timestamp: now.Add(-1 * time.Minute),
		},
	}
	if err := repo.SaveMessages(ctx, msgs); err != nil {
		t.Fatalf("falha ao salvar mensagens: %v", err)
	}

	swm, err := repo.GetSessionWithMessages(ctx, "session-1", "user-1")
	if err != nil {
		t.Fatalf("falha ao buscar sessão com mensagens: %v", err)
	}
	if swm == nil {
		t.Fatal("esperava sessão não nula")
	}
	if len(swm.Messages) != 2 {
		t.Fatalf("esperava 2 mensagens, obteve %d", len(swm.Messages))
	}
	if swm.Messages[0].Text != "Quero marcar uma reunião" {
		t.Errorf("ordenação incorreta de mensagens: %s", swm.Messages[0].Text)
	}

	// Deletar sessão
	if err := repo.DeleteSession(ctx, "session-1", "user-1"); err != nil {
		t.Fatalf("falha ao deletar sessão: %v", err)
	}

	deleted, err := repo.GetSession(ctx, "session-1", "user-1")
	if err != nil {
		t.Fatalf("erro ao checar sessão deletada: %v", err)
	}
	if deleted != nil {
		t.Errorf("esperava nil após deleção, obteve %+v", deleted)
	}
}
