package service_test

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

// Mock repositories para isolamento rigoroso dos testes unitários do worker
type mockBriefingRepo struct {
	mu       sync.Mutex
	settings map[string]*domain.BriefingSettings
}

func newMockBriefingRepo() *mockBriefingRepo {
	return &mockBriefingRepo{settings: make(map[string]*domain.BriefingSettings)}
}

func (m *mockBriefingRepo) GetSettings(userID string) (*domain.BriefingSettings, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if s, ok := m.settings[userID]; ok {
		return s, nil
	}
	return domain.DefaultBriefingSettings(userID), nil
}

func (m *mockBriefingRepo) UpsertSettings(s *domain.BriefingSettings) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.settings[s.UserID] = s
	return nil
}

func (m *mockBriefingRepo) ListActiveSettings() ([]domain.BriefingSettings, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var list []domain.BriefingSettings
	for _, s := range m.settings {
		if s.Enabled {
			list = append(list, *s)
		}
	}
	return list, nil
}

func (m *mockBriefingRepo) MarkSent(userID, dateStr string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if s, ok := m.settings[userID]; ok {
		s.LastSentDate = dateStr
	} else {
		def := domain.DefaultBriefingSettings(userID)
		def.LastSentDate = dateStr
		m.settings[userID] = def
	}
	return nil
}

type mockEventRepoForBriefing struct {
	events []domain.Event
}

func (m *mockEventRepoForBriefing) Create(event *domain.Event) error                         { return nil }
func (m *mockEventRepoForBriefing) GetByID(id, userID string) (*domain.Event, error)         { return nil, nil }
func (m *mockEventRepoForBriefing) ListByUser(userID string, from, to time.Time) ([]domain.Event, error) {
	return m.events, nil
}
func (m *mockEventRepoForBriefing) ListUpcomingUnreminded(from, to time.Time) ([]domain.Event, error) {
	return nil, nil
}
func (m *mockEventRepoForBriefing) ListStartingNowUnreminded(from, to time.Time) ([]domain.Event, error) {
	return nil, nil
}
func (m *mockEventRepoForBriefing) MarkReminderSent(eventID string, sentAt time.Time) error      { return nil }
func (m *mockEventRepoForBriefing) MarkStartReminderSent(eventID string, sentAt time.Time) error { return nil }
func (m *mockEventRepoForBriefing) CheckConflict(userID string, startAt, endAt time.Time, excludeEventID string) (*domain.ConflictInfo, error) {
	return &domain.ConflictInfo{}, nil
}
func (m *mockEventRepoForBriefing) Delete(id, userID string) error               { return nil }
func (m *mockEventRepoForBriefing) DeleteByTitle(userID, titleQuery string) (int, error) {
	return 0, nil
}
func (m *mockEventRepoForBriefing) DeleteSeries(id, userID string) (int, error) { return 0, nil }
func (m *mockEventRepoForBriefing) Update(event *domain.Event) error             { return nil }
func (m *mockEventRepoForBriefing) UpdateSeries(event *domain.Event) (int, error) { return 0, nil }
func (m *mockEventRepoForBriefing) UpdateTimesByTitle(userID, titleQuery string, newStart, newEnd time.Time) (int, error) {
	return 0, nil
}

type mockTodoRepoForBriefing struct {
	todos []domain.Todo
}

func (m *mockTodoRepoForBriefing) Create(todo *domain.Todo) error                                  { return nil }
func (m *mockTodoRepoForBriefing) GetByID(id, userID string) (*domain.Todo, error)                  { return nil, nil }
func (m *mockTodoRepoForBriefing) ListByUser(userID string, status domain.TodoStatus) ([]domain.Todo, error) {
	return m.todos, nil
}
func (m *mockTodoRepoForBriefing) UpdateStatus(id, userID string, status domain.TodoStatus) error   { return nil }
func (m *mockTodoRepoForBriefing) Delete(id, userID string) error                                  { return nil }
func (m *mockTodoRepoForBriefing) AddSubtask(subtask *domain.Subtask) error                        { return nil }
func (m *mockTodoRepoForBriefing) ToggleSubtask(id, todoID string) (*domain.Subtask, error)        { return nil, nil }
func (m *mockTodoRepoForBriefing) DeleteSubtask(id, todoID string) error                           { return nil }
func (m *mockTodoRepoForBriefing) ListSubtasksByTodo(todoID string) ([]domain.Subtask, error)     { return nil, nil }

type mockUserRepoForBriefing struct {
	user *domain.User
}

func (m *mockUserRepoForBriefing) Create(user *domain.User) error             { return nil }
func (m *mockUserRepoForBriefing) GetByID(id string) (*domain.User, error)     { return m.user, nil }
func (m *mockUserRepoForBriefing) GetByEmail(email string) (*domain.User, error) { return m.user, nil }
func (m *mockUserRepoForBriefing) IncrementTokenVersion(id string) error         { return nil }

type mockTokenRepoForBriefing struct {
	token domain.DeviceToken
}

