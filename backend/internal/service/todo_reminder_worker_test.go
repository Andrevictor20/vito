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

type mockReminderTodoRepo struct {
	todos []domain.Todo
}

func (m *mockReminderTodoRepo) Create(t *domain.Todo) error {
	m.todos = append(m.todos, *t)
	return nil
}
func (m *mockReminderTodoRepo) GetByID(id, userID string) (*domain.Todo, error) {
	for _, t := range m.todos {
		if t.ID == id && t.UserID == userID {
			return &t, nil
		}
	}
	return nil, domain.ErrTodoNotFound
}
func (m *mockReminderTodoRepo) ListByUser(userID string, status domain.TodoStatus) ([]domain.Todo, error) {
	return m.todos, nil
}
func (m *mockReminderTodoRepo) ListUpcomingUnreminded(from, to time.Time) ([]domain.Todo, error) {
	var res []domain.Todo
	for _, t := range m.todos {
		if t.DueDate != nil && t.Status == domain.TodoStatusPending &&
			t.DueDate.After(from.Add(-time.Second)) && t.DueDate.Before(to.Add(time.Second)) &&
			t.ReminderSentAt == nil {
			res = append(res, t)
		}
	}
	return res, nil
}
func (m *mockReminderTodoRepo) ListDueNowUnreminded(from, to time.Time) ([]domain.Todo, error) {
	var res []domain.Todo
	for _, t := range m.todos {
		if t.DueDate != nil && t.Status == domain.TodoStatusPending &&
			t.DueDate.After(from.Add(-time.Second)) && t.DueDate.Before(to.Add(time.Second)) &&
			t.StartReminderSentAt == nil {
			res = append(res, t)
		}
	}
	return res, nil
}
func (m *mockReminderTodoRepo) MarkReminderSent(todoID string, sentAt time.Time) error {
	for i, t := range m.todos {
		if t.ID == todoID {
			m.todos[i].ReminderSentAt = &sentAt
			return nil
		}
	}
	return domain.ErrTodoNotFound
}
func (m *mockReminderTodoRepo) MarkDueReminderSent(todoID string, sentAt time.Time) error {
	for i, t := range m.todos {
		if t.ID == todoID {
			m.todos[i].StartReminderSentAt = &sentAt
			return nil
		}
	}
	return domain.ErrTodoNotFound
}
func (m *mockReminderTodoRepo) UpdateStatus(id, userID string, status domain.TodoStatus) error {
	for i, t := range m.todos {
		if t.ID == id && t.UserID == userID {
			m.todos[i].Status = status
			return nil
		}
	}
	return domain.ErrTodoNotFound
}
func (m *mockReminderTodoRepo) Delete(id, userID string) error {
	return nil
}
func (m *mockReminderTodoRepo) AddSubtask(st *domain.Subtask) error {
	return nil
}
func (m *mockReminderTodoRepo) ToggleSubtask(id, todoID string) (*domain.Subtask, error) {
	return nil, nil
}
func (m *mockReminderTodoRepo) DeleteSubtask(id, todoID string) error {
	return nil
}
func (m *mockReminderTodoRepo) ListSubtasksByTodo(todoID string) ([]domain.Subtask, error) {
	return nil, nil
}

func TestTodoReminderWorker_CheckAndDispatchReminders(t *testing.T) {
	var receivedMessages []service.PushMessage
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var msgs []service.PushMessage
		if err := json.NewDecoder(r.Body).Decode(&msgs); err == nil {
			receivedMessages = append(receivedMessages, msgs...)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"data":[{"status":"ok"}]}`))
	}))
	defer server.Close()

	tokenRepo := &mockDeviceTokenRepo{
		tokens: []domain.DeviceToken{
			{ID: "dt-1", UserID: "user-1", Token: "ExponentPushToken[user1]", Platform: "android"},
		},
	}

	notifSvc := service.NewNotificationService(tokenRepo, server.Client())
	notifSvc.SetExpoAPIURL(server.URL)

	now := time.Date(2026, 10, 11, 14, 0, 0, 0, time.UTC)
	dueAdv := now.Add(10 * time.Minute)
	dueNow := now.Add(30 * time.Second)

	todoRepo := &mockReminderTodoRepo{
		todos: []domain.Todo{
			{
				ID:       "todo-adv",
				UserID:   "user-1",
				Title:    "Entregar relatório",
				Status:   domain.TodoStatusPending,
				Priority: "high",
				DueDate:  &dueAdv,
			},
			{
				ID:       "todo-due",
				UserID:   "user-1",
				Title:    "Tomar remédio",
				Status:   domain.TodoStatusPending,
				Priority: "medium",
				DueDate:  &dueNow,
			},
		},
	}

	worker := service.NewTodoReminderWorker(todoRepo, notifSvc, 15*time.Minute)

	dispatched, err := worker.CheckAndDispatchReminders(now)
	if err != nil {
		t.Fatalf("CheckAndDispatchReminders falhou: %v", err)
	}

	if dispatched != 2 {
		t.Errorf("esperava 2 lembretes despachados, obteve %d", dispatched)
	}

	if len(receivedMessages) != 2 {
		t.Fatalf("esperava 2 mensagens push no servidor Expo, recebeu %d", len(receivedMessages))
	}

	// Verifica se os canais e flags de notificação foram preenchidos
	if todoRepo.todos[0].ReminderSentAt == nil {
		t.Errorf("esperava ReminderSentAt preenchido para todo-adv")
	}
	if todoRepo.todos[1].StartReminderSentAt == nil {
		t.Errorf("esperava StartReminderSentAt preenchido para todo-due")
	}

	// Segunda rodada: não deve despachar nada novamente (idempotência)
	receivedMessages = nil
	dispatchedSecond, err := worker.CheckAndDispatchReminders(now)
	if err != nil {
		t.Fatalf("segunda execução falhou: %v", err)
	}
	if dispatchedSecond != 0 {
		t.Errorf("esperava 0 lembretes na segunda execução, obteve %d", dispatchedSecond)
	}
}
