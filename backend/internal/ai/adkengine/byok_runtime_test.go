package adkengine

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"github.com/andrevmp/vito/backend/internal/bots"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

type hostRouterRT struct {
	mu     sync.RWMutex
	routes map[string]http.Handler
}

func (rt *hostRouterRT) RoundTrip(req *http.Request) (*http.Response, error) {
	rt.mu.RLock()
	h := rt.routes[req.URL.Host]
	rt.mu.RUnlock()
	if h == nil {
		return nil, fmt.Errorf("nenhuma rota configurada para host %s", req.URL.Host)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec.Result(), nil
}

type runtimeFixture struct {
	db           *sql.DB
	userID       string
	providerRepo *repository.AIProviderRepositorySQLite
	settingsRepo *repository.AISettingsRepositorySQLite
	convRepo     *repository.ConversationStoreRepository
	triggerRepo  *bots.TriggerRepositorySQLite
	traceRec     *ai.RingBufferTraceRecorder
	registry     *service.UserProviderRegistry
	resolver     *service.ModelResolver
	svc          *service.AIProviderService
	facade       *ADKLoopFacade
	serverProv   *mockServerProvider
	rt           *hostRouterRT
}

type mockServerProvider struct {
	calls atomic.Int32
	reply string
}

func (m *mockServerProvider) Name() string          { return "server-gemini" }
func (m *mockServerProvider) ModelName() string     { return "gemini-2.5-flash" }
func (m *mockServerProvider) SupportsTools() bool   { return true }
func (m *mockServerProvider) SupportsVision() bool  { return true }
func (m *mockServerProvider) QualityTier() int      { return 3 }
func (m *mockServerProvider) MaxContextTokens() int { return 65536 }
func (m *mockServerProvider) Chat(_ context.Context, _ ai.AgentChatRequest) (*ai.AgentChatResponse, error) {
	m.calls.Add(1)
	reply := m.reply
	if reply == "" {
		reply = "Resposta via servidor Vito"
	}
	return &ai.AgentChatResponse{Text: reply, ProviderName: m.Name(), ModelName: m.ModelName(), TokensIn: 10, TokensOut: 5}, nil
}
func (m *mockServerProvider) StreamChat(ctx context.Context, req ai.AgentChatRequest, onDelta func(ai.StreamDelta) error) (*ai.AgentChatResponse, error) {
	resp, err := m.Chat(ctx, req)
	if err == nil && onDelta != nil {
		_ = onDelta(ai.StreamDelta{Type: "text", TextDelta: resp.Text})
	}
	return resp, err
}

func setupBYOKRuntime(t *testing.T, routes map[string]http.Handler) *runtimeFixture {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "byok_rt.db"))
	if err != nil {
		t.Fatalf("database.Open: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	userID := "u-byok-rt-1"
	now := time.Now().UTC()
	_ = userRepo.Create(&domain.User{ID: userID, Name: "BYOK User", Email: "byok@vito.test", CreatedAt: now, UpdatedAt: now})

	providerRepo := repository.NewAIProviderRepository(db)
	settingsRepo := repository.NewAISettingsRepository(db)
	convRepo := repository.NewConversationStoreRepository(db)
	triggerRepo := bots.NewTriggerRepository(db)
	traceRec := ai.NewRingBufferTraceRecorder(db, 100, time.Hour)
	t.Cleanup(func() { _ = traceRec.Close() })

	vault := service.NewAIKeyVault("0123456789abcdef0123456789abcdef")
	rt := &hostRouterRT{routes: routes}
	httpClient := &http.Client{Transport: rt}

	registry := service.NewUserProviderRegistry(vault, NewADKLLMFactory(), providerRepo, 0)
	registry.SetHTTPClientForTest(httpClient)
	resolver := service.NewModelResolver(providerRepo, settingsRepo, convRepo, triggerRepo, registry)
	svc := service.NewAIProviderService(providerRepo, settingsRepo, convRepo, triggerRepo, vault, registry, 0)
	svc.SetVerifyHTTPClientForTest(httpClient)

	serverProv := &mockServerProvider{}
	router := ai.NewModelRouter(serverProv)
	facade, err := NewADKLoopFacade(FacadeConfig{
		Router:           router,
		Registry:         toolsets.NewToolsetsRegistry(),
		ScopeGuard:       service.NewScopeGuard(),
		ConfirmationGate: service.NewConfirmationGateService(db),
		ConvRepo:         convRepo,
		TraceRecorder:    traceRec,
		UserRepo:         userRepo,
		AISettingsRepo:   settingsRepo,
		ModelResolver:    resolver,
		AIProviderRepo:   providerRepo,
		UserRegistry:     registry,
	})
	if err != nil {
		t.Fatalf("NewADKLoopFacade: %v", err)
	}
	facade.routedLLM.SetRetryBackoffForTest(time.Millisecond)

	return &runtimeFixture{
		db:           db,
		userID:       userID,
		providerRepo: providerRepo,
		settingsRepo: settingsRepo,
		convRepo:     convRepo,
		triggerRepo:  triggerRepo,
		traceRec:     traceRec,
		registry:     registry,
		resolver:     resolver,
		svc:          svc,
		facade:       facade,
		serverProv:   serverProv,
		rt:           rt,
	}
}

func TestBYOKRuntime_AI05_AI09_AI04_DefaultAnthropicAndEffortAndNoLeak(t *testing.T) {
	secretKey := "sk-ant-api03-supersecretvalue1234567890"
	var gotAuthHeader string
	var gotThinking map[string]any
	var antCalls atomic.Int32

	routes := map[string]http.Handler{
		"api.anthropic.com": http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			if r.Method == http.MethodGet && r.URL.Path == "/v1/models" {
				_, _ = fmt.Fprint(w, `{"data":[{"id":"claude-sonnet-4-20250514","display_name":"Claude Sonnet 4"}]}`)
				return
			}
			antCalls.Add(1)
			gotAuthHeader = r.Header.Get("x-api-key")
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			if th, ok := body["thinking"].(map[string]any); ok {
				gotThinking = th
			}
			_, _ = fmt.Fprint(w, `{
				"id":"msg_ant_1","model":"claude-sonnet-4-20250514","stop_reason":"end_turn",
				"content":[{"type":"text","text":"Olá via Anthropic BYOK!"}],
				"usage":{"input_tokens":30,"output_tokens":12}
			}`)
		}),
	}

	var logBuf bytes.Buffer
	origOut := log.Writer()
	log.SetOutput(&logBuf)
	defer log.SetOutput(origOut)

	fx := setupBYOKRuntime(t, routes)
	ctx := context.Background()
	if _, err := fx.svc.Connect(ctx, fx.userID, domain.ProviderKeyAnthropic, secretKey, ""); err != nil {
		t.Fatalf("Connect anthropic: %v", err)
	}
	if _, err := fx.svc.UpdatePreferences(ctx, fx.userID, "anthropic:claude-sonnet-4-20250514", domain.EffortHigh); err != nil {
		t.Fatalf("UpdatePreferences: %v", err)
	}

	resp, err := fx.facade.Run(ctx, domain.UnifiedAssistantRequest{
		UserID:  fx.userID,
		Channel: "app_mobile",
		Message: "Oi Claude",
	})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if antCalls.Load() != 1 || fx.serverProv.calls.Load() != 0 {
		t.Fatalf("esperava 1 chamada Anthropic e 0 servidor; got ant=%d srv=%d", antCalls.Load(), fx.serverProv.calls.Load())
	}
	if gotAuthHeader != secretKey {
		t.Fatalf("esperava header x-api-key com a chave conectada")
	}
	if resp.ModelUsed != "Claude Sonnet 4" {
		t.Fatalf("AI-05 ModelUsed = %q, want Claude Sonnet 4", resp.ModelUsed)
	}
	if gotThinking == nil || gotThinking["type"] != "enabled" || int(gotThinking["budget_tokens"].(float64)) != 16000 {
		t.Fatalf("AI-09 esperava thinking budget_tokens=16000 para effort=high (Anthropic), obteve %+v", gotThinking)
	}

	if err := fx.traceRec.FlushNow(ctx); err != nil {
		t.Fatalf("FlushNow: %v", err)
	}
	var credSource, provKey, effort string
	err = fx.db.QueryRow(`SELECT credential_source, provider_key, effort FROM ai_traces LIMIT 1`).Scan(&credSource, &provKey, &effort)
	if err != nil {
		t.Fatalf("query ai_traces: %v", err)
	}
	if credSource != "byok" || provKey != "anthropic" || effort != domain.EffortHigh {
		t.Fatalf("trace inesperado: source=%q key=%q effort=%q", credSource, provKey, effort)
	}
	// AI-04: nenhuma chave em texto claro nos logs ou ai_traces
	if strings.Contains(logBuf.String(), secretKey) {
		t.Fatalf("AI-04 vazou chave nos logs!")
	}
	var rawLeak int
	_ = fx.db.QueryRow(`SELECT COUNT(*) FROM ai_traces WHERE provider_name LIKE ? OR error_code LIKE ? OR fallback_reason LIKE ?`, "%"+secretKey+"%", "%"+secretKey+"%", "%"+secretKey+"%").Scan(&rawLeak)
	if rawLeak > 0 {
		t.Fatalf("AI-04 vazou chave em ai_traces")
	}
}

