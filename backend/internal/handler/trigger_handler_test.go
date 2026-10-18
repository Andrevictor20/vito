package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

type mockTriggerRepoForHandler struct {
	triggers map[string]*domain.Trigger
	logs     []domain.TriggerLog
}

func newMockTriggerRepoForHandler() *mockTriggerRepoForHandler {
	return &mockTriggerRepoForHandler{triggers: make(map[string]*domain.Trigger)}
}

func (m *mockTriggerRepoForHandler) Create(t *domain.Trigger) error {
	m.triggers[t.ID] = t
	return nil
}

func (m *mockTriggerRepoForHandler) GetByID(id, userID string) (*domain.Trigger, error) {
	t, ok := m.triggers[id]
	if !ok || t.UserID != userID {
		return nil, domain.ErrTriggerNotFound
	}
	return t, nil
}

func (m *mockTriggerRepoForHandler) ListByUser(userID string, category domain.TriggerCategory, status domain.TriggerStatus) ([]domain.Trigger, error) {
	return nil, nil
}

func (m *mockTriggerRepoForHandler) ListActive() ([]domain.Trigger, error) { return nil, nil }

func (m *mockTriggerRepoForHandler) ListDueTriggers(now time.Time) ([]domain.Trigger, error) {
	return nil, nil
}

func (m *mockTriggerRepoForHandler) Update(t *domain.Trigger) error { return nil }

func (m *mockTriggerRepoForHandler) UpdateStatus(id, userID string, status domain.TriggerStatus) error {
	return nil
}

func (m *mockTriggerRepoForHandler) UpdateEvaluation(id string, currentValue string, status domain.TriggerStatus, lastChecked time.Time, nextCheck *time.Time) error {
	return nil
}

func (m *mockTriggerRepoForHandler) UpdateRunResult(id string, currentValue string, status domain.TriggerStatus, lastRunStatus string, lastChecked time.Time, nextCheck *time.Time) error {
	return nil
}

func (m *mockTriggerRepoForHandler) UpdateLastError(id string, errMsg string) error { return nil }

func (m *mockTriggerRepoForHandler) GetLastNotifiedAt(id string) (*time.Time, error) {
	return nil, nil
}

func (m *mockTriggerRepoForHandler) UpdateLastNotifiedAt(id string, t time.Time) error {
	return nil
}

func (m *mockTriggerRepoForHandler) GetSeenHashes(id string) ([]string, error) {
	return nil, nil
}

func (m *mockTriggerRepoForHandler) SetSeenHashes(id string, hashes []string) error {
	return nil
}

func (m *mockTriggerRepoForHandler) Delete(id, userID string) error { return nil }

func (m *mockTriggerRepoForHandler) CreateLog(l *domain.TriggerLog) error {
	m.logs = append(m.logs, *l)
	return nil
}

func (m *mockTriggerRepoForHandler) ListLogsByTrigger(triggerID string) ([]domain.TriggerLog, error) {
	return nil, nil
}

func (m *mockTriggerRepoForHandler) DeleteLog(logID, userID string) error { return nil }

func (m *mockTriggerRepoForHandler) ClearLogs(triggerID, userID string) error { return nil }

type recordingEvaluator struct {
	calls int
}

func (e *recordingEvaluator) Evaluate(ctx context.Context, t *domain.Trigger) (string, string, error) {
	e.calls++
	return "resumo", `{"status":"evaluated","condition_met":true,"confidence":90}`, nil
}

func (e *recordingEvaluator) TestEvaluate(ctx context.Context, t *domain.Trigger) (*domain.TriggerTestResult, error) {
	e.calls++
	return &domain.TriggerTestResult{TriggerID: t.ID, ConditionMet: true, Confidence: 90}, nil
}

// POST /triggers deve responder 201 rápido, sem rodar IA inline (senão o
// app aborta em 15s e o radar some da lista até o reload).
func TestTriggerHandler_CreateReturnsFastWithoutInlineRun(t *testing.T) {
	repo := newMockTriggerRepoForHandler()
	triggerSvc := service.NewTriggerService(repo)
	eval := &recordingEvaluator{}
	worker := service.NewTriggerWorker(repo, nil, eval)
	h := handler.NewTriggerHandler(triggerSvc, worker)

	body, _ := json.Marshal(map[string]string{
		"title": "TV 55", "category": "shopping", "query": "TV 55 abaixo de 3500",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/triggers", bytes.NewReader(body))
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-1")
	req = req.WithContext(ctx)
	rec := httptest.NewRecorder()

	h.CreateTrigger(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("esperava 201, veio %d: %s", rec.Code, rec.Body.String())
	}
	if eval.calls != 0 {
		t.Errorf("POST não deve avaliar IA inline, avaliou %d vez(es)", eval.calls)
	}
	if len(repo.logs) != 0 {
		t.Errorf("POST não deve criar log síncrono, criou %d", len(repo.logs))
	}
}

func TestTriggerHandler_ListTemplates(t *testing.T) {
	repo := newMockTriggerRepoForHandler()
	triggerSvc := service.NewTriggerService(repo)
	h := handler.NewTriggerHandler(triggerSvc)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/triggers/templates", nil)
	rec := httptest.NewRecorder()

	h.ListTemplates(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200, veio %d: %s", rec.Code, rec.Body.String())
	}

	var res struct {
		Templates []domain.TriggerTemplate `json:"templates"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatalf("falha ao deserializar resposta: %v", err)
	}
	if len(res.Templates) < 8 {
		t.Errorf("esperava ao menos 8 templates, obteve %d", len(res.Templates))
	}
}

func TestTriggerHandler_ActivateTemplate(t *testing.T) {
	repo := newMockTriggerRepoForHandler()
	triggerSvc := service.NewTriggerService(repo)
	h := handler.NewTriggerHandler(triggerSvc)

	// 1. Não autenticado -> 401
	reqUnauth := httptest.NewRequest(http.MethodPost, "/api/v1/triggers/templates/tmpl-career-jobs/activate", nil)
	recUnauth := httptest.NewRecorder()
	h.ActivateTemplate(recUnauth, reqUnauth)
	if recUnauth.Code != http.StatusUnauthorized {
		t.Errorf("esperava 401 para requisição sem usuário, veio %d", recUnauth.Code)
	}

	// 2. Autenticado com Chi context
	req := httptest.NewRequest(http.MethodPost, "/api/v1/triggers/templates/tmpl-career-jobs/activate", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "tmpl-career-jobs")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, "user-test-activate"))
	rec := httptest.NewRecorder()

	h.ActivateTemplate(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("esperava 201 Created, veio %d: %s", rec.Code, rec.Body.String())
	}

	var created domain.Trigger
	if err := json.NewDecoder(rec.Body).Decode(&created); err != nil {
		t.Fatalf("falha ao deserializar trigger criado: %v", err)
	}
	if created.UserID != "user-test-activate" || created.Category != domain.CategoryCareer {
		t.Errorf("trigger criado incorreto: %+v", created)
	}
}
