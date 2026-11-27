package adkengine_test

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/andrevmp/vito/backend/internal/calendar"
	"github.com/andrevmp/vito/backend/internal/tasks"
	"github.com/andrevmp/vito/backend/internal/whatsapp"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"google.golang.org/adk/v2/model"
	"google.golang.org/adk/v2/session"
	"google.golang.org/genai"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/gmail"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

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
// Quando o provedor primário do ServerPool falha com HTTP 429/5xx, RoutedLLM faz failover
// transparentemente para o próximo provedor no mesmo passo do runner.Runner.
func TestAC02_COG02_RoutedLLM_TransparentFailoverOn429Or5xx(t *testing.T) {
	primary := &fakeADKLLM{
		model:   "gemini-2.5-flash",
		failErr: errors.New("gemini status 429: Resource exhausted"),
	}
	fallback := &fakeADKLLM{
		model: "google/gemini-2.5-flash",
		responses: []scriptedModelResponse{
			{
				Text:      "Resposta entregue pelo provedor de failover no ADK!",
				TokensIn:  20,
				TokensOut: 10,
			},
		},
	}

	routedLLM := adkengine.NewRoutedLLM(
		adkengine.ServerPoolEntry{ProviderKey: "gemini", DisplayName: "Primary-Gemini", ModelID: "gemini-2.5-flash", Tier: 3, LLM: primary},
		adkengine.ServerPoolEntry{ProviderKey: "openrouter", DisplayName: "Fallback-OpenRouter", ModelID: "google/gemini-2.5-flash", Tier: 3, LLM: fallback},
	)

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
	registry.Register(calendar.NewCalendarToolset(nil))
	registry.Register(tasks.NewTaskPendingToolset(nil))
	registry.Register(whatsapp.NewWhatsAppToolset(nil))
	registry.Register(gmail.NewGmailToolset(nil))
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
	provider := &fakeADKLLM{
		model: "gemini-2.5-flash",
		responses: []scriptedModelResponse{
			{
				ToolCalls: []ai.ToolCall{
					{
						ID:        "call-atomic-1",
						Name:      "calendar_list_events",
						Arguments: argsBytes,
					},
				},
			},
			{
				Text: "Consultei sua agenda via Google ADK e você está livre hoje!",
			},
		},
	}

	guard := service.NewScopeGuard()
	gate := service.NewConfirmationGateService(db)

	facade, err := adkengine.NewADKLoopFacade(adkengine.FacadeConfig{
		ServerPool:       testServerPool("Gemini-ADK", "gemini-2.5-flash", provider),
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
	providerHITL := &fakeADKLLM{
		model: "gemini-2.5-flash",
		responses: []scriptedModelResponse{
			{
				Text: "Vou preparar o envio.",
				ToolCalls: []ai.ToolCall{
					{
						ID:        "call-wa-hitl-1",
						Name:      "whatsapp_send_message",
						Arguments: waSendArgs,
					},
				},
			},
		},
	}

	facadeHITL, err := adkengine.NewADKLoopFacade(adkengine.FacadeConfig{
		ServerPool:       testServerPool("Gemini-ADK", "gemini-2.5-flash", providerHITL),
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

func TestRoutedLLM_ThinkingBudgetAndReasoningDeltaPropagation(t *testing.T) {
	prov := &fakeADKLLM{
		model: "gemini-2.5-flash",
		responses: []scriptedModelResponse{
			{
				Thought:      "Verificando conflitos...",
				ToolCalls:    []ai.ToolCall{{ID: "c1", Name: "calendar_list_events"}},
				Text:         "Agenda livre.",
				StreamChunks: true,
			},
			{
				Text: "Agenda livre na voz.",
			},
		},
	}
	routedLLM := adkengine.NewRoutedLLM(testServerPool("Gemini-ADK", "gemini-2.5-flash", prov)...)

	budget := int32(2048)
	req := &model.LLMRequest{
		Model: "gemini-2.5-flash",
		Config: &genai.GenerateContentConfig{
			ThinkingConfig: &genai.ThinkingConfig{
				IncludeThoughts: true,
				ThinkingBudget:  &budget,
			},
		},
		Contents: []*genai.Content{genai.NewContentFromText("Planeje minha semana", genai.RoleUser)},
	}

	ctx := adkengine.WithTurnExecutionMeta(context.Background(), &adkengine.TurnExecutionMeta{
		UserID:  "u1",
		Channel: "app_mobile",
	})

	var partialResponses []*model.LLMResponse
	for resp, err := range routedLLM.GenerateContent(ctx, req, true) {
		if err != nil {
			t.Fatalf("GenerateContent falhou: %v", err)
		}
		if resp != nil && resp.Partial {
			partialResponses = append(partialResponses, resp)
		}
	}

	if len(prov.capturedReqs) != 1 || prov.capturedReqs[0].Config == nil || prov.capturedReqs[0].Config.ThinkingConfig == nil || *prov.capturedReqs[0].Config.ThinkingConfig.ThinkingBudget != 2048 || !prov.capturedReqs[0].Config.ThinkingConfig.IncludeThoughts {
		t.Fatalf("ThinkingConfig não propagado ao model.LLMRequest: %+v", prov.capturedReqs)
	}
	if len(partialResponses) != 3 {
		t.Fatalf("esperava 3 respostas parciais (thought, tool_call, text), obteve %d", len(partialResponses))
	}
	if !partialResponses[0].Content.Parts[0].Thought || partialResponses[0].Content.Parts[0].Text != "Verificando conflitos..." {
		t.Errorf("Thought partial não propagado: %+v", partialResponses[0])
	}
	if partialResponses[1].Content.Parts[0].FunctionCall == nil || partialResponses[1].Content.Parts[0].FunctionCall.Name != "calendar_list_events" {
		t.Errorf("ToolCall partial não propagado: %+v", partialResponses[1])
	}
	if partialResponses[2].Content.Parts[0].Text != "Agenda livre." {
		t.Errorf("Text partial não propagado: %+v", partialResponses[2])
	}

	// Verifica que ApplyBeforeModelConfig + canal voice força ThinkingBudget=0 mesmo quando req tinha budget positivo
	voiceReq := &model.LLMRequest{
		Model: "gemini-2.5-flash",
		Config: &genai.GenerateContentConfig{
			ThinkingConfig: &genai.ThinkingConfig{
				IncludeThoughts: true,
				ThinkingBudget:  &budget,
			},
		},
		Contents: []*genai.Content{genai.NewContentFromText("Qual minha agenda?", genai.RoleUser)},
	}
	adkengine.ApplyBeforeModelConfig(voiceReq, "voice", "auto", "", "")
	voiceCtx := adkengine.WithTurnExecutionMeta(context.Background(), &adkengine.TurnExecutionMeta{UserID: "u1", Channel: "voice"})
	for _, err := range routedLLM.GenerateContent(voiceCtx, voiceReq, false) {
		if err != nil {
			t.Fatalf("GenerateContent voice falhou: %v", err)
		}
	}
	if len(prov.capturedReqs) != 2 || prov.capturedReqs[1].Config.ThinkingConfig.ThinkingBudget == nil || *prov.capturedReqs[1].Config.ThinkingConfig.ThinkingBudget != 0 {
		t.Errorf("canal voice deve manter ThinkingBudget=0, obteve %+v", prov.capturedReqs[1].Config)
	}
}
