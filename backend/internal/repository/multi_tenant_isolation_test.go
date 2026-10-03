package repository_test

import (
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func setupMultiTenantTest(t *testing.T) (*repository.EventRepositorySQLite, *repository.TodoRepositorySQLite, *repository.MemoryRepositorySQLite) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_multitenant.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("falha ao abrir banco de teste multi-tenant: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	eventRepo := repository.NewEventRepository(db)
	todoRepo := repository.NewTodoRepository(db)
	memoryRepo := repository.NewMemoryRepository(db)

	now := time.Now().UTC()
	// Cria Usuário 1 (Alice)
	_ = userRepo.Create(&domain.User{
		ID:           "user-alice",
		Name:         "Alice",
		Email:        "alice@example.com",
		PasswordHash: "hash-alice",
		CreatedAt:    now,
		UpdatedAt:    now,
	})

	// Cria Usuário 2 (Bob)
	_ = userRepo.Create(&domain.User{
		ID:           "user-bob",
		Name:         "Bob",
		Email:        "bob@example.com",
		PasswordHash: "hash-bob",
		CreatedAt:    now,
		UpdatedAt:    now,
	})

	return eventRepo, todoRepo, memoryRepo
}

func TestMultiTenantIsolation_Events(t *testing.T) {
	eventRepo, _, _ := setupMultiTenantTest(t)
	now := time.Date(2026, 10, 15, 10, 0, 0, 0, time.UTC)

	aliceEvent := &domain.Event{
		ID:          "event-alice-1",
		UserID:      "user-alice",
		Title:       "Consulta Médica Alice",
		Description: "Detalhes confidenciais",
		Location:    "Hospital São José",
		StartAt:     now,
		EndAt:       now.Add(1 * time.Hour),
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := eventRepo.Create(aliceEvent); err != nil {
		t.Fatalf("falha ao criar evento de Alice: %v", err)
	}

	t.Run("Bob não pode ler evento de Alice por ID", func(t *testing.T) {
		ev, err := eventRepo.GetByID("event-alice-1", "user-bob")
		if err == nil || !errors.Is(err, domain.ErrEventNotFound) {
			t.Errorf("esperava domain.ErrEventNotFound ao Bob buscar evento de Alice, obteve ev=%v err=%v", ev, err)
		}
	})

	t.Run("Bob listando eventos não vê eventos de Alice", func(t *testing.T) {
		events, err := eventRepo.ListByUser("user-bob", now.Add(-24*time.Hour), now.Add(24*time.Hour))
		if err != nil {
			t.Fatalf("erro ao listar eventos de Bob: %v", err)
		}
		if len(events) != 0 {
			t.Errorf("esperava lista vazia para Bob, mas encontrou %d eventos", len(events))
		}
	})

	t.Run("Bob não tem conflito de horário com evento de Alice", func(t *testing.T) {
		conflict, err := eventRepo.CheckConflict("user-bob", now, now.Add(1*time.Hour), "")
		if err != nil {
			t.Fatalf("erro ao verificar conflito para Bob: %v", err)
		}
		if conflict.HasConflict {
			t.Errorf("conflito não deveria ocorrer entre usuários distintos!")
		}
	})

	t.Run("Bob não pode deletar evento de Alice", func(t *testing.T) {
		err := eventRepo.Delete("event-alice-1", "user-bob")
		if err == nil || !errors.Is(err, domain.ErrEventNotFound) {
			t.Errorf("esperava domain.ErrEventNotFound ao Bob tentar deletar evento de Alice, obteve: %v", err)
		}

		// Garante que o evento ainda existe para Alice
		ev, err := eventRepo.GetByID("event-alice-1", "user-alice")
		if err != nil || ev == nil {
			t.Errorf("evento de Alice foi indevidamente afetado ou deletado!")
		}
	})
}

func TestMultiTenantIsolation_Todos(t *testing.T) {
	_, todoRepo, _ := setupMultiTenantTest(t)
	now := time.Now().UTC()

	aliceTodo := &domain.Todo{
		ID:        "todo-alice-1",
		UserID:    "user-alice",
		Title:     "Comprar remédio confidencial",
		Status:    domain.TodoStatusPending,
		Priority:  "high",
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := todoRepo.Create(aliceTodo); err != nil {
		t.Fatalf("falha ao criar todo de Alice: %v", err)
	}

	t.Run("Bob não pode ler todo de Alice por ID", func(t *testing.T) {
		td, err := todoRepo.GetByID("todo-alice-1", "user-bob")
		if err == nil || !errors.Is(err, domain.ErrTodoNotFound) {
			t.Errorf("esperava domain.ErrTodoNotFound ao Bob buscar tarefa de Alice, obteve: %v", err)
		}
		if td != nil {
			t.Errorf("Bob não deveria receber dados da tarefa de Alice")
		}
	})

	t.Run("Bob listando tarefas não vê tarefas de Alice", func(t *testing.T) {
		todos, err := todoRepo.ListByUser("user-bob", "")
		if err != nil {
			t.Fatalf("erro ao listar tarefas de Bob: %v", err)
		}
		if len(todos) != 0 {
			t.Errorf("esperava lista vazia para Bob, mas obteve %d tarefas", len(todos))
		}
	})

	t.Run("Bob não pode alterar status de tarefa de Alice", func(t *testing.T) {
		err := todoRepo.UpdateStatus("todo-alice-1", "user-bob", domain.TodoStatusCompleted)
		if err == nil || !errors.Is(err, domain.ErrTodoNotFound) {
			t.Errorf("esperava domain.ErrTodoNotFound ao Bob alterar tarefa de Alice, obteve: %v", err)
		}

		// Verifica que a tarefa de Alice continua pendente
		td, err := todoRepo.GetByID("todo-alice-1", "user-alice")
		if err != nil || td.Status != domain.TodoStatusPending {
			t.Errorf("tarefa de Alice foi indevidamente alterada!")
		}
	})

	t.Run("Bob não pode deletar tarefa de Alice", func(t *testing.T) {
		err := todoRepo.Delete("todo-alice-1", "user-bob")
		if err == nil || !errors.Is(err, domain.ErrTodoNotFound) {
			t.Errorf("esperava domain.ErrTodoNotFound ao Bob deletar tarefa de Alice, obteve: %v", err)
		}

		td, err := todoRepo.GetByID("todo-alice-1", "user-alice")
		if err != nil || td == nil {
			t.Errorf("tarefa de Alice não deveria ter sido removida!")
		}
	})
}

func TestMultiTenantIsolation_Memories(t *testing.T) {
	_, _, memoryRepo := setupMultiTenantTest(t)
	now := time.Now().UTC()

	aliceMemory := &domain.Memory{
		ID:        "mem-alice-1",
		UserID:    "user-alice",
		Category:  "saúde",
		Content:   "Alice toma remédio X todos os dias às 08h",
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := memoryRepo.Create(aliceMemory); err != nil {
		t.Fatalf("falha ao criar memória de Alice: %v", err)
	}

	t.Run("Bob não pode ler memória de Alice por ID", func(t *testing.T) {
		m, err := memoryRepo.GetByID("mem-alice-1", "user-bob")
		if err == nil || !errors.Is(err, domain.ErrMemoryNotFound) {
			t.Errorf("esperava domain.ErrMemoryNotFound ao Bob buscar memória de Alice, obteve: %v", err)
		}
		if m != nil {
			t.Errorf("Bob não deveria ter acesso aos dados de memória de Alice")
		}
	})

	t.Run("Bob listando memórias não vê memórias de Alice", func(t *testing.T) {
		mems, err := memoryRepo.ListByUser("user-bob", 20)
		if err != nil {
			t.Fatalf("erro ao listar memórias de Bob: %v", err)
		}
		if len(mems) != 0 {
			t.Errorf("esperava 0 memórias para Bob, obteve %d", len(mems))
		}
	})

	t.Run("Bob não pode deletar memória de Alice", func(t *testing.T) {
		err := memoryRepo.Delete("mem-alice-1", "user-bob")
		if err == nil || !errors.Is(err, domain.ErrMemoryNotFound) {
			t.Errorf("esperava domain.ErrMemoryNotFound ao Bob deletar memória de Alice, obteve: %v", err)
		}

		m, err := memoryRepo.GetByID("mem-alice-1", "user-alice")
		if err != nil || m == nil {
			t.Errorf("memória de Alice não deveria ter sido removida!")
		}
	})
}
