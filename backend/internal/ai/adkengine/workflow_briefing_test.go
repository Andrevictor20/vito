package adkengine_test

import (
	"context"
	"github.com/andrevmp/vito/backend/internal/calendar"
	"github.com/andrevmp/vito/backend/internal/tasks"
	"iter"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"google.golang.org/adk/v2/model"
	"google.golang.org/genai"

	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

type syncBriefingLLM struct {
	mu    sync.Mutex
	calls int
}

func (p *syncBriefingLLM) Name() string { return "gemini-2.5-flash" }
func (p *syncBriefingLLM) GenerateContent(_ context.Context, req *model.LLMRequest, _ bool) iter.Seq2[*model.LLMResponse, error] {
	return func(yield func(*model.LLMResponse, error) bool) {
		p.mu.Lock()
		p.calls++
		p.mu.Unlock()
		sysPrompt := ""
		if req != nil && req.Config != nil && req.Config.SystemInstruction != nil {
			for _, pt := range req.Config.SystemInstruction.Parts {
				if pt != nil {
					sysPrompt += pt.Text
				}
			}
		}
		text := "Sinal coletado."
		if strings.Contains(sysPrompt, "Combine os sinais coletados") {
			text = "Prioridade 1: Reunião às 09h; finanças e mensagens em dia."
		}
		yield(&model.LLMResponse{
			ModelVersion: p.Name(),
			TurnComplete: true,
			Content: &genai.Content{
				Role:  genai.RoleModel,
				Parts: []*genai.Part{{Text: text}},
			},
		}, nil)
	}
}

func TestCrossDomainBriefingWorkflowRunner_WiredIntoMorningBriefingWorker(t *testing.T) {
	var mu sync.Mutex
	var pushCalls int
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		pushCalls++
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"status":"ok"}]}`))
	}))
	defer ts.Close()

	db, err := database.Open(filepath.Join(t.TempDir(), "briefing_adk_e2e.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	now := time.Date(2026, 11, 21, 7, 30, 0, 0, time.UTC)
	userID := "user-briefing-adk"
	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{
		ID:        userID,
		Name:      "André",
		Email:     "andre.brief@vito.ai",
		CreatedAt: now,
		UpdatedAt: now,
	})
	briefingRepo := repository.NewBriefingRepository(db)
	_ = briefingRepo.UpsertSettings(&domain.BriefingSettings{
		UserID:        userID,
		Enabled:       true,
		ScheduledTime: "07:30",
	})
	tokenRepo := repository.NewDeviceTokenRepository(db)
	_ = tokenRepo.Save(&domain.DeviceToken{
		ID:        "tok-brief-adk",
		UserID:    userID,
		Token:     "ExponentPushToken[adk-brief]",
		Platform:  "android",
		CreatedAt: now,
		UpdatedAt: now,
	})
	notifSvc := service.NewNotificationService(tokenRepo, ts.Client())
	notifSvc.SetExpoAPIURL(ts.URL)

	prov := &syncBriefingLLM{}
	wfRunner, err := adkengine.NewCrossDomainBriefingWorkflowRunner(
		adkengine.NewRoutedLLM(testServerPool("Gemini-Briefing", "gemini-2.5-flash", prov)...),
		nil,
	)
	if err != nil {
		t.Fatalf("falha ao criar CrossDomainBriefingWorkflowRunner: %v", err)
	}

	worker := service.NewMorningBriefingWorker(
		briefingRepo,
		calendar.NewEventRepository(db),
		tasks.NewTodoRepository(db),
		userRepo,
		notifSvc,
		time.Minute,
	)
	worker.SetLocation(time.UTC)
	worker.SetBriefingWorkflowRunner(wfRunner)

	dispatched, err := worker.ProcessBriefings(now)
	if err != nil {
		t.Fatalf("falha ao processar briefings com workflow ADK: %v", err)
	}
	mu.Lock()
	gotPushes := pushCalls
	mu.Unlock()
	if dispatched != 1 || gotPushes != 1 {
		t.Fatalf("esperava 1 briefing despachado via workflow ADK, obteve dispatched=%d pushCalls=%d", dispatched, gotPushes)
	}
}
