package repository_test

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	_ "modernc.org/sqlite"
)

func setupTestP2PDB(t *testing.T) (*sql.DB, *repository.P2PInviteRepositorySQLite, *domain.User, *domain.User) {
	t.Helper()
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("erro ao abrir sqlite: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	user1 := &domain.User{
		ID:           "user-p2p-1",
		Name:         "André Victor",
		Email:        "andre@vito.app",
		PasswordHash: "pass1",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
	user2 := &domain.User{
		ID:           "user-p2p-2",
		Name:         "Beatriz Costa",
		Email:        "beatriz@vito.app",
		PasswordHash: "pass2",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
	_ = userRepo.Create(user1)
	_ = userRepo.Create(user2)

	repo := repository.NewP2PInviteRepositorySQLite(db)
	return db, repo, user1, user2
}

func TestP2PInviteRepository_CreateGetUpdate(t *testing.T) {
	db, repo, u1, u2 := setupTestP2PDB(t)
	defer db.Close()
	ctx := context.Background()

	now := time.Now().UTC().Truncate(time.Second)
	inv := &domain.P2PMeetingInvite{
		ID:              "inv-1",
		FromUserID:      u1.ID,
		ToUserID:        u2.ID,
		Title:           "Alinhamento Vito P2P",
		Description:     "Reunião direta in-app",
		StartAt:         now.Add(24 * time.Hour),
		EndAt:           now.Add(25 * time.Hour),
		DurationMinutes: 60,
		Status:          domain.P2PInviteStatusPending,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	if err := repo.Create(ctx, inv); err != nil {
		t.Fatalf("Create falhou: %v", err)
	}

	got, err := repo.GetByID(ctx, inv.ID)
	if err != nil {
		t.Fatalf("GetByID falhou: %v", err)
	}
	if got.Title != inv.Title || got.Status != domain.P2PInviteStatusPending {
		t.Errorf("dados divergentes: %+v", got)
	}
	if got.FromUserName != u1.Name || got.ToUserName != u2.Name {
		t.Errorf("enriquecimento de nomes falhou: from=%s, to=%s", got.FromUserName, got.ToUserName)
	}

	pendingU2, err := repo.ListPendingForUser(ctx, u2.ID)
	if err != nil {
		t.Fatalf("ListPendingForUser falhou: %v", err)
	}
	if len(pendingU2) != 1 || pendingU2[0].ID != inv.ID {
		t.Fatalf("esperava 1 convite pendente para u2, vieram: %+v", pendingU2)
	}

	// Atualiza para accepted com event IDs
	ev1 := "evt-1"
	ev2 := "evt-2"
	if err := repo.UpdateStatus(ctx, inv.ID, domain.P2PInviteStatusAccepted, &ev1, &ev2); err != nil {
		t.Fatalf("UpdateStatus falhou: %v", err)
	}

	updated, err := repo.GetByID(ctx, inv.ID)
	if err != nil {
		t.Fatal(err)
	}
	if updated.Status != domain.P2PInviteStatusAccepted {
		t.Errorf("status deveria ser accepted, veio %s", updated.Status)
	}
	if updated.EventIDFrom == nil || *updated.EventIDFrom != ev1 {
		t.Errorf("event_id_from inválido: %v", updated.EventIDFrom)
	}
	if updated.EventIDTo == nil || *updated.EventIDTo != ev2 {
		t.Errorf("event_id_to inválido: %v", updated.EventIDTo)
	}
}
