package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

type TodoHandler struct {
	todoSvc *service.TodoService
}

func NewTodoHandler(todoSvc *service.TodoService) *TodoHandler {
	return &TodoHandler{todoSvc: todoSvc}
}

type createTodoRequest struct {
	Title      string     `json:"title"`
	Priority   string     `json:"priority"`
	DueDate    *time.Time `json:"due_date,omitempty"`
	EventID    string     `json:"event_id,omitempty"`
	EventTitle string     `json:"event_title,omitempty"`
}

func (h *TodoHandler) CreateTodo(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	var req createTodoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload inválido"}`, http.StatusBadRequest)
		return
	}

	todo, err := h.todoSvc.CreateTodoWithOptions(userID, domain.CreateTodoInput{
		Title:      req.Title,
		Priority:   req.Priority,
		DueDate:    req.DueDate,
		EventID:    req.EventID,
		EventTitle: req.EventTitle,
	})
	if err != nil {
		http.Error(w, `{"error":"falha ao criar tarefa: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(todo)
}

func (h *TodoHandler) ListTodos(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	status := domain.TodoStatus(r.URL.Query().Get("status"))
	todos, err := h.todoSvc.ListTodos(userID, status)
	if err != nil {
		http.Error(w, `{"error":"falha ao listar tarefas"}`, http.StatusInternalServerError)
		return
	}

	if todos == nil {
		todos = []domain.Todo{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(todos)
}

func (h *TodoHandler) CompleteTodo(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	todoID := chi.URLParam(r, "id")
	if todoID == "" {
		todoID = r.PathValue("id")
	}
	if todoID == "" {
		http.Error(w, `{"error":"id ausente"}`, http.StatusBadRequest)
		return
	}

	if err := h.todoSvc.CompleteTodo(todoID, userID); err != nil {
		if err == domain.ErrTodoNotFound {
			http.Error(w, `{"error":"tarefa não encontrada"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"falha ao concluir tarefa"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "completed"})
}

func (h *TodoHandler) DeleteTodo(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	todoID := chi.URLParam(r, "id")
	if todoID == "" {
		todoID = r.PathValue("id")
	}
	if todoID == "" {
		http.Error(w, `{"error":"id ausente"}`, http.StatusBadRequest)
		return
	}

	if err := h.todoSvc.DeleteTodo(todoID, userID); err != nil {
		if err == domain.ErrTodoNotFound {
			http.Error(w, `{"error":"tarefa não encontrada"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"falha ao excluir tarefa"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type addSubtaskRequest struct {
	Title string `json:"title"`
}

func (h *TodoHandler) AddSubtask(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	todoID := chi.URLParam(r, "id")
	if todoID == "" {
		todoID = r.PathValue("id")
	}

	var req addSubtaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload inválido"}`, http.StatusBadRequest)
		return
	}

	st, err := h.todoSvc.AddSubtask(todoID, userID, req.Title)
	if err != nil {
		if err == domain.ErrTodoNotFound {
			http.Error(w, `{"error":"tarefa não encontrada"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"falha ao adicionar subtarefa: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(st)
}

func (h *TodoHandler) ToggleSubtask(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	todoID := chi.URLParam(r, "id")
	if todoID == "" {
		todoID = r.PathValue("id")
	}
	subtaskID := chi.URLParam(r, "subtaskId")
	if subtaskID == "" {
		subtaskID = r.PathValue("subtaskId")
	}

	st, err := h.todoSvc.ToggleSubtask(subtaskID, todoID, userID)
	if err != nil {
		if err == domain.ErrSubtaskNotFound || err == domain.ErrTodoNotFound {
			http.Error(w, `{"error":"subtarefa não encontrada"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"falha ao alternar subtarefa"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(st)
}

func (h *TodoHandler) DeleteSubtask(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	todoID := chi.URLParam(r, "id")
	if todoID == "" {
		todoID = r.PathValue("id")
	}
	subtaskID := chi.URLParam(r, "subtaskId")
	if subtaskID == "" {
		subtaskID = r.PathValue("subtaskId")
	}

	if err := h.todoSvc.DeleteSubtask(subtaskID, todoID, userID); err != nil {
		if err == domain.ErrSubtaskNotFound || err == domain.ErrTodoNotFound {
			http.Error(w, `{"error":"subtarefa não encontrada"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"falha ao excluir subtarefa"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
