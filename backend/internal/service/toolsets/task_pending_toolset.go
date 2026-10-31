package toolsets

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/google/uuid"
)

type TodoServiceContract interface {
	GetTodos(ctx context.Context, userID string) ([]*domain.Todo, error)
	CreateTodo(ctx context.Context, todo *domain.Todo) error
	CompleteTodo(ctx context.Context, id, userID string) error
	DeleteTodo(ctx context.Context, id, userID string) error
}

type TaskPendingToolset struct {
	todoService TodoServiceContract
}

func NewTaskPendingToolset(svc TodoServiceContract) *TaskPendingToolset {
	return &TaskPendingToolset{todoService: svc}
}

func (t *TaskPendingToolset) Name() domain.ToolsetName {
	return domain.ToolsetTaskPending
}

func (t *TaskPendingToolset) Description() string {
	return "Gerencia tarefas e pendências do usuário (listar, criar, concluir e excluir)."
}

func (t *TaskPendingToolset) JSONSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"operation": {
				"type": "string",
				"enum": ["list_todos", "create_todo", "complete_todo", "delete_todo"],
				"description": "Operação de tarefa a executar."
			},
			"params": {
				"type": "object",
				"properties": {
					"title": {"type": "string", "description": "Título da tarefa."},
					"description": {"type": "string", "description": "Descrição da tarefa."},
					"category": {"type": "string", "description": "Categoria (trabalho, pessoal, etc)."},
					"todo_id": {"type": "string", "description": "ID da tarefa."}
				}
			}
		},
		"required": ["operation"]
	}`)
}

func (t *TaskPendingToolset) IsWriteOperation(op string, rawParams json.RawMessage) (bool, bool, map[string]any) {
	preview := make(map[string]any)
	_ = json.Unmarshal(rawParams, &preview)

	switch op {
	case "create_todo", "complete_todo":
		return true, false, preview
	case "delete_todo":
		return true, true, preview
	default:
		return false, false, preview
	}
}

func (t *TaskPendingToolset) Execute(ctx context.Context, execCtx *domain.ToolExecutionContext, op string, rawParams json.RawMessage) (*domain.ToolExecutionResult, error) {
	var params struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Category    string `json:"category"`
		TodoID      string `json:"todo_id"`
	}
	if len(rawParams) > 0 {
		_ = json.Unmarshal(rawParams, &params)
	}

	switch op {
	case "create_todo":
		cat := params.Category
		if cat == "" {
			cat = "geral"
		}
		todo := &domain.Todo{
			ID:        uuid.New().String(),
			UserID:    execCtx.UserID,
			Title:     params.Title,
			Priority:  "medium",
			Category:  cat,
			Status:    domain.TodoStatusPending,
			CreatedAt: time.Now().UTC(),
			UpdatedAt: time.Now().UTC(),
		}
		if t.todoService != nil {
			if err := t.todoService.CreateTodo(ctx, todo); err != nil {
				return nil, err
			}
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			Data:          todo,
			SummaryForLLM: fmt.Sprintf("Tarefa '%s' criada com sucesso.", todo.Title),
			Cards: []domain.ChatCard{{
				ID:          todo.ID,
				Type:        "todo",
				Title:       todo.Title,
				Subtitle:    "Pendente",
				ActionLabel: "Ver Tarefa",
			}},
		}, nil

	case "complete_todo":
		if t.todoService != nil && params.TodoID != "" {
			if err := t.todoService.CompleteTodo(ctx, params.TodoID, execCtx.UserID); err != nil {
				return nil, err
			}
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: fmt.Sprintf("Tarefa %s marcada como concluída.", params.TodoID),
		}, nil

	case "delete_todo":
		if t.todoService != nil && params.TodoID != "" {
			if err := t.todoService.DeleteTodo(ctx, params.TodoID, execCtx.UserID); err != nil {
				return nil, err
			}
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: fmt.Sprintf("Tarefa %s excluída.", params.TodoID),
		}, nil

	default: // "list_todos"
		var todos []*domain.Todo
		if t.todoService != nil {
			todos, _ = t.todoService.GetTodos(ctx, execCtx.UserID)
		}
		var cards []domain.ChatCard
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("Tarefas ativas (%d):\n", len(todos)))
		for _, td := range todos {
			sb.WriteString(fmt.Sprintf("- [%s] %s (%s)\n", td.Status, td.Title, td.Category))
			cards = append(cards, domain.ChatCard{
				ID:          td.ID,
				Type:        "todo",
				Title:       td.Title,
				Subtitle:    td.Category,
				ActionLabel: "Concluir",
			})
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			Data:          todos,
			SummaryForLLM: sb.String(),
			Cards:         cards,
		}, nil
	}
}