func TestBYOKRuntime_AI06_ThreadOverridesBotAndNonReasoningOmitsEffort(t *testing.T) {
	var openaiCalls, googleCalls atomic.Int32
	routes := map[string]http.Handler{
		"api.openai.com": http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			if r.Method == http.MethodGet && r.URL.Path == "/v1/models" {
				_, _ = fmt.Fprint(w, `{"data":[{"id":"gpt-4o","object":"model"}]}`)
				return
			}
			openaiCalls.Add(1)
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			if _, hasReasoning := body["reasoning_effort"]; hasReasoning {
				t.Errorf("modelo não-reasoning não deve enviar reasoning_effort")
			}
			_, _ = fmt.Fprint(w, `{"id":"chatcmpl-1","choices":[{"message":{"role":"assistant","content":"OpenAI ok"},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5}}`)
		}),
		"generativelanguage.googleapis.com": http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			if r.Method == http.MethodGet {
				_, _ = fmt.Fprint(w, `{"models":[{"name":"models/gemini-2.5-flash","displayName":"Gemini 2.5 Flash","supportedGenerationMethods":["generateContent"]}]}`)
				return
			}
			googleCalls.Add(1)
			_, _ = fmt.Fprint(w, `{"candidates":[{"content":{"role":"model","parts":[{"text":"Google na thread!"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":9,"candidatesTokenCount":4,"totalTokenCount":13}}`)
		}),
	}

	fx := setupBYOKRuntime(t, routes)
	ctx := context.Background()
	if _, err := fx.svc.Connect(ctx, fx.userID, domain.ProviderKeyOpenAI, "sk-proj-testopenai1234567890", ""); err != nil {
		t.Fatalf("Connect openai: %v", err)
	}
	if _, err := fx.svc.Connect(ctx, fx.userID, domain.ProviderKeyGoogle, "AIzaSyTestGoogleKey1234567890", ""); err != nil {
		t.Fatalf("Connect google: %v", err)
	}

	now := time.Now().UTC()
	if err := fx.triggerRepo.Create(&domain.Trigger{
		ID: "bot-1", UserID: fx.userID, Title: "Bot Finance", Category: domain.CategoryFinance,
		Query: "check", ConditionType: domain.ConditionChangeDetected, Status: domain.TriggerStatusActive,
		Frequency: domain.FrequencyDailyMorning, CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		t.Fatalf("triggerRepo.Create: %v", err)
	}
	if err := fx.svc.UpdateTriggerModelPref(ctx, fx.userID, "bot-1", "openai:gpt-4o", domain.EffortHigh); err != nil {
		t.Fatalf("UpdateTriggerModelPref: %v", err)
	}
	th, _ := fx.convRepo.GetOrCreateThread(ctx, fx.userID, "app_mobile", "th-override-1")
	_ = fx.svc.UpdateThreadModelPref(ctx, fx.userID, th.ID, "google:gemini-2.5-flash", domain.EffortLow)

	// Thread override (google) ganha do Bot (openai)
	resp, err := fx.facade.Run(ctx, domain.UnifiedAssistantRequest{
		UserID:   fx.userID,
		ThreadID: th.ID,
		BotID:    "bot-1",
		Channel:  "app_mobile",
		Message:  "Teste precedência",
	})
	if err != nil {
		t.Fatalf("Run thread override: %v", err)
	}
	if googleCalls.Load() != 1 || openaiCalls.Load() != 0 {
		t.Fatalf("AI-06 thread deveria vencer bot: google=%d openai=%d", googleCalls.Load(), openaiCalls.Load())
	}
	if !strings.Contains(resp.Text, "Google na thread!") {
		t.Fatalf("resposta inesperada: %q", resp.Text)
	}

	// Em outra thread sem override, bot (openai non-reasoning) roda sem enviar reasoning_effort
	thBot, _ := fx.convRepo.GetOrCreateThread(ctx, fx.userID, "app_mobile", "th-fresh-bot-only")
	respBot, err := fx.facade.Run(ctx, domain.UnifiedAssistantRequest{
		UserID:   fx.userID,
		ThreadID: thBot.ID,
		BotID:    "bot-1",
		Channel:  "app_mobile",
		Message:  "Teste bot",
	})
	if err != nil || openaiCalls.Load() != 1 {
		t.Fatalf("esperava bot openai rodar: err=%v calls=%d", err, openaiCalls.Load())
	}
	_ = respBot
}

