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
func (m *mockReminderEventRepo) ListStartingNowUnreminded(from, to time.Time) ([]domain.Event, error) {
	var res []domain.Event
	for _, e := range m.events {
		if e.StartAt.After(from.Add(-time.Second)) && e.StartAt.Before(to.Add(time.Second)) && e.StartReminderSentAt == nil {
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
func (m *mockReminderEventRepo) MarkStartReminderSent(eventID string, sentAt time.Time) error {
	for i, e := range m.events {
		if e.ID == eventID {
			t := sentAt
			m.events[i].StartReminderSentAt = &t
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

func TestReminderWorker_DualNotification_AdvanceAndStart(t *testing.T) {
	var receivedPush []service.PushMessage
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var msgs []service.PushMessage
		_ = json.NewDecoder(r.Body).Decode(&msgs)
		receivedPush = append(receivedPush, msgs...)
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"data":[{"status":"ok"}]}`))
	}))
	defer server.Close()

	tokenRepo := &mockDeviceTokenRepo{
		tokens: []domain.DeviceToken{
			{ID: "tok-1", UserID: "user-1", Token: "ExponentPushToken[user1]", Platform: "android"},
		},
	}
	notifSvc := service.NewNotificationService(tokenRepo, server.Client())
	notifSvc.SetExpoAPIURL(server.URL)

	t0 := time.Date(2026, 10, 8, 14, 0, 0, 0, time.UTC)
	eventStartAt := t0.Add(10 * time.Minute) // 14:10

	event := domain.Event{
		ID:        "evt-dual",
		UserID:    "user-1",
		Title:     "Consulta Médica",
		Location:  "Consultório 4",
		StartAt:   eventStartAt,
		EndAt:     eventStartAt.Add(30 * time.Minute),
		CreatedAt: t0,
		UpdatedAt: t0,
	}

	eventRepo := &mockReminderEventRepo{
		events: []domain.Event{event},
	}

	worker := service.NewReminderWorker(eventRepo, notifSvc, 15*time.Minute)

	// Turno 1 (14:00): Deve disparar aviso prévio de antecedência ("Começa às ...")
	c1, err := worker.CheckAndDispatchReminders(t0)
	if err != nil {
		t.Fatalf("erro inesperado no turno 1: %v", err)
	}
	if c1 != 1 {
		t.Errorf("esperado 1 lembrete de antecedência, obteve %d", c1)
	}
	if len(receivedPush) != 1 {
		t.Fatalf("esperado 1 push recebido, obteve %d", len(receivedPush))
	}
	if receivedPush[0].Data["type"] != "advance" {
		t.Errorf("esperado type advance, obteve %v", receivedPush[0].Data["type"])
	}

	// Turno 2 (14:10): Horário exato de início do evento -> Deve disparar aviso de início ("Começando agora!")
	c2, err := worker.CheckAndDispatchReminders(eventStartAt)
	if err != nil {
		t.Fatalf("erro inesperado no turno 2: %v", err)
	}
	if c2 != 1 {
		t.Errorf("esperado 1 alerta de início, obteve %d", c2)
	}
	if len(receivedPush) != 2 {
		t.Fatalf("esperado 2 pushes totais recebidos, obteve %d", len(receivedPush))
	}
	if receivedPush[1].Data["type"] != "start" {
		t.Errorf("esperado type start, obteve %v", receivedPush[1].Data["type"])
	}
	if receivedPush[1].Body != "Começando agora em Consultório 4!" {
		t.Errorf("corpo inesperado do alerta de início: %q", receivedPush[1].Body)
	}

	// Turno 3 (14:11): Evento já teve ambos os alertas despachados -> 0 notificações
	c3, err := worker.CheckAndDispatchReminders(eventStartAt.Add(time.Minute))
	if err != nil {
		t.Fatalf("erro inesperado no turno 3: %v", err)
	}
	if c3 != 0 {
		t.Errorf("esperado 0 novos alertas (deduplicação total), obteve %d", c3)
	}
}
