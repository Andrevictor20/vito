package bots_test

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/andrevmp/vito/backend/internal/bots"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

type spyResolveToolset struct {
	executed bool
	lastOp   string
}

func (s *spyResolveToolset) Name() domain.ToolsetName { return domain.ToolsetTaskPending }
func (s *spyResolveToolset) Description() string      { return "spy" }
func (s *spyResolveToolset) IsWriteOperation(_ string, _ json.RawMessage) (bool, bool, map[string]any) {
	return true, false, nil
}
func (s *spyResolveToolset) Execute(_ context.Context, _ *domain.ToolExecutionContext, op string, _ json.RawMessage) (*domain.ToolExecutionResult, error) {
	s.executed = true
	s.lastOp = op
	return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Tarefa criada via aprovação."}, nil
}

func TestAC05_ResolvePendingExecutesApprovedTool(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "ac05.db"))
	if err != nil {
		t.Fatalf("erro ao abrir db: %v", err)
	}
	defer db.Close()

	ctx := context.Background()
	userID := "user-ac05"
	botID := "bot-ac05"
	_ = repository.NewUserRepository(db).Create(&domain.User{
		ID: userID, Name: "AC05", Email: "ac05@vito.local", CreatedAt: time.Now(), UpdatedAt: time.Now(),
	})

	botRepo := bots.NewBotRepository(db)
	_ = botRepo.Create(ctx, &domain.Bot{
		ID: botID, UserID: userID, Title: "Bot AC05", Goal: "Testar", Status: domain.TriggerStatusActive,
		Frequency: domain.FrequencyDailyMorning, Category: "custom",
	})

	convRepo := repository.NewConversationStoreRepository(db)
	_, _ = convRepo.GetOrCreateThread(ctx, userID, "bot_chat", "bot_"+botID)

	confGate := service.NewConfirmationGateService(db)
	pending, err := confGate.CreatePending(ctx, &service.CreatePendingRequest{
		UserID:        userID,
		ThreadID:      "bot_" + botID,
		Channel:       "bot_chat",
		ToolsetName:   string(domain.ToolsetTaskPending),
		Operation:     "create_todo",
		ArgumentsJSON: `{"title":"Revisar contrato"}`,
	})
	if err != nil {
		t.Fatalf("CreatePending falhou: %v", err)
	}

	spy := &spyResolveToolset{}
	reg := toolsets.NewToolsetsRegistry()
	reg.Register(spy)

	h := bots.NewBotHandler(db, botRepo, nil)
	h.SetConfirmationGate(confGate)
	h.SetToolsetRegistry(reg)
	h.SetConversationStore(convRepo)

	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			next.ServeHTTP(w, req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, userID)))
		})
	})
	r.Post("/api/v1/bots/{id}/pending/{confirmationId}/resolve", h.ResolvePending)

	body, _ := json.Marshal(map[string]string{"decision": "allow_once"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/bots/"+botID+"/pending/"+pending.ID+"/resolve", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200 OK, obteve %d: %s", rec.Code, rec.Body.String())
	}
	if !spy.executed || spy.lastOp != "create_todo" {
		t.Fatalf("esperava execução efetiva do toolset create_todo após allow_once, executed=%v op=%q", spy.executed, spy.lastOp)
	}
}