func (m *mockTokenRepoForBriefing) Save(token *domain.DeviceToken) error { return nil }
func (m *mockTokenRepoForBriefing) FindByUserID(userID string) ([]domain.DeviceToken, error) {
	return []domain.DeviceToken{m.token}, nil
}
func (m *mockTokenRepoForBriefing) Delete(userID, token string) error { return nil }

func TestMorningBriefingWorker_FormatMessage(t *testing.T) {
	startAt := time.Date(2026, 10, 11, 9, 30, 0, 0, time.UTC)
	events := []domain.Event{
		{Title: "Reunião de Alinhamento", StartAt: startAt},
		{Title: "Almoço com Cliente", StartAt: startAt.Add(3 * time.Hour)},
	}
	todos := []domain.Todo{
		{Title: "Finalizar proposta"},
	}

	title, body := service.FormatBriefingMessage("André", events, todos, time.UTC)
	if title != "☀️ Bom dia, André!" {
		t.Errorf("título inesperado: %s", title)
	}
	if body == "" {
		t.Fatal("corpo da mensagem vazio")
	}
	if expected := "2 compromissos"; !containsString(body, expected) {
		t.Errorf("esperava '%s' no corpo: %s", expected, body)
	}
	if expected := "Reunião de Alinhamento"; !containsString(body, expected) {
		t.Errorf("esperava primeiro evento '%s': %s", expected, body)
	}
	if expected := "1 tarefa pendente"; !containsString(body, expected) {
		t.Errorf("esperava '%s': %s", expected, body)
	}
}

func TestMorningBriefingWorker_FormatMessageEmptyDay(t *testing.T) {
	title, body := service.FormatBriefingMessage("André", nil, nil, time.UTC)
	if title != "☀️ Bom dia, André!" {
		t.Errorf("título inesperado: %s", title)
	}
	if expected := "Sua agenda está livre hoje"; !containsString(body, expected) {
		t.Errorf("esperava menção de agenda livre, obteve: %s", body)
	}
}

func TestMorningBriefingWorker_DispatchesOncePerDay(t *testing.T) {
	var pushRequests int
	var receivedChannelID string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		pushRequests++
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"data":[{"status":"ok"}]}`))
	}))
	defer ts.Close()

	userID := "user-123"
	briefingRepo := newMockBriefingRepo()
	_ = briefingRepo.UpsertSettings(&domain.BriefingSettings{
		UserID:           userID,
		Enabled:          true,
		ScheduledTime:    "07:30",
		WakeupAlarmEarly: true,
		LastSentDate:     "",
	})

	tokenRepo := &mockTokenRepoForBriefing{
		token: domain.DeviceToken{UserID: userID, Token: "ExponentPushToken[mock-token]", Platform: "android"},
	}
	notifSvc := service.NewNotificationService(tokenRepo)
	notifSvc.SetExpoAPIURL(ts.URL)

	userRepo := &mockUserRepoForBriefing{
		user: &domain.User{ID: userID, Name: "André Victor"},
	}
	eventRepo := &mockEventRepoForBriefing{
		events: []domain.Event{
			{Title: "Café de Planejamento", StartAt: time.Date(2026, 10, 11, 8, 0, 0, 0, time.UTC)},
		},
	}
	todoRepo := &mockTodoRepoForBriefing{
		todos: []domain.Todo{{Title: "Revisar PR"}},
	}

	worker := service.NewMorningBriefingWorker(
		briefingRepo,
		eventRepo,
		todoRepo,
		userRepo,
		notifSvc,
		time.Minute,
	)
	worker.SetLocation(time.UTC)

	// Simula horário 07:30 do dia 2026-10-11
	now := time.Date(2026, 10, 11, 7, 30, 0, 0, time.UTC)

	// Primeiro ciclo às 07:30 -> deve despachar
	count, err := worker.ProcessBriefings(now)
	if err != nil {
		t.Fatalf("erro ao processar briefings: %v", err)
	}
	if count != 1 {
		t.Fatalf("esperava 1 briefing despachado, obteve %d", count)
	}
	if pushRequests != 1 {
		t.Fatalf("esperava 1 chamada HTTP ao Expo, obteve %d", pushRequests)
	}

	// Segundo ciclo às 07:31 no mesmo dia -> deve ser ignorado pela idempotência
	count2, err := worker.ProcessBriefings(now.Add(1 * time.Minute))
	if err != nil {
		t.Fatalf("erro ao reprocessar: %v", err)
	}
	if count2 != 0 {
		t.Errorf("esperava 0 briefings no segundo ciclo, obteve %d", count2)
	}
	if pushRequests != 1 {
		t.Errorf("push repetido! Total chamadas HTTP: %d", pushRequests)
	}
	_ = receivedChannelID
}

func containsString(haystack, needle string) bool {
	return len(haystack) >= len(needle) && (haystack == needle || (len(needle) > 0 && searchSubstring(haystack, needle)))
}

func searchSubstring(s, substr string) bool {
	for i := 0; i+len(substr) <= len(s); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
