package tasks

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/platform/httpx"
	"github.com/andrevmp/vito/backend/internal/service"
)

// SetAssistantEngine conecta o motor de IA para sugestão real de subtarefas.
func (h *TodoHandler) SetAssistantEngine(engine service.AssistantEngine) {
	h.engine = engine
}

// SuggestSubtasks usa o AssistantEngine real para gerar 3 a 4 passos objetivos e persistir em todo_subtasks.
func (h *TodoHandler) SuggestSubtasks(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	if h.engine == nil {
		httpx.WriteJSONError(w, http.StatusServiceUnavailable, "motor de IA não configurado para sugerir subtarefas")
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

	todo, err := h.todoSvc.GetTodo(todoID, userID)
	if err != nil {
		if err == domain.ErrTodoNotFound {
			httpx.RespondError(w, domain.ErrTodoNotFound)
			return
		}
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao carregar tarefa")
		return
	}

	prompt := "Sugira de 3 a 4 subtarefas práticas e curtas (máximo 8 palavras cada) para concluir a tarefa: \"" +
		todo.Title + "\" (categoria: " + todo.Category + "). Responda SOMENTE com um array JSON de strings, ex: [\"Passo 1\",\"Passo 2\",\"Passo 3\"]. Não execute ferramentas."

	resp, err := h.engine.Run(r.Context(), domain.UnifiedAssistantRequest{
		UserID:        userID,
		Channel:       "app_mobile",
		StyleOverride: "direct",
		Message:       prompt,
	})
	if err != nil || resp == nil {
		httpx.WriteJSONError(w, http.StatusBadGateway, "falha ao consultar IA para subtarefas")
		return
	}

	steps := parseSuggestedSubtasks(resp.Text)
	if len(steps) == 0 {
		httpx.WriteJSONError(w, http.StatusUnprocessableEntity, "a IA não retornou subtarefas utilizáveis")
		return
	}

	created := make([]domain.Subtask, 0, len(steps))
	for _, title := range steps {
		st, addErr := h.todoSvc.AddSubtask(todoID, userID, title)
		if addErr == nil && st != nil {
			created = append(created, *st)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"subtasks": created,
	})
}

func parseSuggestedSubtasks(raw string) []string {
	cleaned := strings.TrimSpace(raw)
	if start := strings.Index(cleaned, "["); start >= 0 {
		if end := strings.LastIndex(cleaned, "]"); end > start {
			var arr []string
			if err := json.Unmarshal([]byte(cleaned[start:end+1]), &arr); err == nil {
				return sanitizeSubtaskTitles(arr)
			}
		}
	}
	lines := strings.Split(cleaned, "\n")
	candidates := make([]string, 0, len(lines))
	for _, line := range lines {
		s := strings.TrimSpace(line)
		s = strings.TrimLeft(s, "-*•0123456789.) ")
		s = strings.Trim(s, `"'`)
		if s != "" && !strings.HasPrefix(s, "```") {
			candidates = append(candidates, s)
		}
	}
	return sanitizeSubtaskTitles(candidates)
}

func sanitizeSubtaskTitles(items []string) []string {
	out := make([]string, 0, 4)
	seen := make(map[string]bool)
	for _, item := range items {
		t := strings.TrimSpace(item)
		if t == "" || seen[strings.ToLower(t)] {
			continue
		}
		if len(t) > 120 {
			t = strings.TrimSpace(t[:120])
		}
		seen[strings.ToLower(t)] = true
		out = append(out, t)
		if len(out) >= 4 {
			break
		}
	}
	return out
}
