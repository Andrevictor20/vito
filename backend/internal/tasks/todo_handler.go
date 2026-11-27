package tasks

import (
	"encoding/json"
	"github.com/andrevmp/vito/backend/internal/platform/httpx"
	"github.com/andrevmp/vito/backend/internal/service"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
)

type TodoHandler struct {
	todoSvc *TodoService
	engine  service.AssistantEngine
}

func NewTodoHandler(todoSvc *TodoService) *TodoHandler {
	return &TodoHandler{todoSvc: todoSvc}
}

// parseFlexibleDate interpreta datas enviadas como YYYY-MM-DD, RFC3339 ou string vazia (limpar).
func parseFlexibleDate(raw *string) (*time.Time, bool, error) {
	if raw == nil {
		return nil, false, nil
	}
	trimmed := strings.TrimSpace(*raw)
	if trimmed == "" {
		return nil, true, nil
	}
	if len(trimmed) == 10 {
		if t, err := time.Parse("2006-01-02", trimmed); err == nil {
			endOfDay := time.Date(t.Year(), t.Month(), t.Day(), 23, 59, 0, 0, time.UTC)
			return &endOfDay, false, nil
		}
	}
	for _, layout := range []string{time.RFC3339Nano, time.RFC3339, "2006-01-02T15:04:05"} {
		if t, err := time.Parse(layout, trimmed); err == nil {
			utc := t.UTC()
			return &utc, false, nil
		}
	}
	return nil, false, domain.ErrValidation
}

type createTodoRequest struct {
	Title         string     `json:"title"`
	Priority      string     `json:"priority"`
	Category      string     `json:"category,omitempty"`
	DueDate       *string    `json:"due_date,omitempty"`
	RemindAt      *time.Time `json:"remind_at,omitempty"`
	RemindRepeat  string     `json:"remind_repeat,omitempty"`
	RemindAdvance int        `json:"remind_advance_minutes,omitempty"`
	EventID       string     `json:"event_id,omitempty"`
	EventTitle    string     `json:"event_title,omitempty"`
}

func (h *TodoHandler) CreateTodo(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	var req createTodoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload inválido")
		return
	}
	dueDate, _, err := parseFlexibleDate(req.DueDate)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "formato de data inválido (use YYYY-MM-DD ou ISO 8601)")
		return
	}

	todo, err := h.todoSvc.CreateTodoWithOptions(userID, domain.CreateTodoInput{
		Title:         req.Title,
		Priority:      req.Priority,
		Category:      req.Category,
		DueDate:       dueDate,
		RemindAt:      req.RemindAt,
		RemindRepeat:  req.RemindRepeat,
		RemindAdvance: req.RemindAdvance,
		EventID:       req.EventID,
		EventTitle:    req.EventTitle,
	})
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "falha ao criar tarefa: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(todo)
}

func (h *TodoHandler) ListTodos(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	q := r.URL.Query()
	// Sem ?limit= a resposta é a lista cheia (compatível com clientes atuais).
	if q.Get("limit") == "" {
		status := domain.TodoStatus(q.Get("status"))
		todos, err := h.todoSvc.ListTodos(userID, status)
		if err != nil {
			httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao listar tarefas")
			return
		}

		if todos == nil {
			todos = []domain.Todo{}
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(todos)
		return
	}

	filter := domain.TodoFilter{
		Status:  domain.TodoStatus(q.Get("status")),
		Overdue: q.Get("overdue") == "true",
		NoDate:  q.Get("nodate") == "true",
		Query:   q.Get("q"),
		Sort:    q.Get("sort"),
	}
	if n, err := httpx.ParsePositiveInt(q.Get("limit"), 50); err == nil {
		filter.Limit = n
	} else {
		filter.Limit = 50
	}
	if n, err := httpx.ParsePositiveInt(q.Get("offset"), 0); err == nil {
		filter.Offset = n
	}

	todos, total, err := h.todoSvc.ListTodosPaged(userID, filter)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao listar tarefas")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Total-Count", httpx.Itoa(total))
	_ = json.NewEncoder(w).Encode(todos)
}

type updateTodoRequest struct {
	Title         *string    `json:"title,omitempty"`
	Priority      *string    `json:"priority,omitempty"`
	Category      *string    `json:"category,omitempty"`
	DueDate       *string    `json:"due_date,omitempty"`
	RemindAt      *time.Time `json:"remind_at,omitempty"`
	RemindRepeat  *string    `json:"remind_repeat,omitempty"`
	RemindAdvance *int       `json:"remind_advance_minutes,omitempty"`
}

