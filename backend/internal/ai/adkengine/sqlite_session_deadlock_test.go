package adkengine_test

import (
	"context"
	"encoding/json"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

type testAC01TodoSvc struct {
	svc *service.TodoService
}

func (a *testAC01TodoSvc) GetTodos(ctx context.Context, userID string) ([]*domain.Todo, error) {
	list, err := a.svc.ListTodos(userID, "")
	if err != nil {
		return nil, err
	}
	out := make([]*domain.Todo, 0, len(list))
	for i := range list {
		out = append(out, &list[i])
	}
	return out, nil
}

func (a *testAC01TodoSvc) CreateTodo(ctx context.Context, todo *domain.Todo) error {
	created, err := a.svc.CreateTodo(todo.UserID, todo.Title, string(todo.Priority), todo.DueDate)
	if err != nil {
		return err
	}
	if created != nil {
		*todo = *created
	}
	return nil
}

func (a *testAC01TodoSvc) CompleteTodo(ctx context.Context, id, userID string) error {
	return a.svc.CompleteTodo(id, userID)
}

func (a *testAC01TodoSvc) DeleteTodo(ctx context.Context, id, userID string) error {
	return a.svc.DeleteTodo(id, userID)
}

// TestAC01_NoDeadlockWithActiveWriterQueue garante que com DefaultWriterQueue ativa,
// turno normal, turno suspenso e confirmação "Sim" concluem em < 2s sem self-deadlock.
func TestAC01_NoDeadlockWithActiveWriterQueue(t *testing.T) {
	tmpDir := t.TempDir()
	db, err := database.Open(filepath.Join(tmpDir, "ac01_deadlock.db"))
	if err != nil {
		t.Fatalf("falha ao abrir banco: %v", err)
	}
	defer db.Close()

	q := database.NewSingleWriterQueue(64)
	database.SetDefaultWriterQueue(q)
	defer func() {
		database.SetDefaultWriterQueue(nil)
		q.Close()
	}()

	userID := "user-ac01"
	userRepo := repository.NewUserRepository(db)
	if err := userRepo.Create(&domain.User{
		ID:        userID,
		Name:      "André",
		Email:     "ac01@vito.local",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}); err != nil {
		t.Fatalf("falha ao criar usuário: %v", err)
	}

	convRepo := repository.NewConversationStoreRepository(db)
	todoRepo := repository.NewTodoRepository(db)
	todoSvc := service.NewTodoService(todoRepo)
	confGate := service.NewConfirmationGateService(db)
	scopeGuard := service.NewScopeGuard()

	reg := toolsets.NewToolsetsRegistry()
	reg.Register(toolsets.NewTaskPendingToolset(&testAC01TodoSvc{svc: todoSvc}))

	provider := &fakeAgentProvider{
		name:          "Fake-Gemini",
		model:         "gemini-2.5-flash",
		tier:          3,
		supportsTools: true,
		responses: []*ai.AgentChatResponse{
			{
				Text:         "Tudo certo por aqui!",
				ProviderName: "Fake-Gemini",
				ModelName:    "gemini-2.5-flash",
			},
			{
				ProviderName: "Fake-Gemini",
				ModelName:    "gemini-2.5-flash",
				ToolCalls: []ai.ToolCall{
					{
						ID:        "tc-1",
						Name:      "todo_create_todo",
						Arguments: json.RawMessage(`{"title":"Comprar café"}`),
					},
				},
			},
			{
				Text:         "Confirma a criação da tarefa?",
				ProviderName: "Fake-Gemini",
				ModelName:    "gemini-2.5-flash",
			},
		},
	}
	router := ai.NewModelRouter(provider)

	facade, err := adkengine.NewADKLoopFacade(adkengine.FacadeConfig{
		Router:           router,
		Registry:         reg,
		ScopeGuard:       scopeGuard,
		ConfirmationGate: confGate,
		ConvRepo:         convRepo,
		UserRepo:         userRepo,
	})
	if err != nil {
		t.Fatalf("falha ao criar ADKLoopFacade: %v", err)
	}

	threadID := "thread-ac01"
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// 1. Turno normal (persistCompletedTurn)
	resp1, err := facade.RunStream(ctx, domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: threadID,
		Channel:  "app_mobile",
		Message:  "Oi Vito",
	}, func(ai.StreamDelta) error { return nil })
	if err != nil {
		t.Fatalf("AC-01 turno normal falhou (possível deadlock): %v", err)
	}
	if resp1.Text == "" {
		t.Fatalf("AC-01 esperava resposta no turno normal")
	}

	// 2. Turno suspenso (modo assisted)
	resp2, err := facade.RunStream(ctx, domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: threadID,
		Channel:  "app_mobile",
		Message:  "Crie uma tarefa comprar café",
	}, func(ai.StreamDelta) error { return nil })
	if err != nil {
		t.Fatalf("AC-01 turno suspenso falhou: %v", err)
	}
	if !resp2.RequiresConfirmation || resp2.PendingConfirmationID == "" {
		t.Fatalf("AC-01 esperava suspensão HITL, obteve reqConf=%v pendingID=%q", resp2.RequiresConfirmation, resp2.PendingConfirmationID)
	}

	// 3. Confirmação "Sim" (recordSimpleTurns + emissão de Done: true)
	doneSeen := false
	resp3, err := facade.RunStream(ctx, domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: threadID,
		Channel:  "app_mobile",
		Message:  "Sim",
	}, func(d ai.StreamDelta) error {
		if d.Done {
			doneSeen = true
		}
		return nil
	})
	if err != nil {
		t.Fatalf("AC-01 confirmação 'Sim' falhou (possível deadlock): %v", err)
	}
	if !doneSeen {
		t.Errorf("AC-01 esperava delta Done=true na confirmação via RunStream")
	}
	if resp3 == nil || resp3.Text == "" {
		t.Fatalf("AC-01 esperava resposta na confirmação")
	}
}
