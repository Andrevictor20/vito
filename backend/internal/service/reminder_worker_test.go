package service_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

type mockReminderEventRepo struct {
	events []domain.Event
}

func (m *mockReminderEventRepo) Create(e *domain.Event) error {
	m.events = append(m.events, *e)
	return nil
}
func (m *mockReminderEventRepo) GetByID(id, userID string) (*domain.Event, error) {
	for _, e := range m.events {
		if e.ID == id && e.UserID == userID {
			return &e, nil
		}
	}
	return nil, domain.ErrEventNotFound
}
func (m *mockReminderEventRepo) ListByUser(userID string, from, to time.Time) ([]domain.Event, error) {
	return m.events, nil
}
func (m *mockReminderEventRepo) ListUpcomingUnreminded(from, to time.Time) ([]domain.Event, error) {
	var res []domain.Event
	for _, e := range m.events {
		if e.StartAt.After(from.Add(-time.Second)) && e.StartAt.Before(to.Add(time.Second)) && e.ReminderSentAt == nil {
			res = append(res, e)
		}
	}
	return res, nil
}
func (m *mockReminderEventRepo) MarkReminderSent(eventID string, sentAt time.Time) error {
	for i, e := range m.events {
		if e.ID == eventID {
			t := sentAt
			m.events[i].ReminderSentAt = &t
			return nil
		}
	}
	return domain.ErrEventNotFound
}
func (m *mockReminderEventRepo) CheckConflict(userID string, startAt, endAt time.Time, excludeEventID string) (*domain.ConflictInfo, error) {
	return &domain.ConflictInfo{HasConflict: false}, nil
}
func (m *mockReminderEventRepo) Delete(id, userID string) error { return nil }
func (m *mockReminderEventRepo) DeleteByTitle(userID, titleQuery string) (int, error) { return 0, nil }
func (m *mockReminderEventRepo) DeleteSeries(id, userID string) (int, error) { return 0, nil }
func (m *mockReminderEventRepo) Update(event *domain.Event) error { return nil }
func (m *mockReminderEventRepo) UpdateSeries(event *domain.Event) (int, error) { return 0, nil }
func (m *mockReminderEventRepo) UpdateTimesByTitle(userID, titleQuery string, newStart, newEnd time.Time) (int, error) { return 0, nil }

func TestReminderWorker_CheckAndDispatchReminders(t *testing.T) {
	// 1. Mock do servidor Expo
	var receivedPush []service.PushMessage
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var msgs []service.PushMessage
		_ = json.NewDecoder(r.Body).Decode(&msgs)
		receivedPush = append(receivedPush, msgs...)
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"data":[{"status":"ok"}]}`))
	}))
	defer server.Close()

	// 2. Mock repositórios
	tokenRepo := &mockDeviceTokenRepo{
		tokens: []domain.DeviceToken{
			{ID: "tok-1", UserID: "user-1", Token: "ExponentPushToken[user1]", Platform: "android"},
		},
	}
	notifSvc := service.NewNotificationService(tokenRepo, server.Client())
	notifSvc.SetExpoAPIURL(server.URL)

	now := time.Date(2026, 10, 8, 14, 0, 0, 0, time.UTC)
	eventIn10Min := domain.Event{
		ID:        "evt-10m",
		UserID:    "user-1",
		Title:     "Reunião de Diretoria",
		Location:  "Sala 3",
		StartAt:   now.Add(10 * time.Minute), // 14:10
		EndAt:     now.Add(40 * time.Minute),
		CreatedAt: now,
		UpdatedAt: now,
	}

	eventRepo := &mockReminderEventRepo{
		events: []domain.Event{eventIn10Min},
	}

	worker := service.NewReminderWorker(eventRepo, notifSvc, 15*time.Minute)

	// 3. Executa a checagem no tempo 'now'
	count, err := worker.CheckAndDispatchReminders(now)
	if err != nil {
		t.Fatalf("esperado nil error, obteve %v", err)
	}

	if count != 1 {
		t.Errorf("esperado 1 lembrete despachado, obteve %d", count)
	}

	if len(receivedPush) != 1 {
		t.Fatalf("esperado 1 push recebido no servidor Expo, obteve %d", len(receivedPush))
	}

	if receivedPush[0].To != "ExponentPushToken[user1]" {
		t.Errorf("esperado push para ExponentPushToken[user1], obteve %s", receivedPush[0].To)
	}

	// 4. Segunda execução no mesmo instante: deve ser deduplicada (0 lembretes)
	count2, err := worker.CheckAndDispatchReminders(now)
	if err != nil {
		t.Fatalf("esperado nil error no ciclo 2, obteve %v", err)
	}

	if count2 != 0 {
		t.Errorf("esperado 0 lembretes por deduplicação, obteve %d", count2)
	}
}
