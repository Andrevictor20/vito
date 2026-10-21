package service_test

import (
	"context"
	"database/sql"
	"net/smtp"
	"strings"
	"sync"
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
	meetingSvc.SetUserRepository(userRepo)

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

func TestMeetingService_VoterNamesAndParticipantVotedSlots(t *testing.T) {
	tc := setupMeetingTest(t)
	defer tc.db.Close()
	ctx := context.Background()

	now := time.Now().UTC().Truncate(time.Second)
	m, err := tc.meetingSvc.CreateMeeting(ctx, service.CreateMeetingRequest{
		UserID:          tc.user.ID,
		Title:           "Design Review",
		DurationMinutes: 30,
		Mode:            domain.MeetingModeGroupConsensus,
		Slots: []service.MeetingSlotInput{
			{StartAt: now.Add(24 * time.Hour), EndAt: now.Add(24*time.Hour + 30*time.Minute)},
			{StartAt: now.Add(26 * time.Hour), EndAt: now.Add(26*time.Hour + 30*time.Minute)},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	slot1 := m.Slots[0].ID
	slot2 := m.Slots[1].ID

	_, err = tc.meetingSvc.SubmitVote(ctx, service.SubmitVoteRequest{
		MeetingID:       m.ID,
		ParticipantName: "Ana Silva",
		ContactInfo:     "11999999999",
		SlotIDs:         []string{slot1, slot2},
	})
	if err != nil {
		t.Fatal(err)
	}

	_, err = tc.meetingSvc.SubmitVote(ctx, service.SubmitVoteRequest{
		MeetingID:       m.ID,
		ParticipantName: "Bruno Costa",
		SlotIDs:         []string{slot1},
	})
	if err != nil {
		t.Fatal(err)
	}

	details, err := tc.meetingSvc.GetMeetingDetails(ctx, m.ID)
	if err != nil {
		t.Fatal(err)
	}

	if len(details.Slots[0].VoterNames) != 2 || details.Slots[0].VoterNames[0] != "Ana Silva" || details.Slots[0].VoterNames[1] != "Bruno Costa" {
		t.Fatalf("esperava VoterNames=[Ana Silva, Bruno Costa] no slot 1, veio %+v", details.Slots[0].VoterNames)
	}
	if !details.Slots[0].IsWinner {
		t.Errorf("slot 1 deveria estar marcado como IsWinner=true")
	}
	if len(details.Slots[1].VoterNames) != 1 || details.Slots[1].VoterNames[0] != "Ana Silva" {
		t.Fatalf("esperava VoterNames=[Ana Silva] no slot 2, veio %+v", details.Slots[1].VoterNames)
	}
	if len(details.Participants) != 2 || len(details.Participants[0].VotedSlotIDs) != 2 {
		t.Fatalf("esperava VotedSlotIDs populado no participante 1, veio %+v", details.Participants)
	}

	// ListUserMeetings deve retornar MeetingWithDetails com Slots e Participants populados
	list, err := tc.meetingSvc.ListUserMeetings(ctx, tc.user.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || len(list[0].Slots) != 2 || len(list[0].Participants) != 2 {
		t.Fatalf("ListUserMeetings deveria retornar detalhes completos: %+v", list)
	}
}

func TestMeetingService_UpdateMeeting_PreservesVotesOnMatchingSlots(t *testing.T) {
	tc := setupMeetingTest(t)
	defer tc.db.Close()
	ctx := context.Background()

	t1 := time.Date(2026, 10, 19, 21, 0, 0, 0, time.UTC)
	t2 := time.Date(2026, 10, 20, 21, 0, 0, 0, time.UTC)
	t3 := time.Date(2026, 10, 21, 21, 0, 0, 0, time.UTC)

	m, err := tc.meetingSvc.CreateMeeting(ctx, service.CreateMeetingRequest{
		UserID:          tc.user.ID,
		Title:           "Reunião Original",
		Description:     "Pauta 1",
		DurationMinutes: 30,
		Mode:            domain.MeetingModeGroupConsensus,
		Slots: []service.MeetingSlotInput{
			{StartAt: t1, EndAt: t1.Add(30 * time.Minute)},
			{StartAt: t2, EndAt: t2.Add(30 * time.Minute)},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	// Alguém vota no primeiro slot (t1)
	_, err = tc.meetingSvc.SubmitVote(ctx, service.SubmitVoteRequest{
		MeetingID:       m.ID,
		ParticipantName: "Mariana",
		SlotIDs:         []string{m.Slots[0].ID},
	})
	if err != nil {
		t.Fatal(err)
	}

	// Atualiza mantendo t1, removendo t2 e adicionando t3
	updated, err := tc.meetingSvc.UpdateMeeting(ctx, tc.user.ID, m.ID, service.UpdateMeetingRequest{
		Title:           "Reunião Editada",
		Description:     "Nova Pauta",
		DurationMinutes: 45,
		Slots: []service.MeetingSlotInput{
			{StartAt: t1, EndAt: t1.Add(45 * time.Minute)},
			{StartAt: t3, EndAt: t3.Add(45 * time.Minute)},
		},
	})
	if err != nil {
		t.Fatalf("UpdateMeeting falhou: %v", err)
	}

	if updated.Title != "Reunião Editada" || updated.DurationMinutes != 45 {
		t.Fatalf("metadados não foram atualizados: %+v", updated)
	}
	if len(updated.Slots) != 2 {
		t.Fatalf("esperava 2 slots após update, vieram %d", len(updated.Slots))
	}
	if updated.Slots[0].VotesCount != 1 || len(updated.Slots[0].VoterNames) != 1 || updated.Slots[0].VoterNames[0] != "Mariana" {
		t.Fatalf("voto de Mariana no slot t1 deveria ter sido preservado: %+v", updated.Slots[0])
	}
	if updated.Slots[1].VotesCount != 0 {
		t.Fatalf("novo slot t3 deveria ter 0 votos: %+v", updated.Slots[1])
	}
}

func TestMeetingService_ChangeVote_AntiDuplicationAndCorrection(t *testing.T) {
	tc := setupMeetingTest(t)
	defer tc.db.Close()
	ctx := context.Background()

	now := time.Now().UTC().Truncate(time.Second)
	t1 := now.Add(24 * time.Hour)
	t2 := now.Add(48 * time.Hour)
	t3 := now.Add(72 * time.Hour)

	m, err := tc.meetingSvc.CreateMeeting(ctx, service.CreateMeetingRequest{
		UserID:          tc.user.ID,
		Title:           "Planejamento Trimestral",
		DurationMinutes: 60,
		Mode:            domain.MeetingModeGroupConsensus,
		Slots: []service.MeetingSlotInput{
			{StartAt: t1, EndAt: t1.Add(time.Hour)},
			{StartAt: t2, EndAt: t2.Add(time.Hour)},
			{StartAt: t3, EndAt: t3.Add(time.Hour)},
		},
	})
	if err != nil {
		t.Fatalf("CreateMeeting falhou: %v", err)
	}

	slot0 := m.Slots[0].ID
	slot1 := m.Slots[1].ID
	slot2 := m.Slots[2].ID

	// 1. Carlos vota inicialmente no Slot 0
	res1, err := tc.meetingSvc.SubmitVote(ctx, service.SubmitVoteRequest{
		MeetingID:       m.ID,
		ParticipantName: "Carlos Pereira",
		ContactInfo:     "carlos@empresa.com",
		SlotIDs:         []string{slot0},
	})
	if err != nil {
		t.Fatalf("primeiro voto de Carlos falhou: %v", err)
	}
	if res1.IsVoteUpdate {
		t.Errorf("primeiro voto não deveria ser IsVoteUpdate")
	}
	if res1.ParticipantID == "" {
		t.Errorf("esperava ParticipantID preenchido")
	}

	// Verifica estado após primeiro voto
	d1, err := tc.meetingSvc.GetMeetingDetails(ctx, m.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(d1.Participants) != 1 {
		t.Fatalf("esperava 1 participante, vieram %d", len(d1.Participants))
	}
	if d1.Slots[0].VotesCount != 1 || d1.Slots[1].VotesCount != 0 || d1.Slots[2].VotesCount != 0 {
		t.Fatalf("contagem inesperada após primeiro voto: s0=%d, s1=%d, s2=%d",
			d1.Slots[0].VotesCount, d1.Slots[1].VotesCount, d1.Slots[2].VotesCount)
	}

	// 2. Carlos muda de ideia (ou clicou errado) e altera para Slot 1 e Slot 2
	res2, err := tc.meetingSvc.SubmitVote(ctx, service.SubmitVoteRequest{
		MeetingID:       m.ID,
		ParticipantID:   res1.ParticipantID,
		ParticipantName: "Carlos Pereira",
		ContactInfo:     "carlos@empresa.com",
		SlotIDs:         []string{slot1, slot2},
	})
	if err != nil {
		t.Fatalf("alteração de voto de Carlos falhou: %v", err)
	}
	if !res2.IsVoteUpdate {
		t.Errorf("esperava IsVoteUpdate = true ao alterar voto")
	}
	if res2.ParticipantID != res1.ParticipantID {
		t.Errorf("ParticipantID deveria ser o mesmo: anterior=%s atual=%s", res1.ParticipantID, res2.ParticipantID)
	}

	// 3. Verifica estado final: NENHUM participante duplicado, slot 0 estornado (0 votos) e slots 1 e 2 com 1 voto
	d2, err := tc.meetingSvc.GetMeetingDetails(ctx, m.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(d2.Participants) != 1 {
		t.Fatalf("NÃO pode duplicar participante na alteração! Esperava 1, vieram %d", len(d2.Participants))
	}
	if d2.Slots[0].VotesCount != 0 {
		t.Errorf("slot 0 deveria ter sido estornado para 0 votos, está com %d", d2.Slots[0].VotesCount)
	}
	if d2.Slots[1].VotesCount != 1 || d2.Slots[2].VotesCount != 1 {
		t.Errorf("slots 1 e 2 deveriam ter 1 voto cada, estão com s1=%d, s2=%d", d2.Slots[1].VotesCount, d2.Slots[2].VotesCount)
	}

	// 4. Cadastra uma conta secundária no Vito com o mesmo e-mail do participante (carlos@empresa.com)
	userRepo := repository.NewUserRepository(tc.db)
	secondaryUser := &domain.User{
		ID:           "user-secondary-carlos",
		Name:         "Carlos Mendes",
		Email:        "carlos@empresa.com",
		PasswordHash: "hash123",
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := userRepo.Create(secondaryUser); err != nil {
		t.Fatalf("erro ao criar usuário secundário: %v", err)
	}

	// 5. Configura EmailService com MockSender e fecha a reunião no Slot 1
	mockSender := &mockMeetingEmailSender{}
	emailSvc := service.NewEmailService("smtp.gmail.com", 587, "vito@gmail.com", "pass123", "Vito <vito@gmail.com>", mockSender)
	tc.meetingSvc.SetEmailService(emailSvc)

	err = tc.meetingSvc.ConfirmConsensusSlot(ctx, tc.user.ID, m.ID, slot1)
	if err != nil {
		t.Fatalf("ConfirmConsensusSlot falhou: %v", err)
	}

	// Verifica se o evento também foi espelhado automaticamente na agenda da conta secundária do Vito
	secEvents, err := tc.eventRepo.ListByUser(secondaryUser.ID, now, now.Add(7*24*time.Hour))
	if err != nil {
		t.Fatalf("erro ao listar eventos da conta secundária: %v", err)
	}
	if len(secEvents) != 1 {
		t.Fatalf("esperava 1 evento espelhado na agenda da conta secundária Vito, obteve %d", len(secEvents))
	}

	// Dá um pequeno tempo para a goroutine de e-mail executar
	time.Sleep(50 * time.Millisecond)

	sentTo, sentMsg := mockSender.getSent()
	if len(sentTo) != 1 || sentTo[0] != "carlos@empresa.com" {
		t.Errorf("esperava e-mail disparado para carlos@empresa.com, obteve %v", sentTo)
	}
	if !strings.Contains(string(sentMsg), "text/calendar") {
		t.Errorf("e-mail deveria conter anexo de calendário .ics")
	}
}

type mockMeetingEmailSender struct {
	mu       sync.Mutex
	sentAddr string
	sentFrom string
	sentTo   []string
	sentMsg  []byte
}

func (m *mockMeetingEmailSender) SendMail(addr string, a smtp.Auth, from string, to []string, msg []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sentAddr = addr
	m.sentFrom = from
	m.sentTo = to
	m.sentMsg = msg
	return nil
}

func (m *mockMeetingEmailSender) getSent() ([]string, []byte) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.sentTo, m.sentMsg
}