// UpdateTodo aplica a edição completa de uma tarefa.
func (h *TodoHandler) UpdateTodo(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	todoID := chi.URLParam(r, "id")
	if todoID == "" {
		todoID = r.PathValue("id")
	}
	if todoID == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "id ausente")
		return
	}

	var req updateTodoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload inválido")
		return
	}
	dueDate, clearDueDate, err := parseFlexibleDate(req.DueDate)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "formato de data inválido (use YYYY-MM-DD ou ISO 8601)")
		return
	}

	todo, err := h.todoSvc.UpdateTodo(todoID, userID, domain.UpdateTodoInput{
		Title:         req.Title,
		Priority:      req.Priority,
		Category:      req.Category,
		DueDate:       dueDate,
		ClearDueDate:  clearDueDate,
		RemindAt:      req.RemindAt,
		RemindRepeat:  req.RemindRepeat,
		RemindAdvance: req.RemindAdvance,
	})
	if err != nil {
		if err == domain.ErrTodoNotFound {
			httpx.RespondError(w, domain.ErrTodoNotFound)
			return
		}
		httpx.WriteJSONError(w, http.StatusBadRequest, "falha ao atualizar tarefa: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(todo)
}

func (h *TodoHandler) CompleteTodo(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	todoID := chi.URLParam(r, "id")
	if todoID == "" {
		todoID = r.PathValue("id")
	}
	if todoID == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "id ausente")
		return
	}

	if err := h.todoSvc.CompleteTodo(todoID, userID); err != nil {
		if err == domain.ErrTodoNotFound {
			httpx.RespondError(w, domain.ErrTodoNotFound)
			return
		}
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao concluir tarefa")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "completed"})
}

// ReopenTodo desfaz a conclusão de uma tarefa (volta a pendente).
func (h *TodoHandler) ReopenTodo(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	todoID := chi.URLParam(r, "id")
	if todoID == "" {
		todoID = r.PathValue("id")
	}
	if todoID == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "id ausente")
		return
	}

	if err := h.todoSvc.ReopenTodo(todoID, userID); err != nil {
		if err == domain.ErrTodoNotFound {
			httpx.RespondError(w, domain.ErrTodoNotFound)
			return
		}
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao reabrir tarefa")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "pending"})
}

func (h *TodoHandler) DeleteTodo(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	todoID := chi.URLParam(r, "id")
	if todoID == "" {
		todoID = r.PathValue("id")
	}
	if todoID == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "id ausente")
		return
	}

	if err := h.todoSvc.DeleteTodo(todoID, userID); err != nil {
		if err == domain.ErrTodoNotFound {
			httpx.RespondError(w, domain.ErrTodoNotFound)
			return
		}
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao excluir tarefa")
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
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	todoID := chi.URLParam(r, "id")
	if todoID == "" {
		todoID = r.PathValue("id")
	}

	var req addSubtaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload inválido")
		return
	}

	st, err := h.todoSvc.AddSubtask(todoID, userID, req.Title)
	if err != nil {
		if err == domain.ErrTodoNotFound {
			httpx.RespondError(w, domain.ErrTodoNotFound)
			return
		}
		httpx.WriteJSONError(w, http.StatusBadRequest, "falha ao adicionar subtarefa: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(st)
}

func (h *TodoHandler) ToggleSubtask(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
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
			httpx.RespondError(w, domain.ErrSubtaskNotFound)
			return
		}
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao alternar subtarefa")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(st)
}

func (h *TodoHandler) DeleteSubtask(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
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
			httpx.RespondError(w, domain.ErrSubtaskNotFound)
			return
		}
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao excluir subtarefa")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// RegisterRoutes registra os endpoints de tarefas e subtarefas no roteador protegido.
func (h *TodoHandler) RegisterRoutes(r chi.Router) {
	if h == nil {
		return
	}
	r.Route("/todos", func(tr chi.Router) {
		tr.Post("/", h.CreateTodo)
		tr.Get("/", h.ListTodos)
		tr.Patch("/{id}", h.UpdateTodo)
		tr.Patch("/{id}/complete", h.CompleteTodo)
		tr.Patch("/{id}/reopen", h.ReopenTodo)
		tr.Delete("/{id}", h.DeleteTodo)
		tr.Post("/{id}/subtasks", h.AddSubtask)
		tr.Post("/{id}/subtasks/suggest", h.SuggestSubtasks)
		tr.Patch("/{id}/subtasks/{subtaskId}/toggle", h.ToggleSubtask)
		tr.Delete("/{id}/subtasks/{subtaskId}", h.DeleteSubtask)
	})
}
