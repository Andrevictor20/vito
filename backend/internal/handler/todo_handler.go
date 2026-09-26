package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/andrevmp/kito/backend/internal/domain"
	"github.com/andrevmp/kito/backend/internal/handler/middleware"
	"github.com/andrevmp/kito/backend/internal/service"
)

type TodoHandler struct {
	todoSvc *service.TodoService
}

func NewTodoHandler(todoSvc *service.TodoService) *TodoHandler {
	return &TodoHandler{todoSvc: todoSvc}
}

type createTodoRequest struct {
	Title    string     `json:"title"`
	Priority string     `json:"priority"`
	DueDate  *time.Time `json:"due_date,omitempty"`
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

	todo, err := h.todoSvc.CreateTodo(userID, req.Title, req.Priority, req.DueDate)
	if err != nil {
		http.Error(w, `{"error":"falha ao criar tarefa"}`, http.StatusBadRequest)
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

	todoID := r.PathValue("id")
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

	todoID := r.PathValue("id")
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
