package adkengine_test

import (
	"context"
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"google.golang.org/adk/v2/model"
	"google.golang.org/genai"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	aimemory "github.com/andrevmp/vito/backend/internal/ai/memory"
	"github.com/andrevmp/vito/backend/internal/calendar"
	"github.com/andrevmp/vito/backend/internal/calendar/booking"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

func collectSystemInstructionText(req *model.LLMRequest) string {
	if req == nil || req.Config == nil || req.Config.SystemInstruction == nil {
		return ""
	}
	var sb strings.Builder
	for _, p := range req.Config.SystemInstruction.Parts {
		if p != nil && p.Text != "" {
			if sb.Len() > 0 {
				sb.WriteByte('\n')
			}
			sb.WriteString(p.Text)
		}
	}
	return sb.String()
}

func collectFunctionResponsePayloads(req *model.LLMRequest) string {
	if req == nil {
		return ""
	}
	var sb strings.Builder
	for _, c := range req.Contents {
		if c == nil {
			continue
		}
		for _, p := range c.Parts {
			if p == nil {
				continue
			}
			if p.FunctionResponse != nil {
				raw, _ := json.Marshal(p.FunctionResponse.Response)
				sb.Write(raw)
				sb.WriteByte('\n')
			}
			if p.Text != "" {
				sb.WriteString(p.Text)
				sb.WriteByte('\n')
			}
		}
	}
	return sb.String()
}

func TestADKRetryAndReflect_SelfHealsTransientToolError(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "retry_reflect.db"))
	if err != nil {
		t.Fatalf("falha ao abrir sqlite: %v", err)
	}
	defer db.Close()

	userID := "user-retry-reflect"
	userRepo := repository.NewUserRepository(db)
	if err := userRepo.Create(&domain.User{
		ID:        userID,
		Name:      "André",
		Email:     "retry@vito.local",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}); err != nil {
		t.Fatalf("falha ao criar usuário: %v", err)
	}

	aiSettingsRepo := repository.NewAISettingsRepository(db)
	_ = aiSettingsRepo.UpsertSettings(&domain.AISettings{
		UserID:       userID,
		AutonomyMode: domain.AutonomyModeProactive,
	})

	eventRepo := calendar.NewEventRepository(db)
	bookingSvc := booking.NewBookingService(
		booking.NewBookingRepositorySQLite(db),
		eventRepo,
		userRepo,
		nil,
		nil,
		nil,
		"https://vito.local",
	)
	reg := toolsets.NewToolsetsRegistry()
	reg.Register(booking.NewMeetingBookingToolset(&testAC03BookingSvc{svc: bookingSvc}))

	provider := &fakeADKLLM{
		model: "gemini-2.5-flash",
		responses: []scriptedModelResponse{
			{ToolCalls: []ai.ToolCall{{ID: "tr1", Name: "transfer_to_agent", Arguments: json.RawMessage(`{"agent_name":"vito_routine_agent"}`)}}},
			// 1ª tentativa com tipo inválido ("trinta" em vez de int) gera erro Go no functiontool.New e aciona retryandreflect.
			{ToolCalls: []ai.ToolCall{{ID: "b1", Name: "booking_create_link", Arguments: json.RawMessage(`{"title":"Café Rápido","duration_minutes":"trinta"}`)}}},
			// 2ª tentativa corrigida após reflexão automática do plugin.
			{ToolCalls: []ai.ToolCall{{ID: "b2", Name: "booking_create_link", Arguments: json.RawMessage(`{"title":"Café Rápido","duration_minutes":30}`)}}},
			{Text: "Link de agendamento criado com sucesso após correção!"},
		},
	}

	facade, err := adkengine.NewADKLoopFacade(adkengine.FacadeConfig{
		ServerPool:       testServerPool("Retry-LLM", "gemini-2.5-flash", provider),
		Registry:         reg,
		ScopeGuard:       service.NewScopeGuard(),
		ConfirmationGate: service.NewConfirmationGateService(db),
		ConvRepo:         repository.NewConversationStoreRepository(db),
		UserRepo:         userRepo,
		AISettingsRepo:   aiSettingsRepo,
	})
	if err != nil {
		t.Fatalf("falha ao criar facade: %v", err)
	}

	resp, err := facade.Run(context.Background(), domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: "th-retry-reflect",
		Channel:  "app_mobile",
		Message:  "Crie um link de agendamento Café Rápido de 30 minutos",
	})
	if err != nil {
		t.Fatalf("Run falhou em vez de recuperar via retryandreflect: %v", err)
	}
	if resp.Booking == nil || resp.Booking.Title != "Café Rápido" {
		t.Fatalf("esperava Booking criado após self-healing, obteve %+v", resp.Booking)
	}

	if len(provider.capturedReqs) < 3 {
		t.Fatalf("esperava ao menos 3 chamadas ao modelo com reflexão de erro, obteve %d", len(provider.capturedReqs))
	}
	// A resposta refletida pelo retryandreflect deve aparecer no histórico enviado ao modelo antes do retry.
	lastReqPayloads := collectFunctionResponsePayloads(provider.capturedReqs[len(provider.capturedReqs)-1])
	if !strings.Contains(lastReqPayloads, "Café Rápido") {
		t.Errorf("esperava payload da reflexão/sucesso na conversa do runner, obteve: %s", lastReqPayloads)
	}
}

