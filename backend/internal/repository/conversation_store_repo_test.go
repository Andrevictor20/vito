package repository_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func setupConversationStoreTestDB(t *testing.T) (*repository.ConversationStoreRepository, string) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_conv_store.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("falha ao inicializar sqlite: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	userID := "user-conv-1"
	_ = userRepo.Create(&domain.User{
		ID:           userID,
		Name:         "User Conv Store",
		Email:        "convstore@example.com",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	})

	repo := repository.NewConversationStoreRepository(db)
	return repo, userID
}

// TestConversationStoreRepo_ThreadLifecycle testa criação, consulta e atualização de threads.
func TestConversationStoreRepo_ThreadLifecycle(t *testing.T) {
	repo, userID := setupConversationStoreTestDB(t)
	ctx := context.Background()

	now := time.Now().UTC().Truncate(time.Second)
	thread := &repository.ConversationThread{
		ID:             "thread-lifecycle-1",
		UserID:         userID,
		Channel:        "app_mobile",
		ExternalChatID: "chat-mob-1",
		Title:          "Conversa de Segunda",
		LastActivityAt: now,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	// 1. Criação
	if err := repo.CreateThread(ctx, thread); err != nil {
		t.Fatalf("falha ao criar thread: %v", err)
	}

	// 2. Consulta por ID
	fetched, err := repo.GetThreadByID(ctx, thread.ID)
	if err != nil {
		t.Fatalf("falha ao buscar thread: %v", err)
	}
	if fetched.Title != "Conversa de Segunda" {
		t.Errorf("esperava título 'Conversa de Segunda', obteve %s", fetched.Title)
	}
	if fetched.RollingSummary != "" {
		t.Errorf("esperava resumo inicial vazio, obteve %s", fetched.RollingSummary)
	}

	// 3. Atualização de Resumo Rolante
	summary := "Usuário planejou agenda da semana e pediu lembrete de compras."
	if err := repo.UpdateThreadSummary(ctx, thread.ID, summary, "turn-10"); err != nil {
		t.Fatalf("falha ao atualizar resumo da thread: %v", err)
	}

	// 4. Atualização de Sticky Model
	stickyUntil := now.Add(15 * time.Minute)
	if err := repo.UpdateThreadSticky(ctx, thread.ID, "gemini-2.5-flash", &stickyUntil); err != nil {
		t.Fatalf("falha ao atualizar sticky da thread: %v", err)
	}

	// 5. Verificação após updates
	updated, err := repo.GetThreadByID(ctx, thread.ID)
	if err != nil {
		t.Fatalf("falha ao reconsultar thread: %v", err)
	}
	if updated.RollingSummary != summary {
		t.Errorf("resumo rolante não bate: obteve %q", updated.RollingSummary)
	}
	if updated.StickyModelName != "gemini-2.5-flash" {
		t.Errorf("sticky model não bate: obteve %s", updated.StickyModelName)
	}
}

// TestConversationStoreRepo_ListThreadsByUser valida filtragem e ordenação cronológica.
func TestConversationStoreRepo_ListThreadsByUser(t *testing.T) {
	repo, userID := setupConversationStoreTestDB(t)
	ctx := context.Background()

	now := time.Now().UTC()
	t1 := &repository.ConversationThread{
		ID:             "t-mob-1",
		UserID:         userID,
		Channel:        "app_mobile",
		Title:          "Mobile Antigo",
		LastActivityAt: now.Add(-2 * time.Hour),
		CreatedAt:      now.Add(-2 * time.Hour),
		UpdatedAt:      now.Add(-2 * time.Hour),
	}
	t2 := &repository.ConversationThread{
		ID:             "t-mob-2",
		UserID:         userID,
		Channel:        "app_mobile",
		Title:          "Mobile Recente",
		LastActivityAt: now,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	t3 := &repository.ConversationThread{
		ID:             "t-wa-1",
		UserID:         userID,
		Channel:        "whatsapp",
		Title:          "WhatsApp",
		LastActivityAt: now.Add(-1 * time.Hour),
		CreatedAt:      now.Add(-1 * time.Hour),
		UpdatedAt:      now.Add(-1 * time.Hour),
	}

	_ = repo.CreateThread(ctx, t1)
	_ = repo.CreateThread(ctx, t2)
	_ = repo.CreateThread(ctx, t3)

	// Listar apenas app_mobile ordenado por last_activity_at DESC
	mobThreads, err := repo.ListThreadsByUser(ctx, userID, "app_mobile", 10)
	if err != nil {
		t.Fatalf("falha ao listar threads mobile: %v", err)
	}
	if len(mobThreads) != 2 {
		t.Fatalf("esperava 2 threads mobile, obteve %d", len(mobThreads))
	}
	if mobThreads[0].ID != "t-mob-2" {
		t.Errorf("esperava t-mob-2 como primeira (mais recente), obteve %s", mobThreads[0].ID)
	}
}

// TestConversationStoreRepo_TurnLifecycle valida inserção e listagem de turnos reais e proativos.
func TestConversationStoreRepo_TurnLifecycle(t *testing.T) {
	repo, userID := setupConversationStoreTestDB(t)
	ctx := context.Background()

	threadID := "thread-turns-test"
	_ = repo.CreateThread(ctx, &repository.ConversationThread{
		ID:             threadID,
		UserID:         userID,
		Channel:        "app_mobile",
		Title:          "Thread de Turnos",
		LastActivityAt: time.Now().UTC(),
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	})

	t0 := time.Now().UTC().Add(-10 * time.Second)
	t1 := time.Now().UTC().Add(-5 * time.Second)
	t2 := time.Now().UTC()

	// 1. Turno de usuário
	turnUser := &repository.ConversationTurn{
		ID:        "turn-1",
		ThreadID:  threadID,
		UserID:    userID,
		Channel:   "app_mobile",
		Role:      "user",
		Origin:    "direct",
		Content:   "Quais meus compromissos de hoje?",
		CreatedAt: t0,
	}

	// 2. Turno proativo de worker (Ponte com Workers Proativos - AC-11)
	turnProactive := &repository.ConversationTurn{
		ID:         "turn-2",
		ThreadID:   threadID,
		UserID:     userID,
		Channel:    "app_mobile",
		Role:       "assistant",
		Origin:     "proactive_worker",
		WorkerType: "morning_briefing",
		Content:    "Bom dia! Você tem 2 compromissos hoje: Reunião às 10h e Almoço às 12h.",
		ModelUsed:  "proactive_worker_engine",
		CreatedAt:  t1,
	}

	// 3. Turno de assistente com ferramenta e telemetria
	turnAssistant := &repository.ConversationTurn{
		ID:                "turn-3",
		ThreadID:          threadID,
		UserID:            userID,
		Channel:           "app_mobile",
		Role:              "assistant",
		Origin:            "direct",
		Content:           "Deseja que eu agende um intervalo entre as reuniões?",
		CardsJSON:         `[{"type":"event","title":"Reunião 10h"}]`,
		ModelUsed:         "gemini-2.5-flash",
		TokensIn:          120,
		TokensOut:         45,
		LatencyMs:         480,
		TaintedByExternal: 0,
		CreatedAt:         t2,
	}

	if err := repo.CreateTurn(ctx, turnUser); err != nil {
		t.Fatalf("falha ao salvar turnUser: %v", err)
	}
	if err := repo.CreateTurn(ctx, turnProactive); err != nil {
		t.Fatalf("falha ao salvar turnProactive: %v", err)
	}
	if err := repo.CreateTurn(ctx, turnAssistant); err != nil {
		t.Fatalf("falha ao salvar turnAssistant: %v", err)
	}

	// Listagem em ordem cronológica ASC
	turns, err := repo.ListTurnsByThread(ctx, threadID, 10)
	if err != nil {
		t.Fatalf("falha ao listar turnos: %v", err)
	}
	if len(turns) != 3 {
		t.Fatalf("esperava 3 turnos, obteve %d", len(turns))
	}
	if turns[0].Role != "user" {
		t.Errorf("esperava 1º turno como user, obteve %s", turns[0].Role)
	}
	if turns[1].Origin != "proactive_worker" || turns[1].WorkerType != "morning_briefing" {
		t.Errorf("esperava 2º turno como proactive_worker (morning_briefing), obteve %s (%s)", turns[1].Origin, turns[1].WorkerType)
	}
	if turns[2].CardsJSON != `[{"type":"event","title":"Reunião 10h"}]` {
		t.Errorf("CardsJSON corrompido: %s", turns[2].CardsJSON)
	}
}

// TestConversationStoreRepo_CascadeDelete valida integridade referencial com DELETE CASCADE.
func TestConversationStoreRepo_CascadeDelete(t *testing.T) {
	repo, userID := setupConversationStoreTestDB(t)
	ctx := context.Background()

	threadID := "thread-cascade"
	_ = repo.CreateThread(ctx, &repository.ConversationThread{
		ID:             threadID,
		UserID:         userID,
		Channel:        "app_mobile",
		LastActivityAt: time.Now().UTC(),
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	})

	_ = repo.CreateTurn(ctx, &repository.ConversationTurn{
		ID:        "turn-cascade-1",
		ThreadID:  threadID,
		UserID:    userID,
		Channel:   "app_mobile",
		Role:      "user",
		Content:   "Olá",
		CreatedAt: time.Now().UTC(),
	})

	// Deleta a thread
	if err := repo.DeleteThread(ctx, threadID); err != nil {
		t.Fatalf("falha ao deletar thread: %v", err)
	}

	// Turnos associados devem ter sido removidos em cascata
	turns, err := repo.ListTurnsByThread(ctx, threadID, 10)
	if err != nil {
		t.Fatalf("erro ao verificar turnos órfãos: %v", err)
	}
	if len(turns) != 0 {
		t.Errorf("turnos não foram removidos em cascata: restaram %d", len(turns))
	}
}