func TestBYOKRuntime_AI08_401InvalidatesAnd429RetryAnd404InheritAndAI11Quota(t *testing.T) {
	var openaiCalls atomic.Int32
	var antCalls atomic.Int32
	mode := "401"

	routes := map[string]http.Handler{
		"api.anthropic.com": http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			if r.Method == http.MethodGet {
				_, _ = fmt.Fprint(w, `{"data":[{"id":"claude-sonnet-4-20250514","display_name":"Claude Sonnet 4"}]}`)
				return
			}
			antCalls.Add(1)
			switch mode {
			case "401":
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = io.WriteString(w, `{"error":{"message":"invalid x-api-key sk-ant-secret"}}`)
			case "404":
				w.WriteHeader(http.StatusNotFound)
				_, _ = io.WriteString(w, `{"error":{"message":"model not found"}}`)
			}
		}),
		"api.openai.com": http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			if r.Method == http.MethodGet {
				_, _ = fmt.Fprint(w, `{"data":[{"id":"gpt-4o","object":"model"}]}`)
				return
			}
			openaiCalls.Add(1)
			if mode == "429" {
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = io.WriteString(w, `{"error":{"message":"rate limit"}}`)
				return
			}
			_, _ = fmt.Fprint(w, `{"id":"chatcmpl-fb","choices":[{"message":{"role":"assistant","content":"OpenAI fallback padrão"},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":5}}`)
		}),
	}

	fx := setupBYOKRuntime(t, routes)
	ctx := context.Background()
	_, _ = fx.svc.Connect(ctx, fx.userID, domain.ProviderKeyAnthropic, "sk-ant-api03-failkey123456789", "")
	_, _ = fx.svc.Connect(ctx, fx.userID, domain.ProviderKeyOpenAI, "sk-proj-backupopenai123456789", "")
	_, _ = fx.svc.UpdatePreferences(ctx, fx.userID, "anthropic:claude-sonnet-4-20250514", domain.EffortAuto)

	// 1. AI-08: 401 marca invalid, cai pro servidor e retorna FallbackNotice
	resp401, err := fx.facade.Run(ctx, domain.UnifiedAssistantRequest{UserID: fx.userID, Channel: "app_mobile", Message: "oi"})
	if err != nil {
		t.Fatalf("Run 401 fallback: %v", err)
	}
	if resp401.FallbackNotice == "" || fx.serverProv.calls.Load() != 1 {
		t.Fatalf("AI-08 esperava fallback_notice e servidor=1; notice=%q srv=%d", resp401.FallbackNotice, fx.serverProv.calls.Load())
	}
	prov, _ := fx.providerRepo.GetByUserAndKey(ctx, fx.userID, domain.ProviderKeyAnthropic)
	if prov == nil || prov.Status != domain.ProviderStatusInvalid {
		t.Fatalf("AI-08 status deveria ser invalid, obteve %+v", prov)
	}

	// 2. 429 em OpenAI tenta 1 retry (total 2 chamadas) e cai para servidor com FallbackReason="byok_429"
	mode = "429"
	_, _ = fx.svc.UpdatePreferences(ctx, fx.userID, "openai:gpt-4o", domain.EffortAuto)
	if _, err := fx.facade.Run(ctx, domain.UnifiedAssistantRequest{UserID: fx.userID, Channel: "app_mobile", Message: "oi 429"}); err != nil {
		t.Fatalf("Run 429 fallback: %v", err)
	}
	if openaiCalls.Load() != 2 {
		t.Fatalf("esperava 2 chamadas OpenAI (1 + 1 retry) antes do fallback, obteve %d", openaiCalls.Load())
	}

	// 3. 404 na thread herda preferência padrão (OpenAI ok!) com 1 notice
	mode = "404"
	_ = fx.providerRepo.UpdateStatus(ctx, fx.userID, domain.ProviderKeyAnthropic, domain.ProviderStatusOK)
	th, _ := fx.convRepo.GetOrCreateThread(ctx, fx.userID, "app_mobile", "th-404")
	_ = fx.svc.UpdateThreadModelPref(ctx, fx.userID, th.ID, "anthropic:claude-sonnet-4-20250514", domain.EffortAuto)
	openaiCalls.Store(0)
	resp404, err := fx.facade.Run(ctx, domain.UnifiedAssistantRequest{UserID: fx.userID, ThreadID: th.ID, Channel: "app_mobile", Message: "oi 404"})
	if err != nil {
		t.Fatalf("Run 404 inherit: %v", err)
	}
	if openaiCalls.Load() != 1 || resp404.FallbackNotice == "" {
		t.Fatalf("404 deveria herdar OpenAI padrão e emitir 1 notice; openai=%d notice=%q", openaiCalls.Load(), resp404.FallbackNotice)
	}

	// 4. AI-11: 100 turnos BYOK não alteram cota do servidor
	rec := ai.NewRingBufferTraceRecorder(fx.db, 500, time.Hour)
	defer rec.Close()
	for i := 0; i < 100; i++ {
		rec.RecordAsync(ai.AITrace{UserID: fx.userID, CredentialSource: "byok", ProviderKey: "anthropic", TokensIn: 500, TokensOut: 200})
	}
	turns, inTok, outTok := rec.ServerQuotaStats()
	if turns != 0 || inTok != 0 || outTok != 0 {
		t.Fatalf("AI-11 cota do servidor alterada por BYOK: (%d,%d,%d)", turns, inTok, outTok)
	}
	rec.RecordAsync(ai.AITrace{UserID: fx.userID, CredentialSource: "server", TokensIn: 11, TokensOut: 7})
	turns, inTok, outTok = rec.ServerQuotaStats()
	if turns != 1 || inTok != 11 || outTok != 7 {
		t.Fatalf("AI-11 turno servidor deveria contar (1,11,7), obteve (%d,%d,%d)", turns, inTok, outTok)
	}
}