func TestADKTopology_EnablesLoadMemoryToolWhenMemoryServiceConfigured(t *testing.T) {
	ctx := context.Background()
	db, err := database.Open(filepath.Join(t.TempDir(), "load_memory.db"))
	if err != nil {
		t.Fatalf("falha ao abrir sqlite: %v", err)
	}
	defer db.Close()

	userID := "user-load-mem"
	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{
		ID:        userID,
		Name:      "André",
		Email:     "loadmem@vito.local",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})

	factRepo := repository.NewMemoryRepository(db)
	hierarchyRepo := repository.NewMemoryHierarchyRepository(db)
	fact := &domain.Memory{
		ID:         "mem-pref-horario",
		UserID:     userID,
		Category:   "preference",
		Content:    "Prefere reuniões técnicas sempre às 10h da manhã.",
		Importance: 5,
		Confidence: 0.95,
		CreatedAt:  time.Now().UTC(),
		UpdatedAt:  time.Now().UTC(),
	}
	if err := factRepo.Create(fact); err != nil {
		t.Fatalf("falha ao criar memória: %v", err)
	}
	if vec, err := aimemory.DefaultSemanticEmbedder(ctx, fact.Content); err == nil {
		_ = factRepo.UpsertEmbedding(ctx, fact.ID, userID, "gemini-embedding-001", vec)
	}
	memSvc := aimemory.NewSQLiteMemoryService(factRepo, hierarchyRepo, aimemory.DefaultSemanticEmbedder)

	// 1. Com MemoryService configurado -> load_memory aparece nas declarações e retorna fatos do SQLite.
	providerWithMem := &fakeADKLLM{
		model: "gemini-2.5-flash",
		responses: []scriptedModelResponse{
			{ToolCalls: []ai.ToolCall{{ID: "lm1", Name: "load_memory", Arguments: json.RawMessage(`{"query":"reuniões"}`)}}},
			{Text: "Você prefere reuniões técnicas às 10h da manhã."},
		},
	}
	facadeWithMem, err := adkengine.NewADKLoopFacade(adkengine.FacadeConfig{
		ServerPool:       testServerPool("Mem-LLM", "gemini-2.5-flash", providerWithMem),
		Registry:         toolsets.NewToolsetsRegistry(),
		ScopeGuard:       service.NewScopeGuard(),
		ConfirmationGate: service.NewConfirmationGateService(db),
		ConvRepo:         repository.NewConversationStoreRepository(db),
		UserRepo:         userRepo,
		AISettingsRepo:   repository.NewAISettingsRepository(db),
		MemoryService:    memSvc,
	})
	if err != nil {
		t.Fatalf("falha ao criar facadeWithMem: %v", err)
	}

	resp, err := facadeWithMem.Run(ctx, domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: "th-mem-on",
		Channel:  "app_mobile",
		Message:  "Qual meu horário preferido para reuniões?",
	})
	if err != nil {
		t.Fatalf("Run com load_memory falhou: %v", err)
	}
	if len(providerWithMem.capturedReqs) < 2 {
		t.Fatalf("esperava >= 2 requisições ao modelo após chamada a load_memory, obteve %d", len(providerWithMem.capturedReqs))
	}
	if _, ok := providerWithMem.capturedReqs[0].Tools["load_memory"]; !ok {
		t.Fatalf("esperava tool 'load_memory' registrada quando MemoryService != nil")
	}
	secondPayloads := collectFunctionResponsePayloads(providerWithMem.capturedReqs[1])
	if !strings.Contains(secondPayloads, "10h da manhã") {
		t.Errorf("esperava que load_memory retornasse a memória salva, obteve: %s", secondPayloads)
	}
	if !strings.Contains(resp.Reply, "10h") {
		t.Errorf("esperava resposta final refletindo a memória, obteve: %q", resp.Reply)
	}

	// 2. Sem MemoryService -> load_memory NÃO deve ser registrada.
	providerWithoutMem := &fakeADKLLM{
		model:     "gemini-2.5-flash",
		responses: []scriptedModelResponse{{Text: "Sem serviço de memória configurado."}},
	}
	facadeWithoutMem, err := adkengine.NewADKLoopFacade(adkengine.FacadeConfig{
		ServerPool:       testServerPool("NoMem-LLM", "gemini-2.5-flash", providerWithoutMem),
		Registry:         toolsets.NewToolsetsRegistry(),
		ScopeGuard:       service.NewScopeGuard(),
		ConfirmationGate: service.NewConfirmationGateService(db),
		ConvRepo:         repository.NewConversationStoreRepository(db),
		UserRepo:         userRepo,
		AISettingsRepo:   repository.NewAISettingsRepository(db),
	})
	if err != nil {
		t.Fatalf("falha ao criar facadeWithoutMem: %v", err)
	}
	if _, err := facadeWithoutMem.Run(ctx, domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: "th-mem-off",
		Channel:  "app_mobile",
		Message:  "Oi",
	}); err != nil {
		t.Fatalf("Run sem MemoryService falhou: %v", err)
	}
	if _, ok := providerWithoutMem.capturedReqs[0].Tools["load_memory"]; ok {
		t.Errorf("não esperava 'load_memory' registrada quando MemoryService == nil")
	}
}

