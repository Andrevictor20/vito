package service_test

import (
	"context"
	"database/sql"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	_ "modernc.org/sqlite"
)

type meetingTestContext struct {
	db          *sql.DB
	user        *domain.User
	meetingRepo domain.MeetingRepository
	eventRepo   domain.EventRepository
	meetingSvc  *service.MeetingService
}

func setupMeetingTest(t *testing.T) *meetingTestContext {
	t.Helper()
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("erro ao abrir sqlite: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	eventRepo := repository.NewEventRepository(db)
	meetingRepo := repository.NewMeetingRepositorySQLite(db)

	user := &domain.User{
		ID:           "user-meeting-host",
		Name:         "André Victor",
		Email:        "andre@vito.app",
		PasswordHash: "secret123",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("erro ao criar usuário: %v", err)
	}

	shortener := service.NewShortIoShortenerService("", "", "https://vito.s.gy")
	meetingSvc := service.NewMeetingService(
		meetingRepo,
		eventRepo,
		nil, // notificationSvc
		shortener,
		"https://vito.app",
	)

	return &meetingTestContext{
		db:          db,
		user:        user,
		meetingRepo: meetingRepo,
		eventRepo:   eventRepo,
		meetingSvc:  meetingSvc,
	}
}

func TestMeetingService_CreateMeeting(t *testing.T) {
	tc := setupMeetingTest(t)
	defer tc.db.Close()
	ctx := context.Background()

	now := time.Now().UTC().Truncate(time.Second)
	req := service.CreateMeetingRequest{
		UserID:          tc.user.ID,
		Title:           "Alinhamento Estratégico",
		Description:     "Definição das metas da Sprint 11",
		DurationMinutes: 45,
		Mode:            domain.MeetingModeOneOnOne,
		Slots: []service.MeetingSlotInput{
			{StartAt: now.Add(24 * time.Hour), EndAt: now.Add(24*time.Hour + 45*time.Minute)},
			{StartAt: now.Add(26 * time.Hour), EndAt: now.Add(26*time.Hour + 45*time.Minute)},
		},
	}

	details, err := tc.meetingSvc.CreateMeeting(ctx, req)
	if err != nil {
		t.Fatalf("CreateMeeting falhou: %v", err)
	}

	if details.ID == "" || details.Title != req.Title {
		t.Errorf("dados divergentes: %+v", details)
	}
	if len(details.Slots) != 2 {
		t.Fatalf("esperava 2 slots, vieram %d", len(details.Slots))
	}
	if details.ShortURL == "" {
		t.Errorf("ShortURL não deveria estar vazio")
	}
}

func TestMeetingService_SubmitVote_OneOnOne(t *testing.T) {
	tc := setupMeetingTest(t)
	defer tc.db.Close()
	ctx := context.Background()

	now := time.Now().UTC().Truncate(time.Second)
	req := service.CreateMeetingRequest{
		UserID:          tc.user.ID,
		Title:           "Alinhamento 1-on-1",
		DurationMinutes: 30,
		Mode:            domain.MeetingModeOneOnOne,
		Slots: []service.MeetingSlotInput{
			{StartAt: now.Add(24 * time.Hour), EndAt: now.Add(24*time.Hour + 30*time.Minute)},
		},
	}

	m, err := tc.meetingSvc.CreateMeeting(ctx, req)
	if err != nil {
		t.Fatal(err)
	}
	slotID := m.Slots[0].ID

	voteReq := service.SubmitVoteRequest{
		MeetingID:       m.ID,
		ParticipantName: "Beatriz Oliveira",
		ContactInfo:     "beatriz@empresa.com",
		SlotIDs:         []string{slotID},
	}

	res, err := tc.meetingSvc.SubmitVote(ctx, voteReq)
	if err != nil {
		t.Fatalf("SubmitVote falhou: %v", err)
	}

	if res.MeetingStatus != domain.MeetingStatusConfirmed {
		t.Fatalf("esperava status confirmed para 1-on-1, veio %s", res.MeetingStatus)
	}

	// Verifica se o evento foi criado na agenda do anfitrião
	events, err := tc.eventRepo.ListByUser(tc.user.ID, now, now.Add(7*24*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 1 {
		t.Fatalf("esperava 1 evento criado na agenda, vieram %d", len(events))
	}
	if !strings.Contains(events[0].Title, "Beatriz Oliveira") {
		t.Errorf("título do evento não contém nome da participante: %s", events[0].Title)
	}
	if events[0].Category != "meeting" || events[0].Source != "vito_meeting" {
		t.Errorf("categoria ou source inválidos: category=%s source=%s", events[0].Category, events[0].Source)
	}

	// Segundo voto na mesma reunião 1-on-1 deve falhar com ErrMeetingAlreadyConfirmed
	_, err = tc.meetingSvc.SubmitVote(ctx, voteReq)
	if err != domain.ErrMeetingAlreadyConfirmed {
		t.Fatalf("esperava ErrMeetingAlreadyConfirmed, veio: %v", err)
	}
}

func TestMeetingService_SubmitVote_GroupConsensusAndConfirmation(t *testing.T) {
	tc := setupMeetingTest(t)
	defer tc.db.Close()
	ctx := context.Background()

	now := time.Now().UTC().Truncate(time.Second)
	req := service.CreateMeetingRequest{
		UserID:          tc.user.ID,
		Title:           "Sessão de Brainstorming",
		DurationMinutes: 60,
		Mode:            domain.MeetingModeGroupConsensus,
		Slots: []service.MeetingSlotInput{
			{StartAt: now.Add(24 * time.Hour), EndAt: now.Add(25 * time.Hour)},
			{StartAt: now.Add(26 * time.Hour), EndAt: now.Add(27 * time.Hour)},
		},
	}

	m, err := tc.meetingSvc.CreateMeeting(ctx, req)
	if err != nil {
		t.Fatal(err)
	}
	slot1 := m.Slots[0].ID
	slot2 := m.Slots[1].ID

	// Participante 1 vota no slot 1 e 2
	_, err = tc.meetingSvc.SubmitVote(ctx, service.SubmitVoteRequest{
		MeetingID:       m.ID,
		ParticipantName: "Carlos",
		SlotIDs:         []string{slot1, slot2},
	})
	if err != nil {
		t.Fatalf("voto de Carlos falhou: %v", err)
	}

	// Participante 2 vota apenas no slot 1
	_, err = tc.meetingSvc.SubmitVote(ctx, service.SubmitVoteRequest{
		MeetingID:       m.ID,
		ParticipantName: "Daniela",
		SlotIDs:         []string{slot1},
	})
	if err != nil {
		t.Fatalf("voto de Daniela falhou: %v", err)
	}

	// Estado continua 'open' no modo grupo
	details, err := tc.meetingSvc.GetMeetingDetails(ctx, m.ID)
	if err != nil {
		t.Fatal(err)
	}
	if details.Status != domain.MeetingStatusOpen {
		t.Fatalf("status deveria ser open, veio %s", details.Status)
	}
	if details.Slots[0].VotesCount != 2 || details.Slots[1].VotesCount != 1 {
		t.Fatalf("contagem de votos inconsistente: slot1=%d, slot2=%d", details.Slots[0].VotesCount, details.Slots[1].VotesCount)
	}

	// Anfitrião confirma o slot mais votado (slot 1)
	err = tc.meetingSvc.ConfirmConsensusSlot(ctx, tc.user.ID, m.ID, slot1)
	if err != nil {
		t.Fatalf("ConfirmConsensusSlot falhou: %v", err)
	}

	updatedDetails, err := tc.meetingSvc.GetMeetingDetails(ctx, m.ID)
	if err != nil {
		t.Fatal(err)
	}
	if updatedDetails.Status != domain.MeetingStatusConfirmed {
		t.Fatalf("status deveria ser confirmed, veio %s", updatedDetails.Status)
	}

	// Verifica se o evento foi criado na agenda
	events, err := tc.eventRepo.ListByUser(tc.user.ID, now, now.Add(7*24*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 1 {
		t.Fatalf("esperava 1 evento agendado, vieram %d", len(events))
	}
	if !strings.Contains(events[0].Title, "Sessão de Brainstorming") {
		t.Errorf("título inesperado: %s", events[0].Title)
	}
}

func TestMeetingService_WhatsAppShareMessage(t *testing.T) {
	tc := setupMeetingTest(t)
	defer tc.db.Close()
	ctx := context.Background()

	now := time.Now().UTC().Truncate(time.Second)
	m, err := tc.meetingSvc.CreateMeeting(ctx, service.CreateMeetingRequest{
		UserID:          tc.user.ID,
		Title:           "Feedback Semanal",
		DurationMinutes: 30,
		Mode:            domain.MeetingModeOneOnOne,
		Slots: []service.MeetingSlotInput{
			{StartAt: now.Add(24 * time.Hour), EndAt: now.Add(24*time.Hour + 30*time.Minute)},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	share, err := tc.meetingSvc.GenerateWhatsAppShare(ctx, tc.user.ID, m.ID)
	if err != nil {
		t.Fatalf("GenerateWhatsAppShare falhou: %v", err)
	}

	if !strings.Contains(share.MessageText, "Feedback Semanal") {
		t.Errorf("texto da mensagem não contém título: %s", share.MessageText)
	}
	if !strings.Contains(share.MessageText, m.ShortURL) {
		t.Errorf("texto não contém ShortURL: %s", share.MessageText)
	}
	if !strings.HasPrefix(share.WhatsAppDeepLink, "whatsapp://send?text=") {
		t.Errorf("deep link inválido: %s", share.WhatsAppDeepLink)
	}
	if !strings.HasPrefix(share.WhatsAppWebURL, "https://wa.me/?text=") {
		t.Errorf("web url inválida: %s", share.WhatsAppWebURL)
	}
}

func TestMeetingService_XSSSanitization(t *testing.T) {
	tc := setupMeetingTest(t)
	defer tc.db.Close()
	ctx := context.Background()

	now := time.Now().UTC().Truncate(time.Second)
	m, err := tc.meetingSvc.CreateMeeting(ctx, service.CreateMeetingRequest{
		UserID:          tc.user.ID,
		Title:           "<script>alert('pwn')</script>Sprint Review",
		DurationMinutes: 30,
		Mode:            domain.MeetingModeOneOnOne,
		Slots: []service.MeetingSlotInput{
			{StartAt: now.Add(24 * time.Hour), EndAt: now.Add(24*time.Hour + 30*time.Minute)},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	if strings.Contains(m.Title, "<script>") {
		t.Errorf("título não foi sanitizado: %s", m.Title)
	}

	res, err := tc.meetingSvc.SubmitVote(ctx, service.SubmitVoteRequest{
		MeetingID:       m.ID,
		ParticipantName: "<b>Lucas</b><script>bad()</script>",
		ContactInfo:     "lucas@teste.com",
		SlotIDs:         []string{m.Slots[0].ID},
	})
	if err != nil {
		t.Fatal(err)
	}

	parts, err := tc.meetingRepo.ListParticipants(ctx, m.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(parts) == 0 || strings.Contains(parts[0].Name, "<script>") {
		t.Errorf("participante não foi sanitizado: %+v", parts)
	}
	_ = res
}
