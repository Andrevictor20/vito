package service_test

import (
	"context"
	"errors"
	"fmt"
	"github.com/andrevmp/vito/backend/internal/bots"
	"iter"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"google.golang.org/adk/v2/model"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

type stubLLM struct{ name string }

func (s *stubLLM) Name() string { return s.name }
func (s *stubLLM) GenerateContent(_ context.Context, _ *model.LLMRequest, _ bool) iter.Seq2[*model.LLMResponse, error] {
	return func(yield func(*model.LLMResponse, error) bool) {}
}

type stubFactory struct{ builds atomic.Int32 }

func (f *stubFactory) BuildLLM(_ context.Context, spec service.LLMBuildSpec) (model.LLM, error) {
	f.builds.Add(1)
	return &stubLLM{name: string(spec.ProviderKey) + ":" + spec.ModelID}, nil
}

type svcRT func(*http.Request) (*http.Response, error)

func (f svcRT) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

type svcTestFixture struct {
	userID       string
	providerRepo *repository.AIProviderRepositorySQLite
	settingsRepo *repository.AISettingsRepositorySQLite
	convRepo     *repository.ConversationStoreRepository
	triggerRepo  *bots.TriggerRepositorySQLite
	vault        *service.AIKeyVault
	factory      *stubFactory
	registry     *service.UserProviderRegistry
	resolver     *service.ModelResolver
	svc          *service.AIProviderService
	fetchCalls   *atomic.Int32
	verifyStatus *atomic.Int32
}

func setupAIServiceTest(t *testing.T) *svcTestFixture {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "ai_svc.db"))
	if err != nil {
		t.Fatalf("database.Open: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	userID := "u-ai-svc-1"
	now := time.Now().UTC()
	_ = userRepo.Create(&domain.User{ID: userID, Name: "Svc User", Email: "aisvc@vito.test", CreatedAt: now, UpdatedAt: now})

	providerRepo := repository.NewAIProviderRepository(db)
	settingsRepo := repository.NewAISettingsRepository(db)
	convRepo := repository.NewConversationStoreRepository(db)
	triggerRepo := bots.NewTriggerRepository(db)
	vault := service.NewAIKeyVault("0123456789abcdef0123456789abcdef")
	factory := &stubFactory{}
	registry := service.NewUserProviderRegistry(vault, factory, providerRepo, 0)
	resolver := service.NewModelResolver(providerRepo, settingsRepo, convRepo, triggerRepo, registry)
	svc := service.NewAIProviderService(providerRepo, settingsRepo, convRepo, triggerRepo, vault, registry, 0)

	var fetchCalls atomic.Int32
	var verifyStatus atomic.Int32
	verifyStatus.Store(http.StatusOK)

	svc.SetVerifyHTTPClientForTest(&http.Client{
		Transport: svcRT(func(r *http.Request) (*http.Response, error) {
			fetchCalls.Add(1)
			rec := httptest.NewRecorder()
			rec.Header().Set("Content-Type", "application/json")
			code := int(verifyStatus.Load())
			rec.WriteHeader(code)
			if code != http.StatusOK {
				_, _ = fmt.Fprint(rec, `{"error":"rejected"}`)
				return rec.Result(), nil
			}
			switch r.URL.Host {
			case "api.anthropic.com":
				_, _ = fmt.Fprint(rec, `{"data":[{"id":"claude-sonnet-4-20250514","display_name":"Claude Sonnet 4"}]}`)
			case "api.openai.com":
				_, _ = fmt.Fprint(rec, `{"data":[{"id":"gpt-4o","object":"model"},{"id":"o3-mini","object":"model"}]}`)
			default:
				_, _ = fmt.Fprint(rec, `{"data":[{"id":"llama-3.3-70b-versatile","object":"model"}]}`)
			}
			return rec.Result(), nil
		}),
	})

	return &svcTestFixture{
		userID:       userID,
		providerRepo: providerRepo,
		settingsRepo: settingsRepo,
		convRepo:     convRepo,
		triggerRepo:  triggerRepo,
		vault:        vault,
		factory:      factory,
		registry:     registry,
		resolver:     resolver,
		svc:          svc,
		fetchCalls:   &fetchCalls,
		verifyStatus: &verifyStatus,
	}
}

func TestAIProviderService_ConnectAuthRejected_AI03_AndRateLimit(t *testing.T) {
	fx := setupAIServiceTest(t)
	ctx := context.Background()
	fx.verifyStatus.Store(http.StatusUnauthorized)

	_, err := fx.svc.Connect(ctx, fx.userID, domain.ProviderKeyAnthropic, "sk-ant-invalid-1234567890", "")
	if !errors.Is(err, service.ErrProviderAuthRejected) || !strings.Contains(err.Error(), "O Claude recusou esta chave. Confira se ela está ativa.") {
		t.Fatalf("AI-03 erro inesperado: %v", err)
	}
	if _, getErr := fx.providerRepo.GetByUserAndKey(ctx, fx.userID, domain.ProviderKeyAnthropic); !errors.Is(getErr, domain.ErrAIProviderNotFound) {
		t.Fatalf("AI-03 chave rejeitada não deveria ser salva no banco, obteve err=%v", getErr)
	}

	// Mais 4 tentativas consomem cota (total 5), 6ª retorna ErrAIProviderRateLimited
	for i := 0; i < 4; i++ {
		_, _ = fx.svc.Connect(ctx, fx.userID, domain.ProviderKeyAnthropic, "sk-ant-invalid-1234567890", "")
	}
	_, err6 := fx.svc.Connect(ctx, fx.userID, domain.ProviderKeyAnthropic, "sk-ant-invalid-1234567890", "")
	if !errors.Is(err6, service.ErrAIProviderRateLimited) {
		t.Fatalf("esperava ErrAIProviderRateLimited na 6ª tentativa, obteve %v", err6)
	}
}

func TestAIProviderService_Models24hRefreshAndRemoveClearsPrefs_AI07(t *testing.T) {
	fx := setupAIServiceTest(t)
	ctx := context.Background()

	summary, err := fx.svc.Connect(ctx, fx.userID, domain.ProviderKeyAnthropic, "sk-ant-valid-key-1234567890", "")
	if err != nil {
		t.Fatalf("Connect: %v", err)
	}
	if summary.KeyLast4 != "7890" || !summary.Connected {
		t.Fatalf("summary inesperado: %+v", summary)
	}

	// Dentro de 24h usa cache
	callsBefore := fx.fetchCalls.Load()
	if _, err := fx.svc.GetProviderModels(ctx, fx.userID, domain.ProviderKeyAnthropic, false); err != nil {
		t.Fatalf("GetProviderModels cache: %v", err)
	}
	if fx.fetchCalls.Load() != callsBefore {
		t.Fatalf("não deveria refazer fetch dentro de 24h")
	}

	// Backdate >24h dispara refresh automático
	prov, _ := fx.providerRepo.GetByUserAndKey(ctx, fx.userID, domain.ProviderKeyAnthropic)
	stale := time.Now().UTC().Add(-25 * time.Hour)
	prov.ModelsFetchedAt = &stale
	_ = fx.providerRepo.Upsert(ctx, prov)
	if _, err := fx.svc.GetProviderModels(ctx, fx.userID, domain.ProviderKeyAnthropic, false); err != nil {
		t.Fatalf("GetProviderModels stale: %v", err)
	}
	if fx.fetchCalls.Load() != callsBefore+1 {
		t.Fatalf("esperava refresh automático após >24h")
	}

	// Configura preferências em todos os níveis e remove provedor (AI-07)
	_, _ = fx.svc.UpdatePreferences(ctx, fx.userID, "anthropic:claude-sonnet-4-20250514", domain.EffortHigh)
	th, _ := fx.convRepo.GetOrCreateThread(ctx, fx.userID, "app_mobile", "th-svc-1")
	_ = fx.svc.UpdateThreadModelPref(ctx, fx.userID, th.ID, "anthropic:claude-sonnet-4-20250514", domain.EffortLow)
	now := time.Now().UTC()
	_ = fx.triggerRepo.Create(&domain.Trigger{
		ID: "bot-svc-1", UserID: fx.userID, Title: "Bot", Category: domain.CategoryCustom, Query: "q",
		ConditionType: domain.ConditionChangeDetected, Status: domain.TriggerStatusActive,
		Frequency: domain.FrequencyDailyMorning, CreatedAt: now, UpdatedAt: now,
	})
	_ = fx.svc.UpdateTriggerModelPref(ctx, fx.userID, "bot-svc-1", "anthropic:claude-sonnet-4-20250514", domain.EffortMed)

	if err := fx.svc.Remove(ctx, fx.userID, domain.ProviderKeyAnthropic); err != nil {
		t.Fatalf("Remove: %v", err)
	}
	prefs, _ := fx.svc.GetPreferences(ctx, fx.userID)
	thAfter, _ := fx.convRepo.GetThreadByID(ctx, th.ID)
	botAfter, _ := fx.triggerRepo.GetByID("bot-svc-1", fx.userID)
	if prefs.DefaultModel != "" || thAfter.ModelPref != "" || botAfter.ModelPref != "" {
		t.Fatalf("AI-07 Remove deveria limpar prefs: default=%q thread=%q bot=%q", prefs.DefaultModel, thAfter.ModelPref, botAfter.ModelPref)
	}
}

func TestUserProviderRegistry_LRUEvictionAndTTL(t *testing.T) {
	fx := setupAIServiceTest(t)
	ctx := context.Background()
	_, _ = fx.svc.Connect(ctx, fx.userID, domain.ProviderKeyOpenAI, "sk-proj-registry-key-1234567890", "")
	prov, _ := fx.providerRepo.GetByUserAndKey(ctx, fx.userID, domain.ProviderKeyOpenAI)

	// 33 modelos distintos devem evictar o 1º do LRU (capacidade 32)
	for i := 0; i < 33; i++ {
		_, err := fx.registry.GetOrCreate(ctx, fx.userID, prov, domain.ProviderModelInfo{ID: fmt.Sprintf("m-%02d", i), SupportsTools: true})
		if err != nil {
			t.Fatalf("GetOrCreate %d: %v", i, err)
		}
	}
	buildsBefore := fx.factory.builds.Load()
	// m-01 ainda está em cache (não rebuilda); m-00 foi evictado (rebuilda)
	_, _ = fx.registry.GetOrCreate(ctx, fx.userID, prov, domain.ProviderModelInfo{ID: "m-01", SupportsTools: true})
	if fx.factory.builds.Load() != buildsBefore {
		t.Fatalf("m-01 deveria estar em cache LRU")
	}
	_, _ = fx.registry.GetOrCreate(ctx, fx.userID, prov, domain.ProviderModelInfo{ID: "m-00", SupportsTools: true})
	if fx.factory.builds.Load() != buildsBefore+1 {
		t.Fatalf("m-00 deveria ter sido evictado no LRU de 32 itens")
	}

	// TTL expirado força reconstrução
	fx.registry.SetTTLForTest(time.Nanosecond)
	time.Sleep(2 * time.Millisecond)
	buildsBefore = fx.factory.builds.Load()
	_, _ = fx.registry.GetOrCreate(ctx, fx.userID, prov, domain.ProviderModelInfo{ID: "m-01", SupportsTools: true})
	if fx.factory.builds.Load() != buildsBefore+1 {
		t.Fatalf("TTL expirado deveria reconstruir instância")
	}
}

func TestModelResolver_PrecedenceVoiceAndSafetyFloor(t *testing.T) {
	fx := setupAIServiceTest(t)
	ctx := context.Background()
	_, _ = fx.svc.Connect(ctx, fx.userID, domain.ProviderKeyOpenAI, "sk-proj-resolver-key-1234567890", "")
	_, _ = fx.svc.Connect(ctx, fx.userID, domain.ProviderKeyAnthropic, "sk-ant-resolver-key-1234567890", "")

	// Marca o3-mini sem tools e adiciona modelo Tier 1 para testar safety floor
	provOpenAI, _ := fx.providerRepo.GetByUserAndKey(ctx, fx.userID, domain.ProviderKeyOpenAI)
	provOpenAI.Models = []domain.ProviderModelInfo{
		{ID: "gpt-4o", Name: "GPT-4o", SupportsTools: true, QualityTier: 3},
		{ID: "tiny-tier1", Name: "Tiny", SupportsTools: true, QualityTier: 1},
		{ID: "no-tools", Name: "NoTools", SupportsTools: false, QualityTier: 3},
	}
	_ = fx.providerRepo.Upsert(ctx, provOpenAI)

	_, _ = fx.svc.UpdatePreferences(ctx, fx.userID, "anthropic:claude-sonnet-4-20250514", domain.EffortLow)
	now := time.Now().UTC()
	_ = fx.triggerRepo.Create(&domain.Trigger{
		ID: "bot-res-1", UserID: fx.userID, Title: "Bot", Category: domain.CategoryCustom, Query: "q",
		ConditionType: domain.ConditionChangeDetected, Status: domain.TriggerStatusActive,
		Frequency: domain.FrequencyDailyMorning, CreatedAt: now, UpdatedAt: now,
	})
	_ = fx.svc.UpdateTriggerModelPref(ctx, fx.userID, "bot-res-1", "openai:gpt-4o", domain.EffortHigh)
	th, _ := fx.convRepo.GetOrCreateThread(ctx, fx.userID, "app_mobile", "th-res-1")
	_ = fx.svc.UpdateThreadModelPref(ctx, fx.userID, th.ID, "openai:tiny-tier1", domain.EffortMed)

	// 1. Voice sempre fica em srv:auto
	resVoice, err := fx.resolver.Resolve(ctx, service.ModelResolveRequest{UserID: fx.userID, ThreadID: th.ID, BotID: "bot-res-1", Channel: "voice", RequireTools: true})
	if err != nil || resVoice.Source != "server" {
		t.Fatalf("canal voice deveria permanecer em server, obteve err=%v res=%+v", err, resVoice)
	}

	// 2. Thread com tiny-tier1 é pulado pelo safety floor quando RequireTools=true, caindo para bot (gpt-4o)
	resFloor, err := fx.resolver.Resolve(ctx, service.ModelResolveRequest{UserID: fx.userID, ThreadID: th.ID, BotID: "bot-res-1", Channel: "app_mobile", RequireTools: true})
	if err != nil || resFloor.ModelID != "gpt-4o" || resFloor.UsedLevel != "bot" {
		t.Fatalf("safety floor deveria pular Tier 1 e herdar bot gpt-4o, obteve err=%v res=%+v", err, resFloor)
	}
}