func TestCrossDomainBriefingWorkflow_SynthesizerReceivesParallelStateTemplates(t *testing.T) {
	provider := &fakeADKLLM{
		model: "gemini-2.5-flash",
		responses: []scriptedModelResponse{
			{Text: "SINAL_COLETOR_1"},
			{Text: "SINAL_COLETOR_2"},
			{Text: "SINAL_COLETOR_3"},
			{Text: "Síntese matinal consolidada."},
		},
	}

	wfRunner, err := adkengine.NewCrossDomainBriefingWorkflowRunner(provider, nil)
	if err != nil {
		t.Fatalf("falha ao criar workflow runner: %v", err)
	}

	summary, err := wfRunner.GenerateBriefing(context.Background(), service.BriefingWorkflowInput{
		UserID:      "u-brief",
		UserName:    "André",
		Date:        "2026-11-26",
		EventsCount: 2,
		TodosCount:  3,
		BaseSummary: "Agenda cheia pela manhã",
	})
	if err != nil {
		t.Fatalf("GenerateBriefing falhou: %v", err)
	}
	if summary != "Síntese matinal consolidada." {
		t.Fatalf("esperava síntese final, obteve %q", summary)
	}
	if len(provider.capturedReqs) != 4 {
		t.Fatalf("esperava 3 coletores paralelos + 1 sintetizador = 4 requisições, obteve %d", len(provider.capturedReqs))
	}

	synthesizerSys := collectSystemInstructionText(provider.capturedReqs[3])
	for _, token := range []string{"SINAL_COLETOR_1", "SINAL_COLETOR_2", "SINAL_COLETOR_3"} {
		if !strings.Contains(synthesizerSys, token) {
			t.Errorf("esperava que o sintetizador recebesse %q via template de estado {key?}; SystemInstruction=%s", token, synthesizerSys)
		}
	}
}

func TestAdaptiveThinkingBudget_SimpleAnalyticalAndMultiDomain(t *testing.T) {
	makeReq := func(msg string) *model.LLMRequest {
		return &model.LLMRequest{
			Contents: []*genai.Content{
				genai.NewContentFromText(msg, genai.RoleUser),
			},
		}
	}

	cases := []struct {
		name       string
		channel    string
		message    string
		wantBudget int32
		wantMaxOut int32
	}{
		{
			name:       "saudação simples",
			channel:    "app_mobile",
			message:    "Bom dia, tudo bem?",
			wantBudget: 0,
		},
		{
			name:       "pergunta analítica simples",
			channel:    "app_mobile",
			message:    "Vale a pena parcelar essa compra agora?",
			wantBudget: 1024,
		},
		{
			name:       "coordenação multi-domínio agenda+finanças+comunicação",
			channel:    "app_mobile",
			message:    "Posso viajar amanhã considerando minha agenda de compromissos, meu orçamento e as mensagens no whatsapp?",
			wantBudget: 2048,
		},
		{
			name:       "canal voz preserva teto e budget zero mesmo multi-domínio",
			channel:    "voice",
			message:    "Analise minha agenda, meus gastos no cartão e minhas mensagens do whatsapp",
			wantBudget: 0,
			wantMaxOut: 320,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := makeReq(tc.message)
			adkengine.ApplyBeforeModelConfig(req, tc.channel, "auto", "STATIC_PROMPT", "VOLATILE")
			if req.Config == nil || req.Config.ThinkingConfig == nil || req.Config.ThinkingConfig.ThinkingBudget == nil {
				t.Fatalf("ThinkingConfig não preenchido")
			}
			gotBudget := *req.Config.ThinkingConfig.ThinkingBudget
			if gotBudget != tc.wantBudget {
				t.Errorf("ThinkingBudget = %d, esperava %d", gotBudget, tc.wantBudget)
			}
			if tc.wantMaxOut > 0 && req.Config.MaxOutputTokens != tc.wantMaxOut {
				t.Errorf("MaxOutputTokens = %d, esperava %d", req.Config.MaxOutputTokens, tc.wantMaxOut)
			}
		})
	}
}
