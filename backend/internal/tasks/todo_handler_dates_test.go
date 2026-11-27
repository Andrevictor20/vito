package tasks

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
)

func TestTodoHandler_FlexibleDatesAndCustomCategories(t *testing.T) {
	userID := "user-todo-flex"
	repo := openPagedTestDB(t, userID)
	svc := NewTodoService(repo)
	h := NewTodoHandler(svc)

	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, userID))
			next.ServeHTTP(w, req)
		})
	})
	h.RegisterRoutes(r)

	// 1. Criar tarefa com data YYYY-MM-DD e categoria "casa"
	reqCreate := httptest.NewRequest(http.MethodPost, "/todos/", strings.NewReader(`{"title":"Comprar lâmpada","category":"casa","due_date":"2026-11-28","priority":"high"}`))
	rrCreate := httptest.NewRecorder()
	r.ServeHTTP(rrCreate, reqCreate)
	if rrCreate.Code != http.StatusCreated {
		t.Fatalf("POST /todos esperava 201, obteve %d: %s", rrCreate.Code, rrCreate.Body.String())
	}

	var created domain.Todo
	if err := json.NewDecoder(rrCreate.Body).Decode(&created); err != nil {
		t.Fatalf("decode create todo: %v", err)
	}
	if created.Category != "casa" {
		t.Errorf("esperava category='casa', obteve %q", created.Category)
	}
	if created.DueDate == nil || created.DueDate.Format("2006-01-02") != "2026-11-28" {
		t.Errorf("esperava due_date 2026-11-28, obteve %v", created.DueDate)
	}

	// 2. Atualizar com lista customizada list_custom_1 e limpar prazo (due_date: "")
	reqPatch := httptest.NewRequest(http.MethodPatch, "/todos/"+created.ID, strings.NewReader(`{"category":"list_custom_1","due_date":""}`))
	rrPatch := httptest.NewRecorder()
	r.ServeHTTP(rrPatch, reqPatch)
	if rrPatch.Code != http.StatusOK {
		t.Fatalf("PATCH /todos esperava 200, obteve %d: %s", rrPatch.Code, rrPatch.Body.String())
	}

	var patched domain.Todo
	if err := json.NewDecoder(rrPatch.Body).Decode(&patched); err != nil {
		t.Fatalf("decode patched todo: %v", err)
	}
	if patched.Category != "list_custom_1" {
		t.Errorf("esperava category='list_custom_1', obteve %q", patched.Category)
	}
	if patched.DueDate != nil {
		t.Errorf("esperava DueDate nil após string vazia, obteve %v", patched.DueDate)
	}
}
