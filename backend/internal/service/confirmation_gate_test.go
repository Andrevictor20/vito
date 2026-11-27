package service_test

import (
	"context"
	"encoding/json"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func setupConfirmationTestDB(t *testing.T) (*service.ConfirmationGateService, string) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_conf_gate.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("falha ao abrir sqlite de teste: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	userID := "user-conf-test-1"
	_ = userRepo.Create(&domain.User{
		ID:           userID,
		Name:         "User Conf Gate",
		Email:        "confgate@example.com",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	})

	_, _ = db.Exec(`INSERT INTO conversation_threads (id, user_id, channel, title) VALUES ('thread-1', ?, 'app_mobile', 'Test Thread')`, userID)

	gateService := service.NewConfirmationGateService(db)
	return gateService, userID
}

// TestConfirmationGate_Lifecycle_SuspendedToResumed valida transição determinística SUSPENDED -> RESUMED.
func TestConfirmationGate_Lifecycle_SuspendedToResumed(t *testing.T) {
	gate, userID := setupConfirmationTestDB(t)
	ctx := context.Background()

	args, _ := json.Marshal(map[string]any{"title": "Reunião de Alinhamento", "start": "2026-11-01T10:00:00Z"})
	preview, _ := json.Marshal(map[string]any{"resumo": "Agendar Reunião de Alinhamento para 01/11 às 10:00"})

	req := &service.CreatePendingRequest{
		UserID:         userID,
		ThreadID:       "thread-1",
		Channel:        "app_mobile",
		ToolsetName:    "calendar_manager",
		Operation:      "create_event",
		ArgumentsJSON:  string(args),
		PreviewJSON:    string(preview),
		IdempotencyKey: "idem-req-1",
		TaintedContext: false,
		TTL:            15 * time.Minute,
	}

	// 1. Criação da confirmação pendente (estado inicial SUSPENDED)
	pending, err := gate.CreatePending(ctx, req)
	if err != nil {
		t.Fatalf("falha ao criar confirmação pendente: %v", err)
	}
	if string(pending.Status) != "SUSPENDED" {
		t.Fatalf("esperava status SUSPENDED, obteve %s", pending.Status)
	}
	if pending.ID == "" {
		t.Fatal("ID gerado não pode ser vazio")
	}

	// 2. Consulta pelo ID
	fetched, err := gate.GetByID(ctx, pending.ID, userID)
	if err != nil {
		t.Fatalf("falha ao consultar confirmação: %v", err)
	}
	if string(fetched.Status) != "SUSPENDED" {
		t.Errorf("esperava status SUSPENDED no banco, obteve %s", fetched.Status)
	}

	// 3. Usuário envia 'sim' -> ResumeConfirmation (transição para RESUMED)
	resumed, err := gate.Resume(ctx, pending.ID, userID)
	if err != nil {
		t.Fatalf("falha ao aprovar confirmação: %v", err)
	}
	if string(resumed.Status) != "RESUMED" {
		t.Errorf("esperava status RESUMED, obteve %s", resumed.Status)
	}
	if resumed.ResolvedAt == nil {
		t.Error("ResolvedAt deveria estar preenchido após aprovação")
	}
}

// TestConfirmationGate_IdempotencyKey_DuplicateCreation impede múltiplos registros idênticos suspensos.
func TestConfirmationGate_IdempotencyKey_DuplicateCreation(t *testing.T) {
	gate, userID := setupConfirmationTestDB(t)
	ctx := context.Background()

	req := &service.CreatePendingRequest{
		UserID:         userID,
		ThreadID:       "thread-1",
		Channel:        "app_mobile",
		ToolsetName:    "task_and_pending_manager",
		Operation:      "create_todo",
		ArgumentsJSON:  `{"title":"Comprar café"}`,
		IdempotencyKey: "unique-key-task-99",
		TTL:            10 * time.Minute,
	}

	// 1ª criação
	first, err := gate.CreatePending(ctx, req)
	if err != nil {
		t.Fatalf("erro na 1ª criação: %v", err)
	}

	// 2ª criação idêntica enquanto ainda SUSPENDED -> deve reutilizar determinístico
	second, err := gate.CreatePending(ctx, req)
	if err == nil {
		if second.ID != first.ID {
			t.Errorf("esperava reaproveitamento do ID %s, gerou novo ID %s", first.ID, second.ID)
		}
	} else if err != service.ErrDuplicatePendingConfirmation {
		t.Errorf("esperava ErrDuplicatePendingConfirmation, obteve: %v", err)
	}
}

// TestConfirmationGate_PreventDoubleResume garante que uma ação aprovada não pode ser reexecutada.
func TestConfirmationGate_PreventDoubleResume(t *testing.T) {
	gate, userID := setupConfirmationTestDB(t)
	ctx := context.Background()

	pending, err := gate.CreatePending(ctx, &service.CreatePendingRequest{
		UserID:         userID,
		ThreadID:       "thread-1",
		Channel:        "app_mobile",
		ToolsetName:    "whatsapp_assistant",
		Operation:      "send_message",
		ArgumentsJSON:  `{"to":"1199999999","text":"Oi"}`,
		IdempotencyKey: "send-msg-once",
		TTL:            10 * time.Minute,
	})
	if err != nil {
		t.Fatalf("falha ao criar: %v", err)
	}

	// 1ª aprovação: sucesso
	_, err = gate.Resume(ctx, pending.ID, userID)
	if err != nil {
		t.Fatalf("falha na 1ª aprovação: %v", err)
	}

	// 2ª aprovação imediata: deve ser categoricamente rejeitada
	_, err = gate.Resume(ctx, pending.ID, userID)
	if err == nil {
		t.Fatal("FALHA DE IDEMPOTÊNCIA: Confirmação já aprovada permitiu segundo Resume!")
	}
	if err != service.ErrConfirmationAlreadyResolved {
		t.Errorf("esperava ErrConfirmationAlreadyResolved, obteve %v", err)
	}
}

// TestConfirmationGate_Cancel_SuspendedToCancelled valida transição para CANCELLED.
func TestConfirmationGate_Cancel_SuspendedToCancelled(t *testing.T) {
	gate, userID := setupConfirmationTestDB(t)
	ctx := context.Background()

	pending, _ := gate.CreatePending(ctx, &service.CreatePendingRequest{
		UserID:         userID,
		ThreadID:       "thread-1",
		Channel:        "app_mobile",
		ToolsetName:    "task_and_pending_manager",
		Operation:      "delete_todo",
		ArgumentsJSON:  `{"id":"todo-123"}`,
		IdempotencyKey: "cancel-test",
		TTL:            10 * time.Minute,
	})

	// Rejeição pelo usuário
	err := gate.Cancel(ctx, pending.ID, userID)
	if err != nil {
		t.Fatalf("falha ao cancelar confirmação: %v", err)
	}

	fetched, _ := gate.GetByID(ctx, pending.ID, userID)
	if string(fetched.Status) != "CANCELLED" {
		t.Errorf("esperava status CANCELLED, obteve %s", fetched.Status)
	}

	// Tentar aprovar um item cancelado deve falhar
	_, err = gate.Resume(ctx, pending.ID, userID)
	if err != service.ErrConfirmationCancelled {
		t.Errorf("esperava ErrConfirmationCancelled, obteve %v", err)
	}
}

// TestConfirmationGate_Expiration valida expiração por TTL.
func TestConfirmationGate_Expiration(t *testing.T) {
	gate, userID := setupConfirmationTestDB(t)
	ctx := context.Background()

	// Criação com TTL expirado no passado
	pending, err := gate.CreatePending(ctx, &service.CreatePendingRequest{
		UserID:         userID,
		ThreadID:       "thread-1",
		Channel:        "app_mobile",
		ToolsetName:    "calendar_manager",
		Operation:      "delete_event",
		ArgumentsJSON:  `{"id":"evt-old"}`,
		IdempotencyKey: "expire-test",
		TTL:            -1 * time.Second, // Já expirado
	})
	if err != nil {
		t.Fatalf("falha ao criar: %v", err)
	}

	_, err = gate.Resume(ctx, pending.ID, userID)
	if err != service.ErrConfirmationExpired {
		t.Errorf("esperava ErrConfirmationExpired, obteve %v", err)
	}
}

// TestConfirmationGate_TenantIsolation impede que outro usuário acesse ou aprove a confirmação.
func TestConfirmationGate_TenantIsolation(t *testing.T) {
	gate, user1 := setupConfirmationTestDB(t)
	ctx := context.Background()
	user2 := "user-adversary-2"

	pending, _ := gate.CreatePending(ctx, &service.CreatePendingRequest{
		UserID:         user1,
		ThreadID:       "thread-1",
		Channel:        "app_mobile",
		ToolsetName:    "gmail_assistant",
		Operation:      "send_email",
		ArgumentsJSON:  `{"to":"boss@example.com"}`,
		IdempotencyKey: "isolation-test",
		TTL:            10 * time.Minute,
	})

	// User2 tenta aprovar ação do User1
	_, err := gate.Resume(ctx, pending.ID, user2)
	if err == nil {
		t.Fatal("FALHA DE ISOLAMENTO: Usuário não-proprietário conseguiu aprovar ação alheia!")
	}
}

func TestConfirmationGate_RepeatedEmptyIdempotencyKey_SupersedesAndSucceeds(t *testing.T) {
	gate, userID := setupConfirmationTestDB(t)
	ctx := context.Background()

	first, err := gate.CreatePending(ctx, &service.CreatePendingRequest{
		UserID:        userID,
		ThreadID:      "thread-1",
		Channel:       "app_mobile",
		ToolsetName:   "radar_and_trigger_manager",
		Operation:     "create_trigger",
		ArgumentsJSON: `{"title":"Bot Antigo","goal":"Monitorar dólar"}`,
		TTL:           15 * time.Minute,
	})
	if err != nil {
		t.Fatalf("falha na 1ª pendência: %v", err)
	}

	second, err := gate.CreatePending(ctx, &service.CreatePendingRequest{
		UserID:        userID,
		ThreadID:      "thread-1",
		Channel:       "app_mobile",
		ToolsetName:   "radar_and_trigger_manager",
		Operation:     "create_trigger",
		ArgumentsJSON: `{"title":"Bot Novo","goal":"Monitorar Poco X8 Pro"}`,
		TTL:           15 * time.Minute,
	})
	if err != nil {
		t.Fatalf("falha na 2ª pendência repetida sem idempotency_key: %v", err)
	}
	if second.ID == "" || second.ID == first.ID {
		t.Fatalf("esperava novo ID distinto de %s, obteve %q", first.ID, second.ID)
	}

	prev, err := gate.GetByID(ctx, first.ID, userID)
	if err != nil {
		t.Fatalf("falha ao consultar 1ª pendência: %v", err)
	}
	if prev.Status != service.StatusCancelled {
		t.Errorf("esperava 1ª pendência marcada como CANCELLED, obteve %s", prev.Status)
	}

	latest, err := gate.GetLatestPending(ctx, userID, "thread-1")
	if err != nil || latest == nil {
		t.Fatalf("GetLatestPending falhou: err=%v latest=%+v", err, latest)
	}
	if latest.ID != second.ID {
		t.Errorf("esperava GetLatestPending retornar %s, obteve %s", second.ID, latest.ID)
	}
}

func TestConfirmationGate_ExpiredSuspendedRowDoesNotBlockNewPending(t *testing.T) {
	gate, userID := setupConfirmationTestDB(t)
	ctx := context.Background()

	if _, err := gate.CreatePending(ctx, &service.CreatePendingRequest{
		UserID:        userID,
		ThreadID:      "thread-1",
		Channel:       "app_mobile",
		ToolsetName:   "radar_and_trigger_manager",
		Operation:     "create_trigger",
		ArgumentsJSON: `{"title":"Bot Expirado"}`,
		TTL:           -1 * time.Minute,
	}); err != nil {
		t.Fatalf("falha ao criar pendência expirada sem chave: %v", err)
	}

	if _, err := gate.CreatePending(ctx, &service.CreatePendingRequest{
		UserID:         userID,
		ThreadID:       "thread-1",
		Channel:        "app_mobile",
		ToolsetName:    "radar_and_trigger_manager",
		Operation:      "create_trigger",
		ArgumentsJSON:  `{"title":"Bot Expirado Com Chave"}`,
		IdempotencyKey: "same-key",
		TTL:            -1 * time.Minute,
	}); err != nil {
		t.Fatalf("falha ao criar pendência expirada com chave: %v", err)
	}

	freshEmpty, err := gate.CreatePending(ctx, &service.CreatePendingRequest{
		UserID:        userID,
		ThreadID:      "thread-1",
		Channel:       "app_mobile",
		ToolsetName:   "radar_and_trigger_manager",
		Operation:     "create_trigger",
		ArgumentsJSON: `{"title":"Bot Novo"}`,
		TTL:           10 * time.Minute,
	})
	if err != nil {
		t.Fatalf("linha expirada não deveria bloquear nova pendência sem chave: %v", err)
	}

	freshKey, err := gate.CreatePending(ctx, &service.CreatePendingRequest{
		UserID:         userID,
		ThreadID:       "thread-1",
		Channel:        "app_mobile",
		ToolsetName:    "radar_and_trigger_manager",
		Operation:      "create_trigger",
		ArgumentsJSON:  `{"title":"Bot Novo Chave"}`,
		IdempotencyKey: "same-key",
		TTL:            10 * time.Minute,
	})
	if err != nil {
		t.Fatalf("linha expirada não deveria bloquear nova pendência com mesma chave: %v", err)
	}
	if freshKey.ID == "" {
		t.Fatal("freshKey.ID vazio")
	}

	latest, err := gate.GetLatestPending(ctx, userID, "thread-1")
	if err != nil || latest == nil || latest.ID != freshKey.ID {
		t.Fatalf("esperava GetLatestPending retornar %s (e freshEmpty=%s válido), obteve latest=%+v err=%v", freshKey.ID, freshEmpty.ID, latest, err)
	}
}

func TestIsShortConfirmationReply_NaturalPortuguesePhrases(t *testing.T) {
	positives := []string{
		"ok", "beleza", "pode", "claro", "perfeito", "faz isso", "tá bom", "cria aí", "pode sim", "sim",
	}
	for _, phrase := range positives {
		if !service.IsShortConfirmationReply(phrase) {
			t.Errorf("esperava IsShortConfirmationReply(%q) == true", phrase)
		}
	}

	negatives := []string{
		"Crie um bot para monitorar dólar",
		"Quero criar um bot",
		"cancelar",
		"não",
	}
	for _, phrase := range negatives {
		if service.IsShortConfirmationReply(phrase) {
			t.Errorf("esperava IsShortConfirmationReply(%q) == false", phrase)
		}
	}
}
