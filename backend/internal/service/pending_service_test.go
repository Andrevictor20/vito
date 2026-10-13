package service_test

import (
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

type mockPendingRepo struct {
	items map[string]*domain.PendingItem
}

func newMockPendingRepo() *mockPendingRepo {
	return &mockPendingRepo{items: make(map[string]*domain.PendingItem)}
}

func (m *mockPendingRepo) Create(item *domain.PendingItem) error {
	m.items[item.ID] = item
	return nil
}

func (m *mockPendingRepo) GetByID(id, userID string) (*domain.PendingItem, error) {
	item, ok := m.items[id]
	if !ok || item.UserID != userID {
		return nil, domain.ErrPendingItemNotFound
	}
	return item, nil
}

func (m *mockPendingRepo) ListByUser(userID string, status *domain.PendingStatus, category string) ([]domain.PendingItem, error) {
	var res []domain.PendingItem
	for _, item := range m.items {
		if item.UserID == userID {
			if status != nil && item.Status != *status {
				continue
			}
			if category != "" && item.Category != category {
				continue
			}
			res = append(res, *item)
		}
	}
	return res, nil
}

func (m *mockPendingRepo) Update(item *domain.PendingItem) error {
	if _, ok := m.items[item.ID]; !ok {
		return domain.ErrPendingItemNotFound
	}
	m.items[item.ID] = item
	return nil
}

func (m *mockPendingRepo) Delete(id, userID string) error {
	item, ok := m.items[id]
	if !ok || item.UserID != userID {
		return domain.ErrPendingItemNotFound
	}
	delete(m.items, id)
	return nil
}

func (m *mockPendingRepo) ListUnscheduledDueForNudge(cutoff time.Time) ([]domain.PendingItem, error) {
	var res []domain.PendingItem
	for _, item := range m.items {
		if item.Status == domain.PendingStatusInbox && item.CreatedAt.Before(cutoff) {
			res = append(res, *item)
		}
	}
	return res, nil
}

func (m *mockPendingRepo) MarkNudgeSent(id string, sentAt time.Time) error {
	if item, ok := m.items[id]; ok {
		item.NudgeSentAt = &sentAt
	}
	return nil
}

func (m *mockPendingRepo) ListScheduledDueForNudge(today string, since time.Time) ([]domain.PendingItem, error) {
	dayStart := since.UTC().Truncate(24 * time.Hour)
	var res []domain.PendingItem
	for _, item := range m.items {
		if item.Status != domain.PendingStatusScheduled || item.ScheduledDate == "" || item.ScheduledDate > today {
			continue
		}
		if item.NudgeSentAt != nil && !item.NudgeSentAt.Before(dayStart) {
			continue
		}
		res = append(res, *item)
	}
	return res, nil
}

func TestPendingService_CreateAndLifecycle(t *testing.T) {
	repo := newMockPendingRepo()
	svc := service.NewPendingService(repo)

	// Validação de título vazio
	_, err := svc.CreatePending("user-1", domain.CreatePendingInput{Title: ""})
	if err != service.ErrPendingTitleEmpty {
		t.Fatalf("esperava ErrPendingTitleEmpty, obteve %v", err)
	}

	// Criação válida
	item, err := svc.CreatePending("user-1", domain.CreatePendingInput{
		Title:       "Marcar consulta dermatologista",
		Description: "Clínica Saúde Plena",
		Category:    "saude",
	})
	if err != nil {
		t.Fatalf("falha ao criar pendência: %v", err)
	}
	if item.Status != domain.PendingStatusInbox {
		t.Fatalf("status inicial deve ser inbox, obteve %s", item.Status)
	}

	// Agendar pendência
	scheduled, err := svc.SchedulePending(item.ID, "user-1", "2026-10-20")
	if err != nil {
		t.Fatalf("falha ao agendar: %v", err)
	}
	if scheduled.Status != domain.PendingStatusScheduled || scheduled.ScheduledDate != "2026-10-20" {
		t.Fatalf("pendência não foi agendada corretamente: %+v", scheduled)
	}

	// Concluir pendência
	done, err := svc.CompletePending(item.ID, "user-1")
	if err != nil {
		t.Fatalf("falha ao concluir: %v", err)
	}
	if done.Status != domain.PendingStatusDone {
		t.Fatalf("status deve ser done, obteve %s", done.Status)
	}

	// Deletar
	if err := svc.DeletePending(item.ID, "user-1"); err != nil {
		t.Fatalf("falha ao deletar: %v", err)
	}
	_, err = svc.GetByID(item.ID, "user-1")
	if err != domain.ErrPendingItemNotFound {
		t.Fatalf("item ainda encontrado após deleção")
	}
}
