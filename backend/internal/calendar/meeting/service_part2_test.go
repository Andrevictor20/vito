package meeting_test

import (
	"context"
	"github.com/andrevmp/vito/backend/internal/calendar/meeting"
	"net/smtp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	_ "modernc.org/sqlite"
)

func TestMeetingService_VoterNamesAndParticipantVotedSlots(t *testing.T) {
	tc := setupMeetingTest(t)
	defer tc.db.Close()
	ctx := context.Background()

	now := time.Now().UTC().Truncate(time.Second)
	m, err := tc.meetingSvc.CreateMeeting(ctx, meeting.CreateMeetingRequest{
		UserID:          tc.user.ID,
		Title:           "Design Review",
		DurationMinutes: 30,
		Mode:            domain.MeetingModeGroupConsensus,
		Slots: []meeting.MeetingSlotInput{
			{StartAt: now.Add(24 * time.Hour), EndAt: now.Add(24*time.Hour + 30*time.Minute)},
			{StartAt: now.Add(26 * time.Hour), EndAt: now.Add(26*time.Hour + 30*time.Minute)},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	slot1 := m.Slots[0].ID
	slot2 := m.Slots[1].ID

	_, err = tc.meetingSvc.SubmitVote(ctx, meeting.SubmitVoteRequest{
		MeetingID:       m.ID,
		ParticipantName: "Ana Silva",
		ContactInfo:     "11999999999",
		SlotIDs:         []string{slot1, slot2},
	})
	if err != nil {
		t.Fatal(err)
	}

	_, err = tc.meetingSvc.SubmitVote(ctx, meeting.SubmitVoteRequest{
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

	m, err := tc.meetingSvc.CreateMeeting(ctx, meeting.CreateMeetingRequest{
		UserID:          tc.user.ID,
		Title:           "Reunião Original",
		Description:     "Pauta 1",
		DurationMinutes: 30,
		Mode:            domain.MeetingModeGroupConsensus,
		Slots: []meeting.MeetingSlotInput{
			{StartAt: t1, EndAt: t1.Add(30 * time.Minute)},
			{StartAt: t2, EndAt: t2.Add(30 * time.Minute)},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	// Alguém vota no primeiro slot (t1)
	_, err = tc.meetingSvc.SubmitVote(ctx, meeting.SubmitVoteRequest{
		MeetingID:       m.ID,
		ParticipantName: "Mariana",
		SlotIDs:         []string{m.Slots[0].ID},
	})
	if err != nil {
		t.Fatal(err)
	}

	// Atualiza mantendo t1, removendo t2 e adicionando t3
	updated, err := tc.meetingSvc.UpdateMeeting(ctx, tc.user.ID, m.ID, meeting.UpdateMeetingRequest{
		Title:           "Reunião Editada",
		Description:     "Nova Pauta",
		DurationMinutes: 45,
		Slots: []meeting.MeetingSlotInput{
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

	m, err := tc.meetingSvc.CreateMeeting(ctx, meeting.CreateMeetingRequest{
		UserID:          tc.user.ID,
		Title:           "Planejamento Trimestral",
		DurationMinutes: 60,
		Mode:            domain.MeetingModeGroupConsensus,
		Slots: []meeting.MeetingSlotInput{
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
	res1, err := tc.meetingSvc.SubmitVote(ctx, meeting.SubmitVoteRequest{
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
	res2, err := tc.meetingSvc.SubmitVote(ctx, meeting.SubmitVoteRequest{
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

	// 5. Configura service.EmailService com MockSender e fecha a reunião no Slot 1
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
