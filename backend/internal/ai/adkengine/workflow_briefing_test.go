package adkengine_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

type syncBriefingProvider struct {
	mu    sync.Mutex
	calls int
}

func (p *syncBriefingProvider) Name() string          { return "Gemini-Briefing" }
func (p *syncBriefingProvider) ModelName() string     { return "gemini-2.5-flash" }
func (p *syncBriefingProvider) SupportsTools() bool   { return false }
func (p *syncBriefingProvider) SupportsVision() bool  { return false }
func (p *syncBriefingProvider) QualityTier() int      { return 3 }
func (p *syncBriefingProvider) MaxContextTokens() int { return 65536 }
func (p *syncBriefingProvider) Chat(ctx context.Context, req ai.AgentChatRequest) (*ai.AgentChatResponse, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.calls++
	text := "Sinal coletado."
	if strings.Contains(req.SystemPrompt, "Combine os sinais coletados") {
		text = "Prioridade 1: Reunião às 09h; finanças e mensagens em dia."
	}
	return &ai.AgentChatResponse{Text: text, ProviderName: p.Name(), ModelName: p.ModelName()}, nil
}

func (p *syncBriefingProvider) StreamChat(ctx context.Context, req ai.AgentChatRequest, onDelta func(ai.StreamDelta) error) (*ai.AgentChatResponse, error) {
	resp, err := p.Chat(ctx, req)
	if err != nil {
		return nil, err
	}
	if onDelta != nil {
		_ = onDelta(ai.StreamDelta{TextDelta: resp.Text})
		_ = onDelta(ai.StreamDelta{Done: true, FinalMetrics: resp})
	}
	return resp, nil
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

	prov := &syncBriefingProvider{}
	router := ai.NewModelRouter()
	router.AddProvider(prov)
	wfRunner, err := adkengine.NewCrossDomainBriefingWorkflowRunner(adkengine.NewRoutedLLM(router), nil)
	if err != nil {
		t.Fatalf("falha ao criar CrossDomainBriefingWorkflowRunner: %v", err)
	}

	worker := service.NewMorningBriefingWorker(
		briefingRepo,
		repository.NewEventRepository(db),
		repository.NewTodoRepository(db),
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
