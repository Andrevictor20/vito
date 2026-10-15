package service_test

import (
	"context"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func setupQueryTestDB(t *testing.T, userID string) (*service.CalendarService, *service.TodoService) {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "test_query.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	_ = repository.NewUserRepository(db).Create(&domain.User{
		ID: userID, Name: "André", Email: userID + "@q.local",
		PasswordHash: "h", CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
	})
	return service.NewCalendarService(repository.NewEventRepository(db)),
		service.NewTodoService(repository.NewTodoRepository(db))
}

// P1: "Quais são minhas tarefas pendentes?" deve listar tarefas, nunca a agenda.
func TestAssistantService_QueryTodosListsPending(t *testing.T) {
	calSvc, todoSvc := setupQueryTestDB(t, "user-qtodos-1")
	if _, err := todoSvc.CreateTodo("user-qtodos-1", "Comprar café", "high", nil); err != nil {
		t.Fatal(err)
	}
	due := time.Date(2026, 10, 16, 18, 0, 0, 0, time.UTC)
	if _, err := todoSvc.CreateTodo("user-qtodos-1", "Pagar boleto", "medium", &due); err != nil {
		t.Fatal(err)
	}

	mockAI := &mockAIGateway{intent: &ai.ParsedIntent{Action: ai.ActionQueryTodos, Message: ""}}
	astSvc := service.NewAssistantService(mockAI, calSvc, todoSvc, nil)

	resp, err := astSvc.Process(context.Background(), "user-qtodos-1", ai.UserInput{
		Text: "Quais são minhas tarefas pendentes?", Now: time.Now().UTC(), Timezone: "America/Sao_Paulo",
	})
	if err != nil {
		t.Fatal(err)
	}
	if resp.Action != ai.ActionQueryTodos {
		t.Fatalf("expected action QUERY_TODOS, got %s", resp.Action)
	}
	for _, want := range []string{"Comprar café", "Pagar boleto", "2 tarefas pendentes"} {
		if !strings.Contains(resp.Message, want) {
			t.Errorf("resposta deveria conter %q: %q", want, resp.Message)
		}
	}
	if strings.Contains(resp.Message, "(s)") {
		t.Errorf("plural quebrado com (s): %q", resp.Message)
	}
}

