package repository_test

import (
	"database/sql"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	_ "modernc.org/sqlite"
)

func setupPendingTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("falha ao inicializar banco de testes em memória: %v", err)
	}

	// Cria um usuário para satisfazer foreign keys
	userRepo := repository.NewUserRepository(db)
	user := &domain.User{
		ID:           "user-test-1",
		Name:         "André",
		Email:        "andre@vito.test",
		PasswordHash: "hash12345",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("falha ao criar usuário de teste: %v", err)
	}

	user2 := &domain.User{
		ID:           "user-test-2",
		Name:         "Carlos",
		Email:        "carlos@vito.test",
		PasswordHash: "hash12345",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
	if err := userRepo.Create(user2); err != nil {
		t.Fatalf("falha ao criar usuário de teste 2: %v", err)
	}

	return db
}

func TestPendingRepository_CRUD_And_MultiTenantIsolation(t *testing.T) {
	db := setupPendingTestDB(t)
	defer db.Close()

	repo := repository.NewPendingRepository(db)
	now := time.Now().UTC()

	item := &domain.PendingItem{
		ID:            "pend-1",
		UserID:        "user-test-1",
		Title:         "Renovar Passaporte",
		Description:   "Agendar na Polícia Federal antes de Dezembro",
		Category:      "documentos",
		Status:        domain.PendingStatusInbox,
		ScheduledDate: "",
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	// 1. Create
	if err := repo.Create(item); err != nil {
		t.Fatalf("falha ao criar pendência: %v", err)
	}

	// 2. GetByID
	fetched, err := repo.GetByID("pend-1", "user-test-1")
	if err != nil {
		t.Fatalf("falha ao buscar pendência: %v", err)
	}
	if fetched.Title != item.Title || fetched.Category != item.Category {
		t.Fatalf("dados divergentes: obtido %+v", fetched)
	}

	// 3. Multi-Tenant Isolation: user-test-2 NÃO pode ver o item de user-test-1
	_, err = repo.GetByID("pend-1", "user-test-2")
	if err != domain.ErrPendingItemNotFound {
		t.Fatalf("esperava ErrPendingItemNotFound para outro usuário, obteve %v", err)
	}

	// 4. Update
	fetched.Status = domain.PendingStatusScheduled
	fetched.ScheduledDate = "2026-10-25"
	if err := repo.Update(fetched); err != nil {
		t.Fatalf("falha ao atualizar pendência: %v", err)
	}

	updated, err := repo.GetByID("pend-1", "user-test-1")
	if err != nil {
		t.Fatalf("falha ao rebuscar pendência: %v", err)
	}
	if updated.Status != domain.PendingStatusScheduled || updated.ScheduledDate != "2026-10-25" {
		t.Fatalf("status ou data divergente após update: %+v", updated)
	}

	// 5. ListByUser com filtros
	scheduledStatus := domain.PendingStatusScheduled
	list, err := repo.ListByUser("user-test-1", &scheduledStatus, "documentos")
	if err != nil {
		t.Fatalf("falha ao listar pendências: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("esperava 1 item na listagem filtrada, obteve %d", len(list))
	}

	// 6. Delete
	if err := repo.Delete("pend-1", "user-test-1"); err != nil {
		t.Fatalf("falha ao deletar pendência: %v", err)
	}

	_, err = repo.GetByID("pend-1", "user-test-1")
	if err != domain.ErrPendingItemNotFound {
		t.Fatalf("item ainda encontrado após deleção: %v", err)
	}
}

func TestPendingRepository_NudgeQuery(t *testing.T) {
	db := setupPendingTestDB(t)
	defer db.Close()

	repo := repository.NewPendingRepository(db)
	now := time.Now().UTC()

	// Item criado há 48 horas (elegível para nudge)
	oldItem := &domain.PendingItem{
		ID:          "pend-old",
		UserID:      "user-test-1",
		Title:       "Checar Extrato Bancário",
		Category:    "financas",
		Status:      domain.PendingStatusInbox,
		CreatedAt:   now.Add(-48 * time.Hour),
		UpdatedAt:   now.Add(-48 * time.Hour),
		NudgeSentAt: nil,
	}
	if err := repo.Create(oldItem); err != nil {
		t.Fatalf("falha ao criar pendência antiga: %v", err)
	}

	// Item recente criado há 2 horas (não deve receber nudge)
	recentItem := &domain.PendingItem{
		ID:          "pend-recent",
		UserID:      "user-test-1",
		Title:       "Comprar café",
		Category:    "geral",
		Status:      domain.PendingStatusInbox,
		CreatedAt:   now.Add(-2 * time.Hour),
		UpdatedAt:   now.Add(-2 * time.Hour),
		NudgeSentAt: nil,
	}
	if err := repo.Create(recentItem); err != nil {
		t.Fatalf("falha ao criar pendência recente: %v", err)
	}

	cutoff := now.Add(-24 * time.Hour)
	dueList, err := repo.ListUnscheduledDueForNudge(cutoff)
	if err != nil {
		t.Fatalf("falha ao buscar pendências para nudge: %v", err)
	}
	if len(dueList) != 1 || dueList[0].ID != "pend-old" {
		t.Fatalf("esperava somente pend-old na lista de nudge, obteve %+v", dueList)
	}

	// Marca nudge como enviado hoje
	if err := repo.MarkNudgeSent("pend-old", now); err != nil {
		t.Fatalf("falha ao marcar nudge: %v", err)
	}

	// Agora a lista não deve retornar nada
	dueListAfter, err := repo.ListUnscheduledDueForNudge(cutoff)
	if err != nil {
		t.Fatalf("falha ao buscar pós-nudge: %v", err)
	}
	if len(dueListAfter) != 0 {
		t.Fatalf("não deveria retornar itens após nudge enviado hoje, obteve %+v", dueListAfter)
	}
}
