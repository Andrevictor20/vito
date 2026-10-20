package service_test

import (
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

type mockUserRepoForNudge struct {
	user *domain.User
}

func (m *mockUserRepoForNudge) Create(user *domain.User) error                { return nil }
func (m *mockUserRepoForNudge) GetByID(id string) (*domain.User, error)       { return m.user, nil }
func (m *mockUserRepoForNudge) GetByEmail(email string) (*domain.User, error) { return m.user, nil }
func (m *mockUserRepoForNudge) GetByPhone(phone string) (*domain.User, error) { return m.user, nil }
func (m *mockUserRepoForNudge) UpdatePhone(id, phone string) error            { return nil }
func (m *mockUserRepoForNudge) Delete(id string) error                        { return nil }
func (m *mockUserRepoForNudge) IncrementTokenVersion(id string) error         { return nil }
func (m *mockUserRepoForNudge) ListAll() ([]domain.User, error)               { return []domain.User{*m.user}, nil }

type mockTokenRepoForNudge struct {
	token domain.DeviceToken
}

func (m *mockTokenRepoForNudge) Save(token *domain.DeviceToken) error { return nil }
func (m *mockTokenRepoForNudge) FindByUserID(userID string) ([]domain.DeviceToken, error) {
	return []domain.DeviceToken{m.token}, nil
}
func (m *mockTokenRepoForNudge) Delete(userID, token string) error { return nil }

func TestPendingNudgeWorker_FormatNudgeMessage(t *testing.T) {
	singleItem := []domain.PendingItem{
		{Title: "Renovar CNH"},
	}
	title, body := service.FormatNudgeMessage("André Victor", singleItem, 0)
	if title != "📥 Pendências" {
		t.Fatalf("título inesperado: %s", title)
	}
	if body != "André, você tem 1 pendência aguardando agendamento: 'Renovar CNH'. Que tal reservar um horário?" {
		t.Fatalf("corpo inesperado para 1 item: %s", body)
	}

	multipleItems := []domain.PendingItem{
		{Title: "Item 1"},
		{Title: "Item 2"},
		{Title: "Item 3"},
	}
	_, bodyMulti := service.FormatNudgeMessage("Carlos", multipleItems, 0)
	if bodyMulti != "Carlos, você tem 3 pendências paradas há mais de 24h. Que tal agendar no seu dia?" {
		t.Fatalf("corpo inesperado para múltiplos itens: %s", bodyMulti)
	}
}

func TestPendingNudgeWorker_ProcessNudges(t *testing.T) {
	pendingRepo := newMockPendingRepo()
	userRepo := &mockUserRepoForNudge{
		user: &domain.User{ID: "user-1", Name: "André", Email: "andre@test.com"},
	}

	// Token repo mock para notificação
	tokenRepo := &mockTokenRepoForNudge{
		token: domain.DeviceToken{
			ID:        "tok-1",
			UserID:    "user-1",
			Token:     "ExponentPushToken[mock_nudge_token]",
			Platform:  "expo",
			CreatedAt: time.Now().UTC(),
			UpdatedAt: time.Now().UTC(),
		},
	}
	notifSvc := service.NewNotificationService(tokenRepo)

	worker := service.NewPendingNudgeWorker(pendingRepo, userRepo, notifSvc)
	loc := time.UTC
	worker.SetLocation(loc)
	worker.SetTargetTime("17:30")

	// 1. Horário divergente (10:00) -> 0 disparos
	tickEarly := time.Date(2026, 10, 11, 10, 0, 0, 0, loc)
	dispatched, err := worker.ProcessNudges(tickEarly)
	if err != nil || dispatched != 0 {
		t.Fatalf("não deveria disparar fora do horário alvo, obteve %d, err: %v", dispatched, err)
	}

	// 2. Insere item antigo elegível
	now := time.Date(2026, 10, 11, 17, 30, 0, 0, loc)
	_ = pendingRepo.Create(&domain.PendingItem{
		ID:        "item-old",
		UserID:    "user-1",
		Title:     "Pagar IPVA",
		Category:  "financas",
		Status:    domain.PendingStatusInbox,
		CreatedAt: now.Add(-30 * time.Hour),
		UpdatedAt: now.Add(-30 * time.Hour),
	})

	// 3. Executa no horário alvo (17:30)
	dispatched, err = worker.ProcessNudges(now)
	if err != nil {
		t.Fatalf("erro ao processar nudges: %v", err)
	}
	if dispatched != 1 {
		t.Fatalf("esperava 1 usuário notificado, obteve %d", dispatched)
	}

	// Item deve ter sido marcado com nudge_sent_at
	updatedItem, _ := pendingRepo.GetByID("item-old", "user-1")
	if updatedItem.NudgeSentAt == nil {
		t.Fatalf("nudge_sent_at deveria estar preenchido")
	}
}