func TestAssistantService_QueryTodosEmpty(t *testing.T) {
	calSvc, todoSvc := setupQueryTestDB(t, "user-qtodos-vazio")
	mockAI := &mockAIGateway{intent: &ai.ParsedIntent{Action: ai.ActionQueryTodos, Message: ""}}
	astSvc := service.NewAssistantService(mockAI, calSvc, todoSvc, nil)

	resp, err := astSvc.Process(context.Background(), "user-qtodos-vazio", ai.UserInput{
		Text: "E minhas tarefas?", Now: time.Now().UTC(), Timezone: "America/Sao_Paulo",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(strings.ToLower(resp.Message), "pendente") {
		t.Errorf("sem tarefas deveria declarar ausência de pendências: %q", resp.Message)
	}
}

// P2: "Quais eventos tenho no sábado?" deve responder o sábado, nunca hoje.
func TestAssistantService_QueryScheduleTargetDate(t *testing.T) {
	calSvc, todoSvc := setupQueryTestDB(t, "user-qsat-1")
	// Quarta 14/10: evento de hoje; sábado 17/10: churrasco 15:00 BRT (18:00Z).
	todayStart := time.Date(2026, 10, 14, 14, 0, 0, 0, time.UTC)
	if _, _, err := calSvc.CreateEvent("user-qsat-1", "Daily", "", "", todayStart, todayStart.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	satStart := time.Date(2026, 10, 17, 18, 0, 0, 0, time.UTC)
	if _, _, err := calSvc.CreateEvent("user-qsat-1", "Churrasco", "", "", satStart, satStart.Add(2*time.Hour)); err != nil {
		t.Fatal(err)
	}

	brt := time.FixedZone("GMT-3", -3*3600)
	mockAI := &mockAIGateway{intent: &ai.ParsedIntent{
		Action:  ai.ActionQuerySchedule,
		Message: "",
		Event:   &ai.ParsedEvent{StartAt: time.Date(2026, 10, 17, 0, 0, 0, 0, brt)},
	}}
	astSvc := service.NewAssistantService(mockAI, calSvc, todoSvc, nil)

	resp, err := astSvc.Process(context.Background(), "user-qsat-1", ai.UserInput{
		Text:     "Quais eventos tenho no sábado?",
		Now:      time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC),
		Timezone: "America/Sao_Paulo",
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"Churrasco", "15:00", "sábado", "17/10"} {
		if !strings.Contains(resp.Message, want) {
			t.Errorf("resposta deveria conter %q (evento de sábado): %q", want, resp.Message)
		}
	}
	if strings.Contains(resp.Message, "Daily") {
		t.Errorf("resposta de sábado não deveria vazar o evento de hoje: %q", resp.Message)
	}
}

// Feriados/datas comemorativas vindos do Google (categoria holiday, dia inteiro)
// não são compromissos: "quais meus eventos de hoje?" deve ignorá-los.
func TestAssistantService_QueryScheduleIgnoresHolidays(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "test_query_holiday.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	eventRepo := repository.NewEventRepository(db)
	calSvc := service.NewCalendarService(eventRepo)

	seedUser := func(id string) {
		t.Helper()
		if err := userRepo.Create(&domain.User{
			ID: id, Name: "André", Email: id + "@q.local",
			PasswordHash: "h", CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
		}); err != nil {
			t.Fatal(err)
		}
	}
	// 02/11/2026 = segunda-feira (Finados), dia inteiro em BRT.
	brt := time.FixedZone("BRT", -3*3600)
	seedHoliday := func(userID string) {
		t.Helper()
		hol := &domain.Event{
			ID: "hol-" + userID, UserID: userID, Title: "Finados",
			Category: "holiday", Source: "google",
			StartAt:   time.Date(2026, 11, 2, 0, 0, 0, 0, brt).UTC(),
			EndAt:     time.Date(2026, 11, 3, 0, 0, 0, 0, brt).UTC(),
			CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
		}
		if err := eventRepo.Create(hol); err != nil {
			t.Fatal(err)
		}
	}

	// Caso 1: feriado + compromisso real no mesmo dia.
	seedUser("user-qhol-1")
	seedHoliday("user-qhol-1")
	dentStart := time.Date(2026, 11, 2, 14, 0, 0, 0, time.UTC) // 11:00 BRT
	if _, _, err := calSvc.CreateEvent("user-qhol-1", "Dentista", "", "", dentStart, dentStart.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}

	mockAI := &mockAIGateway{intent: &ai.ParsedIntent{Action: ai.ActionQuerySchedule, Message: ""}}
	astSvc := service.NewAssistantService(mockAI, calSvc, nil, nil)

	resp, err := astSvc.Process(context.Background(), "user-qhol-1", ai.UserInput{
		Text:     "quais meus eventos de hoje?",
		Now:      time.Date(2026, 11, 2, 12, 0, 0, 0, time.UTC),
		Timezone: "America/Sao_Paulo",
	})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(resp.Message, "Finados") {
		t.Errorf("feriado não deveria ser listado como evento: %q", resp.Message)
	}
	for _, want := range []string{"Dentista", "1 compromisso", "hoje"} {
		if !strings.Contains(resp.Message, want) {
			t.Errorf("resposta deveria conter %q: %q", want, resp.Message)
		}
	}

	// Caso 2: dia com SÓ feriado → agenda livre.
	seedUser("user-qhol-2")
	seedHoliday("user-qhol-2")

	resp2, err := astSvc.Process(context.Background(), "user-qhol-2", ai.UserInput{
		Text:     "quais meus eventos de hoje?",
		Now:      time.Date(2026, 11, 2, 12, 0, 0, 0, time.UTC),
		Timezone: "America/Sao_Paulo",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(resp2.Message, "nenhum compromisso") {
		t.Errorf("dia só com feriado deveria declarar agenda livre: %q", resp2.Message)
	}
	if strings.Contains(resp2.Message, "Finados") {
		t.Errorf("feriado isolado não deveria ser listado: %q", resp2.Message)
	}
}
