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

type mockPendingRepoForHandler struct {
	items map[string]*domain.PendingItem
}

func newMockPendingRepoForHandler() *mockPendingRepoForHandler {
	return &mockPendingRepoForHandler{items: make(map[string]*domain.PendingItem)}
}

func (m *mockPendingRepoForHandler) Create(item *domain.PendingItem) error {
	m.items[item.ID] = item
	return nil
}

func (m *mockPendingRepoForHandler) GetByID(id, userID string) (*domain.PendingItem, error) {
	item, ok := m.items[id]
	if !ok || item.UserID != userID {
		return nil, domain.ErrPendingItemNotFound
	}
	return item, nil
}

func (m *mockPendingRepoForHandler) ListByUser(userID string, status *domain.PendingStatus, category string) ([]domain.PendingItem, error) {
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

func (m *mockPendingRepoForHandler) Update(item *domain.PendingItem) error {
	if _, ok := m.items[item.ID]; !ok {
		return domain.ErrPendingItemNotFound
	}
	m.items[item.ID] = item
	return nil
}

func (m *mockPendingRepoForHandler) Delete(id, userID string) error {
	item, ok := m.items[id]
	if !ok || item.UserID != userID {
		return domain.ErrPendingItemNotFound
	}
	delete(m.items, id)
	return nil
}

func (m *mockPendingRepoForHandler) ListUnscheduledDueForNudge(cutoff time.Time) ([]domain.PendingItem, error) {
	return nil, nil
}

func (m *mockPendingRepoForHandler) MarkNudgeSent(id string, sentAt time.Time) error {
	return nil
}

func TestPendingHandler_Endpoints(t *testing.T) {
	repo := newMockPendingRepoForHandler()
	svc := service.NewPendingService(repo)
	h := handler.NewPendingHandler(svc)

	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-test")
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	})

	r.Get("/api/v1/pending", h.ListPending)
	r.Post("/api/v1/pending", h.CreatePending)
	r.Get("/api/v1/pending/{id}", h.GetPending)
	r.Patch("/api/v1/pending/{id}", h.UpdatePending)
	r.Post("/api/v1/pending/{id}/schedule", h.SchedulePending)
	r.Post("/api/v1/pending/{id}/complete", h.CompletePending)
	r.Delete("/api/v1/pending/{id}", h.DeletePending)

	// 1. Criar pendência (POST)
	body, _ := json.Marshal(map[string]string{
		"title":       "Contratar Seguro Auto",
		"description": "Cotação Porto Seguro e Azul",
		"category":    "automotivo",
	})
	req := httptest.NewRequest("POST", "/api/v1/pending", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("esperava 201 Created, obteve %d", rec.Code)
	}

	var created domain.PendingItem
	_ = json.NewDecoder(rec.Body).Decode(&created)
	if created.ID == "" || created.Title != "Contratar Seguro Auto" {
		t.Fatalf("pendência retornada inválida: %+v", created)
	}

	// 2. Listar pendências (GET)
	req = httptest.NewRequest("GET", "/api/v1/pending", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200 OK, obteve %d", rec.Code)
	}

	var list []domain.PendingItem
	_ = json.NewDecoder(rec.Body).Decode(&list)
	if len(list) != 1 {
		t.Fatalf("esperava 1 item na listagem, obteve %d", len(list))
	}

	// 3. Agendar pendência (POST /{id}/schedule)
	schedBody, _ := json.Marshal(map[string]string{
		"scheduled_date": "2026-10-30",
	})
	req = httptest.NewRequest("POST", "/api/v1/pending/"+created.ID+"/schedule", bytes.NewReader(schedBody))
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200 OK no agendamento, obteve %d", rec.Code)
	}

	// 4. Concluir pendência (POST /{id}/complete)
	req = httptest.NewRequest("POST", "/api/v1/pending/"+created.ID+"/complete", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200 OK na conclusão, obteve %d", rec.Code)
	}

	// 5. Excluir pendência (DELETE /{id})
	req = httptest.NewRequest("DELETE", "/api/v1/pending/"+created.ID, nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("esperava 204 No Content na deleção, obteve %d", rec.Code)
	}
}
