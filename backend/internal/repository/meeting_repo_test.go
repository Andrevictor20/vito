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

func setupTestMeetingDB(t *testing.T) (*sql.DB, *repository.MeetingRepositorySQLite, *domain.User) {
	t.Helper()
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("erro ao abrir sqlite em memória: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	user := &domain.User{
		ID:           "user-meeting-1",
		Name:         "André Victor",
		Email:        "andre@vito.app",
		PasswordHash: "hash123",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("erro ao criar usuário de teste: %v", err)
	}

	repo := repository.NewMeetingRepositorySQLite(db)
	return db, repo, user
}

func TestMeetingRepository_CreateAndGet(t *testing.T) {
	db, repo, user := setupTestMeetingDB(t)
	defer db.Close()
	ctx := context.Background()

	now := time.Now().UTC().Truncate(time.Second)
	m := &domain.Meeting{
		ID:              "meet-1",
		UserID:          user.ID,
		Title:           "Alinhamento Trimestral",
		Description:     "Reunião de alinhamento com a diretoria",
		DurationMinutes: 60,
		Mode:            domain.MeetingModeOneOnOne,
		Status:          domain.MeetingStatusOpen,
		ShortURL:        "https://vito.s.gy/m/meet-1",
		ExpiresAt:       now.Add(48 * time.Hour),
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	slots := []domain.MeetingSlot{
		{
			ID:        "slot-1",
			MeetingID: m.ID,
			StartAt:   now.Add(24 * time.Hour),
			EndAt:     now.Add(25 * time.Hour),
			CreatedAt: now,
		},
		{
			ID:        "slot-2",
			MeetingID: m.ID,
			StartAt:   now.Add(26 * time.Hour),
			EndAt:     now.Add(27 * time.Hour),
			CreatedAt: now,
		},
	}

	if err := repo.Create(ctx, m, slots); err != nil {
		t.Fatalf("Create falhou: %v", err)
	}

	got, err := repo.GetByID(ctx, m.ID)
	if err != nil {
		t.Fatalf("GetByID falhou: %v", err)
	}
	if got.Title != m.Title || got.Mode != m.Mode || got.Status != domain.MeetingStatusOpen {
		t.Errorf("dados divergentes: %+v", got)
	}

	gotSlots, err := repo.ListSlots(ctx, m.ID)
	if err != nil {
		t.Fatalf("ListSlots falhou: %v", err)
	}
	if len(gotSlots) != 2 {
		t.Fatalf("esperava 2 slots, vieram %d", len(gotSlots))
	}
}

func TestMeetingRepository_ListByUserAndIsolation(t *testing.T) {
	db, repo, user := setupTestMeetingDB(t)
	defer db.Close()
	ctx := context.Background()

	now := time.Now().UTC().Truncate(time.Second)
	m1 := &domain.Meeting{
		ID:              "meet-u1",
		UserID:          user.ID,
		Title:           "Reunião 1",
		DurationMinutes: 30,
		Mode:            domain.MeetingModeOneOnOne,
		Status:          domain.MeetingStatusOpen,
		ExpiresAt:       now.Add(24 * time.Hour),
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if err := repo.Create(ctx, m1, nil); err != nil {
		t.Fatal(err)
	}

	m2 := &domain.Meeting{
		ID:              "meet-u2",
		UserID:          "outro-user",
		Title:           "Reunião Outro",
		DurationMinutes: 30,
		Mode:            domain.MeetingModeGroupConsensus,
		Status:          domain.MeetingStatusOpen,
		ExpiresAt:       now.Add(24 * time.Hour),
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	// bypass FK check se outro user não existe inserindo direto com user_id do outro se foreign_keys permitisse ou inserindo user2
	userRepo := repository.NewUserRepository(db)
	user2 := &domain.User{
		ID:           "outro-user",
		Name:         "Outro",
		Email:        "outro@vito.app",
		PasswordHash: "hash123",
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := userRepo.Create(user2); err != nil {
		t.Fatal(err)
	}
	if err := repo.Create(ctx, m2, nil); err != nil {
		t.Fatal(err)
	}

	listUser1, err := repo.ListByUser(ctx, user.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(listUser1) != 1 || listUser1[0].ID != "meet-u1" {
		t.Fatalf("isolamento multi-tenant falhou: %+v", listUser1)
	}

	_, err = repo.GetByIDAndUser(ctx, "meet-u2", user.ID)
	if err != domain.ErrMeetingNotFound {
		t.Fatalf("esperava ErrMeetingNotFound para meeting de outro user, veio %v", err)
	}
}

func TestMeetingRepository_VotingAndConfirmation(t *testing.T) {
	db, repo, user := setupTestMeetingDB(t)
	defer db.Close()
	ctx := context.Background()

	now := time.Now().UTC().Truncate(time.Second)
	m := &domain.Meeting{
		ID:              "meet-vote-1",
		UserID:          user.ID,
		Title:           "Planejamento Sprint",
		DurationMinutes: 45,
		Mode:            domain.MeetingModeGroupConsensus,
		Status:          domain.MeetingStatusOpen,
		ExpiresAt:       now.Add(48 * time.Hour),
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	slot1 := domain.MeetingSlot{
		ID:        "slot-v1",
		MeetingID: m.ID,
		StartAt:   now.Add(10 * time.Hour),
		EndAt:     now.Add(11 * time.Hour),
		CreatedAt: now,
	}
	slot2 := domain.MeetingSlot{
		ID:        "slot-v2",
		MeetingID: m.ID,
		StartAt:   now.Add(12 * time.Hour),
		EndAt:     now.Add(13 * time.Hour),
		CreatedAt: now,
	}
	if err := repo.Create(ctx, m, []domain.MeetingSlot{slot1, slot2}); err != nil {
		t.Fatal(err)
	}

	p1 := &domain.MeetingParticipant{
		ID:          "part-1",
		MeetingID:   m.ID,
		Name:        "Carlos Silva",
		ContactInfo: "carlos@email.com",
		RespondedAt: now,
		CreatedAt:   now,
	}
	if err := repo.AddParticipant(ctx, p1); err != nil {
		t.Fatalf("AddParticipant falhou: %v", err)
	}

	vote1 := &domain.MeetingVote{
		ID:            "vote-1",
		MeetingID:     m.ID,
		SlotID:        slot1.ID,
		ParticipantID: p1.ID,
		CreatedAt:     now,
	}
	if err := repo.RecordVote(ctx, vote1); err != nil {
		t.Fatalf("RecordVote falhou: %v", err)
	}

	// Segundo voto no mesmo slot pelo mesmo participante deve retornar ErrParticipantAlreadyVoted
	if err := repo.RecordVote(ctx, vote1); err != domain.ErrParticipantAlreadyVoted {
		t.Fatalf("esperava ErrParticipantAlreadyVoted, veio: %v", err)
	}

	// Checar votos do slot1
	updatedSlot1, err := repo.GetSlotByID(ctx, slot1.ID)
	if err != nil {
		t.Fatal(err)
	}
	if updatedSlot1.VotesCount != 1 {
		t.Fatalf("esperava 1 voto no slot1, vieram %d", updatedSlot1.VotesCount)
	}

	// Confirmar slot1
	if err := repo.ConfirmMeetingSlot(ctx, m.ID, slot1.ID, slot1.StartAt, slot1.EndAt); err != nil {
		t.Fatalf("ConfirmMeetingSlot falhou: %v", err)
	}

	confirmedM, err := repo.GetByID(ctx, m.ID)
	if err != nil {
		t.Fatal(err)
	}
	if confirmedM.Status != domain.MeetingStatusConfirmed {
		t.Fatalf("esperava status confirmed, veio %s", confirmedM.Status)
	}
	if confirmedM.ConfirmedSlotID == nil || *confirmedM.ConfirmedSlotID != slot1.ID {
		t.Fatalf("slot confirmado inválido: %v", confirmedM.ConfirmedSlotID)
	}
}

func TestMeetingRepository_CascadeDelete(t *testing.T) {
	db, repo, user := setupTestMeetingDB(t)
	defer db.Close()
	ctx := context.Background()

	now := time.Now().UTC().Truncate(time.Second)
	m := &domain.Meeting{
		ID:              "meet-del-1",
		UserID:          user.ID,
		Title:           "Reunião a Excluir",
		DurationMinutes: 30,
		Mode:            domain.MeetingModeOneOnOne,
		Status:          domain.MeetingStatusOpen,
		ExpiresAt:       now.Add(24 * time.Hour),
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	slot := domain.MeetingSlot{
		ID:        "slot-del-1",
		MeetingID: m.ID,
		StartAt:   now.Add(24 * time.Hour),
		EndAt:     now.Add(25 * time.Hour),
		CreatedAt: now,
	}
	if err := repo.Create(ctx, m, []domain.MeetingSlot{slot}); err != nil {
		t.Fatal(err)
	}

	p := &domain.MeetingParticipant{
		ID:          "part-del-1",
		MeetingID:   m.ID,
		Name:        "Mariana",
		RespondedAt: now,
		CreatedAt:   now,
	}
	if err := repo.AddParticipant(ctx, p); err != nil {
		t.Fatal(err)
	}

	if err := repo.Delete(ctx, m.ID, user.ID); err != nil {
		t.Fatalf("Delete falhou: %v", err)
	}

	_, err := repo.GetByID(ctx, m.ID)
	if err != domain.ErrMeetingNotFound {
		t.Fatalf("esperava ErrMeetingNotFound após delete, veio %v", err)
	}

	slots, _ := repo.ListSlots(ctx, m.ID)
	if len(slots) != 0 {
		t.Fatalf("slots deveriam ser deletados em cascata, vieram %d", len(slots))
	}
}
