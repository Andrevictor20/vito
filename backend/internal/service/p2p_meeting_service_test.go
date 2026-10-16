package service_test

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	_ "modernc.org/sqlite"
)

type p2pTestContext struct {
	userRepo  domain.UserRepository
	eventRepo domain.EventRepository
	p2pRepo   domain.P2PInviteRepository
	svc       *service.P2PMeetingService
}

func setupP2PServiceTest(t *testing.T) *p2pTestContext {
	t.Helper()
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("falha ao abrir banco sqlite em memória: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	eventRepo := repository.NewEventRepository(db)
	p2pRepo := repository.NewP2PInviteRepositorySQLite(db)
	calService := service.NewCalendarService(eventRepo)

	p2pService := service.NewP2PMeetingService(p2pRepo, userRepo, calService, nil)
	return &p2pTestContext{
		userRepo:  userRepo,
		eventRepo: eventRepo,
		p2pRepo:   p2pRepo,
		svc:       p2pService,
	}
}

func TestP2PMeetingService_ContactMatching(t *testing.T) {
	ctx := context.Background()
	tc := setupP2PServiceTest(t)

	phone1 := "+5511999990001"
	u1 := &domain.User{
		ID:        uuid.New().String(),
		Email:     "user1@vito.app",
		Name:      "User One",
		Phone:     &phone1,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := tc.userRepo.Create(u1); err != nil {
		t.Fatalf("falha ao criar u1: %v", err)
	}

	phone2 := "+5511999990002"
	u2 := &domain.User{
		ID:        uuid.New().String(),
		Email:     "user2@vito.app",
		Name:      "User Two",
		Phone:     &phone2,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := tc.userRepo.Create(u2); err != nil {
		t.Fatalf("falha ao criar u2: %v", err)
	}

	salt, err := tc.svc.GetContactMatchingSalt()
	if err != nil {
		t.Fatalf("falha ao obter salt: %v", err)
	}
	if salt == "" {
		t.Fatal("salt não deveria ser vazio")
	}

	calcHash := func(val, s string) string {
		h := hmac.New(sha256.New, []byte(s))
		h.Write([]byte(val))
		return hex.EncodeToString(h.Sum(nil))
	}

	hashPhone1 := calcHash(phone1, salt)
	hashPhone2 := calcHash(phone2, salt)
	hashNonExistent := calcHash("+5511988887777", salt)

	matches, err := tc.svc.MatchContactsByHashes(ctx, salt, []string{hashPhone1, hashPhone2, hashNonExistent})
	if err != nil {
		t.Fatalf("falha no matching: %v", err)
	}
	if len(matches) != 2 {
		t.Fatalf("esperava 2 matches, obteve %d", len(matches))
	}

	found1 := false
	found2 := false
	for _, m := range matches {
		if m.UserID == u1.ID {
			found1 = true
		}
		if m.UserID == u2.ID {
			found2 = true
		}
	}
	if !found1 || !found2 {
		t.Errorf("matches não contêm os IDs esperados: %+v", matches)
	}
}

func TestP2PMeetingService_FindMutualSlots(t *testing.T) {
	ctx := context.Background()
	tc := setupP2PServiceTest(t)

	u1 := &domain.User{
		ID:        uuid.New().String(),
		Email:     "alice@vito.app",
		Name:      "Alice",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := tc.userRepo.Create(u1); err != nil {
		t.Fatalf("falha ao criar u1: %v", err)
	}

	u2 := &domain.User{
		ID:        uuid.New().String(),
		Email:     "bob@vito.app",
		Name:      "Bob",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := tc.userRepo.Create(u2); err != nil {
		t.Fatalf("falha ao criar u2: %v", err)
	}

	baseDay := time.Now().UTC().Truncate(24*time.Hour).Add(24 * time.Hour)
	dayStart := baseDay.Add(9 * time.Hour)
	dayEnd := baseDay.Add(18 * time.Hour)

	if err := tc.eventRepo.Create(&domain.Event{
		ID:        uuid.New().String(),
		UserID:    u1.ID,
		Title:     "Alice Meeting",
		StartAt:   baseDay.Add(10 * time.Hour),
		EndAt:     baseDay.Add(11 * time.Hour),
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}); err != nil {
		t.Fatalf("falha ao criar evento para Alice: %v", err)
	}

	if err := tc.eventRepo.Create(&domain.Event{
		ID:        uuid.New().String(),
		UserID:    u2.ID,
		Title:     "Bob Sync",
		StartAt:   baseDay.Add(14 * time.Hour),
		EndAt:     baseDay.Add(15 * time.Hour),
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}); err != nil {
		t.Fatalf("falha ao criar evento para Bob: %v", err)
	}

	slots, err := tc.svc.FindMutualSlots(ctx, u1.ID, u2.ID, dayStart, dayEnd, 30)
	if err != nil {
		t.Fatalf("falha ao buscar slots mútuos: %v", err)
	}
	if len(slots) == 0 {
		t.Fatal("esperava encontrar slots mútuos disponíveis")
	}

	for _, s := range slots {
		if s.StartAt.Before(baseDay.Add(11*time.Hour)) && s.EndAt.After(baseDay.Add(10*time.Hour)) {
			t.Fatalf("Slot conflita com Alice: %v -> %v", s.StartAt, s.EndAt)
		}
		if s.StartAt.Before(baseDay.Add(15*time.Hour)) && s.EndAt.After(baseDay.Add(14*time.Hour)) {
			t.Fatalf("Slot conflita com Bob: %v -> %v", s.StartAt, s.EndAt)
		}
	}
}

func TestP2PMeetingService_InviteLifecycle(t *testing.T) {
	ctx := context.Background()
	tc := setupP2PServiceTest(t)

	u1 := &domain.User{
		ID:        uuid.New().String(),
		Email:     "host@vito.app",
		Name:      "Host User",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := tc.userRepo.Create(u1); err != nil {
		t.Fatalf("falha ao criar host: %v", err)
	}

	u2 := &domain.User{
		ID:        uuid.New().String(),
		Email:     "guest@vito.app",
		Name:      "Guest User",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := tc.userRepo.Create(u2); err != nil {
		t.Fatalf("falha ao criar guest: %v", err)
	}

	slotStart := time.Now().UTC().Add(48 * time.Hour).Truncate(time.Hour)
	slotEnd := slotStart.Add(45 * time.Minute)

	_, err := tc.svc.SendInvite(ctx, u1.ID, u1.ID, "Self Invite", "", slotStart, slotEnd)
	if err != domain.ErrP2PSelfInvite {
		t.Fatalf("esperava ErrP2PSelfInvite, obteve: %v", err)
	}

	invite, err := tc.svc.SendInvite(ctx, u1.ID, u2.ID, "Sync de Produto", "Alinhar roadmap", slotStart, slotEnd)
	if err != nil {
		t.Fatalf("falha ao enviar convite: %v", err)
	}
	if invite.Status != domain.P2PInviteStatusPending {
		t.Fatalf("status do convite deveria ser pending, obteve: %s", invite.Status)
	}
	if invite.FromUserID != u1.ID || invite.ToUserID != u2.ID {
		t.Fatalf("IDs incorretos: %s -> %s", invite.FromUserID, invite.ToUserID)
	}

	pending, err := tc.svc.ListPendingInvites(ctx, u2.ID)
	if err != nil {
		t.Fatalf("falha ao listar pendentes: %v", err)
	}
	if len(pending) != 1 {
		t.Fatalf("esperava 1 pendente, obteve %d", len(pending))
	}
	if pending[0].ID != invite.ID {
		t.Fatalf("ID do convite pendente incorreto: %s", pending[0].ID)
	}

	err = tc.svc.AcceptInvite(ctx, invite.ID, u1.ID)
	if err != domain.ErrP2PInviteUnauthorized {
		t.Fatalf("esperava ErrP2PInviteUnauthorized, obteve: %v", err)
	}

	acceptedInvite, err := tc.svc.AcceptInviteWithResult(ctx, invite.ID, u2.ID)
	if err != nil {
		t.Fatalf("falha ao aceitar convite: %v", err)
	}
	if acceptedInvite.Status != domain.P2PInviteStatusAccepted {
		t.Fatalf("status deveria ser accepted, obteve: %s", acceptedInvite.Status)
	}
	if acceptedInvite.EventIDFrom == nil || acceptedInvite.EventIDTo == nil {
		t.Fatal("event IDs não devem ser nulos")
	}

	evtHost, err := tc.eventRepo.GetByID(*acceptedInvite.EventIDFrom, u1.ID)
	if err != nil {
		t.Fatalf("evento host: %v", err)
	}
	if evtHost.UserID != u1.ID || evtHost.Title != "Sync de Produto" {
		t.Errorf("evento host inválido: %+v", evtHost)
	}

	evtGuest, err := tc.eventRepo.GetByID(*acceptedInvite.EventIDTo, u2.ID)
	if err != nil {
		t.Fatalf("evento guest: %v", err)
	}
	if evtGuest.UserID != u2.ID || evtGuest.Title != "Sync de Produto" {
		t.Errorf("evento guest inválido: %+v", evtGuest)
	}

	err = tc.svc.AcceptInvite(ctx, invite.ID, u2.ID)
	if err != domain.ErrP2PInviteNotPending {
		t.Fatalf("esperava ErrP2PInviteNotPending, obteve: %v", err)
	}
}

func TestP2PMeetingService_DeclineInvite(t *testing.T) {
	ctx := context.Background()
	tc := setupP2PServiceTest(t)

	u1 := &domain.User{ID: uuid.New().String(), Email: "h@vito.app", Name: "Host", CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()}
	u2 := &domain.User{ID: uuid.New().String(), Email: "g@vito.app", Name: "Guest", CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()}
	if err := tc.userRepo.Create(u1); err != nil {
		t.Fatal(err)
	}
	if err := tc.userRepo.Create(u2); err != nil {
		t.Fatal(err)
	}

	slotStart := time.Now().UTC().Add(24 * time.Hour)
	slotEnd := slotStart.Add(30 * time.Minute)

	invite, err := tc.svc.SendInvite(ctx, u1.ID, u2.ID, "Quick Catchup", "", slotStart, slotEnd)
	if err != nil {
		t.Fatal(err)
	}

	err = tc.svc.DeclineInvite(ctx, invite.ID, u1.ID)
	if err != domain.ErrP2PInviteUnauthorized {
		t.Fatalf("esperava ErrP2PInviteUnauthorized, obteve %v", err)
	}

	err = tc.svc.DeclineInvite(ctx, invite.ID, u2.ID)
	if err != nil {
		t.Fatalf("falha ao recusar convite: %v", err)
	}

	invites, err := tc.svc.ListUserInvites(ctx, u2.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(invites) != 1 {
		t.Fatalf("esperava 1 convite, obteve %d", len(invites))
	}
	if invites[0].Status != domain.P2PInviteStatusDeclined {
		t.Fatalf("status esperado declined, obteve: %s", invites[0].Status)
	}
}

func TestP2PMeetingService_PhoneWhatsAppVerification(t *testing.T) {
	ctx := context.Background()
	tc := setupP2PServiceTest(t)

	u1 := &domain.User{
		ID:        uuid.New().String(),
		Email:     "verify1@vito.app",
		Name:      "Andre",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	u2 := &domain.User{
		ID:        uuid.New().String(),
		Email:     "verify2@vito.app",
		Name:      "Outro",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := tc.userRepo.Create(u1); err != nil {
		t.Fatal(err)
	}
	if err := tc.userRepo.Create(u2); err != nil {
		t.Fatal(err)
	}

	// 1. Solicita verificação com telefone nacional sem +55 -> deve normalizar para +5511987654321
	challenge, err := tc.svc.RequestPhoneVerification(ctx, u1.ID, "(11) 98765-4321", "https://vito.rasppi.cloud")
	if err != nil {
		t.Fatalf("RequestPhoneVerification falhou: %v", err)
	}
	if challenge.Phone != "+5511987654321" {
		t.Fatalf("esperava E.164 +5511987654321, obteve %s", challenge.Phone)
	}
	if len(challenge.Code) != 6 {
		t.Fatalf("esperava código de 6 dígitos, obteve %q", challenge.Code)
	}
	if challenge.Token == "" || challenge.WhatsAppURL == "" || challenge.VerifyURL == "" {
		t.Fatalf("challenge incompleto: %+v", challenge)
	}

	// Antes de confirmar, o telefone do usuário no banco ainda deve ser nil
	u1Before, err := tc.userRepo.GetByID(u1.ID)
	if err != nil {
		t.Fatal(err)
	}
	if u1Before.Phone != nil {
		t.Fatalf("telefone não deveria estar salvo antes da confirmação, obteve %v", *u1Before.Phone)
	}

	// 2. Confirma via Token (simulando clique no link mágico dentro do WhatsApp)
	confirmed, err := tc.svc.ConfirmPhoneVerificationByToken(ctx, challenge.Token)
	if err != nil {
		t.Fatalf("ConfirmPhoneVerificationByToken falhou: %v", err)
	}
	if !confirmed.Verified || confirmed.Phone != "+5511987654321" {
		t.Fatalf("challenge deveria estar verificado: %+v", confirmed)
	}

	u1After, err := tc.userRepo.GetByID(u1.ID)
	if err != nil {
		t.Fatal(err)
	}
	if u1After.Phone == nil || *u1After.Phone != "+5511987654321" {
		t.Fatalf("telefone deveria estar salvo no banco após confirmação, obteve %v", u1After.Phone)
	}

	// 3. Outro usuário tentando verificar o mesmo número deve receber ErrUserAlreadyExists
	_, err = tc.svc.RequestPhoneVerification(ctx, u2.ID, "11987654321", "https://vito.rasppi.cloud")
	if err != domain.ErrUserAlreadyExists {
		t.Fatalf("esperava ErrUserAlreadyExists ao tentar usar telefone de outro usuário, obteve %v", err)
	}

	// 4. Fluxo de confirmação via código de 6 dígitos para u2 com outro número
	ch2, err := tc.svc.RequestPhoneVerification(ctx, u2.ID, "+5521998887766", "https://vito.rasppi.cloud")
	if err != nil {
		t.Fatalf("RequestPhoneVerification u2 falhou: %v", err)
	}
	_, err = tc.svc.ConfirmPhoneVerificationByCode(ctx, u2.ID, "000000")
	if err != domain.ErrPhoneVerificationInvalid {
		t.Fatalf("esperava ErrPhoneVerificationInvalid para código incorreto, obteve %v", err)
	}
	confirmedCh2, err := tc.svc.ConfirmPhoneVerificationByCode(ctx, u2.ID, ch2.Code)
	if err != nil {
		t.Fatalf("ConfirmPhoneVerificationByCode falhou: %v", err)
	}
	if !confirmedCh2.Verified || confirmedCh2.Phone != "+5521998887766" {
		t.Fatalf("esperava confirmação de +5521998887766, obteve %+v", confirmedCh2)
	}
}
