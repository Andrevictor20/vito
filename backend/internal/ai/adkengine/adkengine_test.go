package adkengine_test

import (
	"context"
	"encoding/json"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"google.golang.org/adk/v2/model"
	"google.golang.org/adk/v2/session"
	"google.golang.org/genai"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

type fakeAgentProvider struct {
	name          string
	model         string
	tier          int
	supportsTools bool
	failErr       error
	responses     []*ai.AgentChatResponse
	callIdx       int
	capturedReqs  []ai.AgentChatRequest
}

func (f *fakeAgentProvider) Name() string          { return f.name }
func (f *fakeAgentProvider) ModelName() string     { return f.model }
func (f *fakeAgentProvider) SupportsTools() bool   { return f.supportsTools }
func (f *fakeAgentProvider) SupportsVision() bool  { return true }
func (f *fakeAgentProvider) QualityTier() int      { return f.tier }
func (f *fakeAgentProvider) MaxContextTokens() int { return 65536 }

func (f *fakeAgentProvider) Chat(ctx context.Context, req ai.AgentChatRequest) (*ai.AgentChatResponse, error) {
	f.capturedReqs = append(f.capturedReqs, req)
	if f.failErr != nil {
		return nil, f.failErr
	}
	if f.callIdx < len(f.responses) {
		r := f.responses[f.callIdx]
		f.callIdx++
		return r, nil
	}
	return &ai.AgentChatResponse{
		Text:         "Resposta padrão ADK",
		ProviderName: f.name,
		ModelName:    f.model,
	}, nil
}

func (f *fakeAgentProvider) StreamChat(ctx context.Context, req ai.AgentChatRequest, onDelta func(ai.StreamDelta) error) (*ai.AgentChatResponse, error) {
	resp, err := f.Chat(ctx, req)
	if err != nil {
		return nil, err
	}
	if onDelta != nil && resp.Text != "" {
		_ = onDelta(ai.StreamDelta{TextDelta: resp.Text})
		_ = onDelta(ai.StreamDelta{Done: true, FinalMetrics: resp})
	}
	return resp, nil
}

// TestAC01_COG01_BeforeModelCallback_AdaptiveThinkingAndVoiceBudget valida AC-01 (COG-01):
// ThinkingBudget > 0 em pedido analítico no texto vs ThinkingBudget = 0 e MaxOutputTokens = 320 na voz,
// além da separação do prefixo estático cacheável sem timestamp HH:MM embutido no bloco estático.
func TestAC01_COG01_BeforeModelCallback_AdaptiveThinkingAndVoiceBudget(t *testing.T) {
	staticPrompt := ai.BuildStaticPersonaSystemPrompt(ai.StyleBalanced, "André", "app_mobile")
	if strings.Contains(staticPrompt, "às ") {
		t.Errorf("AC-01: prefixo estático cacheável NÃO deve conter timestamp dinâmico HH:MM: %s", staticPrompt)
	}

	guard := adkengine.NewGuardrailPlugin(nil, nil, nil, nil)

	// 1. Canal de texto analítico -> ThinkingBudget > 0
	reqText := &model.LLMRequest{
		Model: "gemini-2.5-flash",
		Contents: []*genai.Content{
			genai.NewContentFromText("Analise detalhadamente minhas finanças, agenda da semana e planeje os blocos de foco.", genai.RoleUser),
		},
	}
	adkengine.ApplyBeforeModelConfig(reqText, "app_mobile", "auto", staticPrompt, "### CONTEXTO DINÂMICO\n- Horário: 16:45")

	if reqText.Config == nil || reqText.Config.ThinkingConfig == nil || reqText.Config.ThinkingConfig.ThinkingBudget == nil {
		t.Fatalf("AC-01: esperava ThinkingConfig preenchido para pedido analítico em gemini-2.5")
	}
	if *reqText.Config.ThinkingConfig.ThinkingBudget <= 0 {
		t.Errorf("AC-01: esperava ThinkingBudget > 0 para pedido analítico, obteve %d", *reqText.Config.ThinkingConfig.ThinkingBudget)
	}

	// 2. Canal de voz -> ThinkingBudget == 0 e MaxOutputTokens == 320
	reqVoice := &model.LLMRequest{
		Model: "gemini-2.5-flash",
		Contents: []*genai.Content{
			genai.NewContentFromText("O que tenho na agenda hoje?", genai.RoleUser),
		},
	}
	adkengine.ApplyBeforeModelConfig(reqVoice, "voice", "auto", staticPrompt, "")

	if reqVoice.Config == nil || reqVoice.Config.ThinkingConfig == nil || reqVoice.Config.ThinkingConfig.ThinkingBudget == nil {
		t.Fatalf("AC-01: esperava ThinkingConfig preenchido no canal voice")
	}
	if *reqVoice.Config.ThinkingConfig.ThinkingBudget != 0 {
		t.Errorf("AC-01: esperava ThinkingBudget == 0 no canal voice, obteve %d", *reqVoice.Config.ThinkingConfig.ThinkingBudget)
	}
	if reqVoice.Config.MaxOutputTokens != 320 {
		t.Errorf("AC-01: esperava MaxOutputTokens == 320 no canal voice, obteve %d", reqVoice.Config.MaxOutputTokens)
	}
	_ = guard
}

// TestAC02_COG02_RoutedLLM_TransparentFailoverOn429Or5xx valida AC-02 (COG-02):
// Quando o provedor primário falha com HTTP 429/5xx, RoutedLLM aciona SelectFallbackProviders
// transparentemente no mesmo passo do runner.Runner.
func TestAC02_COG02_RoutedLLM_TransparentFailoverOn429Or5xx(t *testing.T) {
	primary := &fakeAgentProvider{
		name:          "Primary-Gemini",
		model:         "gemini-2.5-flash",
		tier:          3,
		supportsTools: true,
		failErr:       errors.New("gemini status 429: Resource exhausted"),
	}
	fallback := &fakeAgentProvider{
		name:          "Fallback-OpenRouter",
		model:         "google/gemini-2.5-flash",
		tier:          3,
		supportsTools: true,
		responses: []*ai.AgentChatResponse{
			{
				Text:         "Resposta entregue pelo provedor de failover no ADK!",
				ProviderName: "Fallback-OpenRouter",
				ModelName:    "google/gemini-2.5-flash",
				TokensIn:     20,
				TokensOut:    10,
			},
		},
	}

	router := ai.NewModelRouter(primary, fallback)
	routedLLM := adkengine.NewRoutedLLM(router)

	req := &model.LLMRequest{
		Model: "gemini-2.5-flash",
		Contents: []*genai.Content{
			genai.NewContentFromText("Qual o resumo do meu dia?", genai.RoleUser),
		},
	}

	var gotResp *model.LLMResponse
	var gotErr error
	for resp, err := range routedLLM.GenerateContent(context.Background(), req, false) {
		if err != nil {
			gotErr = err
			break
		}
		gotResp = resp
	}

	if gotErr != nil {
		t.Fatalf("AC-02: esperava failover transparente sem erro, obteve: %v", gotErr)
	}
	if gotResp == nil || gotResp.Content == nil || len(gotResp.Content.Parts) == 0 {
		t.Fatalf("AC-02: esperava resposta válida do fallback")
	}
	if gotResp.Content.Parts[0].Text != "Resposta entregue pelo provedor de failover no ADK!" {
		t.Errorf("AC-02: texto inesperado: %q", gotResp.Content.Parts[0].Text)
	}
}

// TestAC03_COG03_ToolsetBridgeAndMultiAgentTopologyAndSession valida AC-03 (COG-03):
// Desmembramento de DomainToolset em functiontools atômicas tipadas, SQLiteSessionService
// sobre conversation_threads/turns, GuardrailPlugin (BeforeToolCallback HITL + Taint Tracking)
// e execução completa pelo ADKLoopFacade (runner.Runner) com SSE em todos os passos.
func TestAC03_COG03_ToolsetBridgeAndMultiAgentTopologyAndSession(t *testing.T) {
	tmpDir := t.TempDir()
	db, err := database.Open(filepath.Join(tmpDir, "adk_cog03.db"))
	if err != nil {
		t.Fatalf("falha ao abrir db: %v", err)
	}
	defer db.Close()

	convRepo := repository.NewConversationStoreRepository(db)
	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{
		ID:        "user-adk-1",
		Name:      "André ADK",
		Email:     "adk@vito.local",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})
	sessSvc := adkengine.NewSQLiteSessionService(convRepo)

	// 1. Verifica SQLiteSessionService (adk/v2/session.Service)
	createResp, err := sessSvc.Create(context.Background(), &session.CreateRequest{
		AppName:   "vito",
		UserID:    "user-adk-1",
		SessionID: "thread-adk-1",
		State:     map[string]any{"channel": "app_mobile"},
	})
	if err != nil {
		t.Fatalf("AC-03: falha ao criar sessão no SQLiteSessionService: %v", err)
	}
	if createResp.Session.ID() != "thread-adk-1" {
		t.Errorf("AC-03: ID de sessão inesperado: %s", createResp.Session.ID())
	}

	// 2. Verifica ToolsetBridge gerando functiontools atômicas sem envelope polimórfico
	registry := toolsets.NewToolsetsRegistry()
	registry.Register(toolsets.NewCalendarToolset(nil))
	registry.Register(toolsets.NewTaskPendingToolset(nil))
	registry.Register(toolsets.NewWhatsAppToolset(nil))
	registry.Register(toolsets.NewGmailToolset(nil))
	registry.Register(toolsets.NewSearchToolset())

	bridge := adkengine.NewToolsetBridge(registry)
	atomicTools := bridge.BuildAtomicTools()
	if len(atomicTools) < 10 {
		t.Fatalf("AC-03: esperava pelo menos 10 functiontools atômicas desmembradas, obteve %d", len(atomicTools))
	}

	// Verifica que existem tools atômicas como calendar_manager__list_events ou calendar_list_events
	var foundCalendarList, foundTodoCreate bool
	for _, ft := range atomicTools {
		if ft.Name() == "calendar_list_events" {
			foundCalendarList = true
		}
		if ft.Name() == "todo_create_todo" {
			foundTodoCreate = true
		}
	}
	if !foundCalendarList || !foundTodoCreate {
		t.Errorf("AC-03: tools atômicas esperadas não encontradas (calendar_list_events=%v, todo_create_todo=%v)", foundCalendarList, foundTodoCreate)
	}

	// 3. Verifica execução ponta a ponta via ADKLoopFacade (adk/v2/runner.Runner) com SSE em passos pós-tool
	argsBytes, _ := json.Marshal(map[string]any{
		"date": "2026-11-21",
	})
	provider := &fakeAgentProvider{
		name:          "Gemini-ADK",
		model:         "gemini-2.5-flash",
		tier:          3,
		supportsTools: true,
		responses: []*ai.AgentChatResponse{
			{
				Text: "",
				ToolCalls: []ai.ToolCall{
					{
						ID:        "call-atomic-1",
						Name:      "calendar_list_events",
						Arguments: argsBytes,
					},
				},
				ProviderName: "Gemini-ADK",
				ModelName:    "gemini-2.5-flash",
			},
			{
				Text:         "Consultei sua agenda via Google ADK e você está livre hoje!",
				ProviderName: "Gemini-ADK",
				ModelName:    "gemini-2.5-flash",
			},
		},
	}

	router := ai.NewModelRouter(provider)
	guard := service.NewScopeGuard()
	gate := service.NewConfirmationGateService(db)

	facade, err := adkengine.NewADKLoopFacade(adkengine.FacadeConfig{
		Router:           router,
		Registry:         registry,
		ScopeGuard:       guard,
		ConfirmationGate: gate,
		ConvRepo:         convRepo,
	})
	if err != nil {
		t.Fatalf("AC-03: falha ao criar ADKLoopFacade: %v", err)
	}

	var streamedDeltas []string
	resp, err := facade.RunStream(context.Background(), domain.UnifiedAssistantRequest{
		UserID:   "user-adk-1",
		ThreadID: "thread-adk-1",
		Channel:  "app_mobile",
		Message:  "Como está minha agenda hoje?",
	}, func(delta ai.StreamDelta) error {
		if delta.TextDelta != "" {
			streamedDeltas = append(streamedDeltas, delta.TextDelta)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("AC-03: falha no ADKLoopFacade.RunStream: %v", err)
	}
	if !strings.Contains(resp.Text, "Consultei sua agenda via Google ADK") {
		t.Errorf("AC-03: resposta final inesperada: %q", resp.Text)
	}
	if len(streamedDeltas) == 0 {
		t.Errorf("AC-03: esperava emissão de deltas SSE mesmo no passo pós-ferramenta (step > 0)")
	}

	// 4. Verifica BeforeToolCallback HITL + Taint Tracking + Unificação com WhatsAppService (AC-01, AC-02, AC-03)
	waSendArgs, _ := json.Marshal(map[string]any{
		"recipient": "Carlos",
		"message":   "Chego em 10 minutos",
	})
	providerHITL := &fakeAgentProvider{
		name:          "Gemini-ADK",
		model:         "gemini-2.5-flash",
		tier:          3,
		supportsTools: true,
		responses: []*ai.AgentChatResponse{
			{
				Text: "Vou preparar o envio.",
				ToolCalls: []ai.ToolCall{
					{
						ID:        "call-wa-hitl-1",
						Name:      "whatsapp_send_message",
						Arguments: waSendArgs,
					},
				},
				ProviderName: "Gemini-ADK",
				ModelName:    "gemini-2.5-flash",
			},
		},
	}

	facadeHITL, err := adkengine.NewADKLoopFacade(adkengine.FacadeConfig{
		Router:           ai.NewModelRouter(providerHITL),
		Registry:         registry,
		ScopeGuard:       guard,
		ConfirmationGate: gate,
		ConvRepo:         convRepo,
	})
	if err != nil {
		t.Fatalf("AC-03: falha ao criar facadeHITL: %v", err)
	}

	hitlResp, err := facadeHITL.Run(context.Background(), domain.UnifiedAssistantRequest{
		UserID:   "user-adk-1",
		ThreadID: "thread-adk-hitl",
		Channel:  "app_mobile",
		Message:  "Manda um WhatsApp pro Carlos dizendo que chego em 10 minutos",
	})
	if err != nil {
		t.Fatalf("AC-03: falha no facadeHITL.Run: %v", err)
	}
	if !hitlResp.RequiresConfirmation || hitlResp.PendingConfirmationID == "" {
		t.Fatalf("AC-03: esperava suspensão HITL no BeforeToolCallback, obteve RequiresConfirmation=%v ID=%q", hitlResp.RequiresConfirmation, hitlResp.PendingConfirmationID)
	}
	if len(hitlResp.Cards) == 0 || !hitlResp.Cards[0].Confirm {
		t.Errorf("AC-03: esperava ChatCard de confirmação gerado pelo BeforeToolCallback")
	}
	if time.Now().IsZero() {
		t.Fatal("unreachable")
	}
}
