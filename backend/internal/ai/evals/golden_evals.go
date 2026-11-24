package evals

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"google.golang.org/adk/v2/model"
	"google.golang.org/genai"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

// ScenarioResult armazena o resultado empírico de um cenário da suíte ADK Golden Evals.
type ScenarioResult struct {
	ScenarioID  string   `json:"scenario_id"`
	Category    string   `json:"category"`
	Passed      bool     `json:"passed"`
	ActualTools []string `json:"actual_tools"`
	LatencyMs   int64    `json:"latency_ms"`
	Notes       string   `json:"notes"`
}

// SuiteReport consolida a execução de todos os cenários da suíte ADK Golden Evals.
type SuiteReport struct {
	SuiteName   string           `json:"suite_name"`
	Total       int              `json:"total"`
	PassedCount int              `json:"passed_count"`
	FailedCount int              `json:"failed_count"`
	Results     []ScenarioResult `json:"results"`
}

// GoldenEvalRunner executa a suíte de trajetórias ADK Golden Evals e grava telemetria em ai_eval_runs (migration 036).
type GoldenEvalRunner struct {
	db *sql.DB
}

// NewGoldenEvalRunner instancia o executor da suíte ADK Golden Evals.
func NewGoldenEvalRunner(db *sql.DB) *GoldenEvalRunner {
	return &GoldenEvalRunner{db: db}
}

// RunDefaultSuite executa os 36 cenários canônicos de avaliação de trajetórias ADK.
func (r *GoldenEvalRunner) RunDefaultSuite(ctx context.Context) (*SuiteReport, error) {
	return r.RunScenarios(ctx, DefaultGoldenScenarios())
}

// RunScenarios executa uma lista de cenários de avaliação de trajetórias sobre o motor ADK.
func (r *GoldenEvalRunner) RunScenarios(ctx context.Context, scenarios []GoldenScenario) (*SuiteReport, error) {
	report := &SuiteReport{
		SuiteName: "adk_golden_evals",
		Total:     len(scenarios),
		Results:   make([]ScenarioResult, 0, len(scenarios)),
	}

	registry := buildEvalToolsetsRegistry()
	bridge := adkengine.NewToolsetBridge(registry)

	for _, sc := range scenarios {
		start := time.Now()
		res := r.evaluateSingleScenario(ctx, sc, registry, bridge)
		res.LatencyMs = time.Since(start).Milliseconds()
		if res.Passed {
			report.PassedCount++
		} else {
			report.FailedCount++
		}
		report.Results = append(report.Results, res)
		_ = r.persistEvalRun(ctx, report.SuiteName, sc, res)
	}

	return report, nil
}

func (r *GoldenEvalRunner) evaluateSingleScenario(
	ctx context.Context,
	sc GoldenScenario,
	registry *toolsets.ToolsetsRegistry,
	bridge *adkengine.ToolsetBridge,
) ScenarioResult {
	res := ScenarioResult{
		ScenarioID: sc.ID,
		Category:   sc.Category,
		Passed:     true,
	}

	// 1. Cenários de isolamento de escopo de Bot ADK (BuildBotLLMAgent)
	if sc.Category == "bot_scope" {
		router := ai.NewModelRouter()
		routedLLM := adkengine.NewRoutedLLM(router)
		botAgent, scopedTools, err := adkengine.BuildBotLLMAgent(routedLLM, bridge, adkengine.BotAgentConfig{
			BotID:             sc.ID,
			Name:              "Bot Eval " + sc.ID,
			Goal:              sc.Prompt,
			FiringFrame:       "Execução agendada de verificação",
			Rules:             []string{"Nunca extrapolar as ações permitidas"},
			AllowedActionKeys: sc.BotAllowedActions,
		})
		if err != nil || botAgent == nil {
			res.Passed = false
			res.Notes = fmt.Sprintf("falha ao instanciar bot llmagent: %v", err)
			return res
		}
		for _, t := range scopedTools {
			res.ActualTools = append(res.ActualTools, t.Name())
		}
		if !sameStringSet(res.ActualTools, sc.ExpectTools) {
			res.Passed = false
			res.Notes = fmt.Sprintf("escopo de tools divergente: esperado=%v obtido=%v", sc.ExpectTools, res.ActualTools)
		}
		return res
	}

	// 2. Verificação de configuração BeforeModelCallback para Voz (320 tokens, ThinkingBudget == 0, 0 tabelas)
	if sc.ExpectVoiceCap {
		staticPrompt := ai.BuildStaticPersonaSystemPrompt(ai.StyleBalanced, "André", "voice")
		llmReq := &model.LLMRequest{
			Model: "gemini-2.5-flash",
			Contents: []*genai.Content{
				genai.NewContentFromText(sc.Prompt, genai.RoleUser),
			},
		}
		adkengine.ApplyBeforeModelConfig(llmReq, "voice", sc.AutonomyLevel, staticPrompt, "")
		if llmReq.Config == nil || llmReq.Config.MaxOutputTokens != 320 {
			res.Passed = false
			res.Notes = "canal voice não aplicou MaxOutputTokens == 320"
			return res
		}
		if llmReq.Config.ThinkingConfig == nil || llmReq.Config.ThinkingConfig.ThinkingBudget == nil || *llmReq.Config.ThinkingConfig.ThinkingBudget != 0 {
			res.Passed = false
			res.Notes = "canal voice não aplicou ThinkingBudget == 0"
			return res
		}
	}

	// 3. Verificação de bloqueio de segurança via MemoryScopeGuard / ConfirmationGate (Taint Tracking & HITL)
	if sc.ExpectBlockedTool {
		scopeGuard := service.NewMemoryScopeGuard()
		isWrite := true
		operation := sc.SimulatedToolCall
		if resolved, ok := bridge.ResolveCall(sc.SimulatedToolCall, sc.SimulatedToolArgs); ok && resolved != nil {
			isWrite, _, _ = resolved.Toolset.IsWriteOperation(resolved.Operation, resolved.Params)
			operation = resolved.Operation
		}
		execCtx := &domain.ToolExecutionContext{
			UserID:                  "eval-user",
			Channel:                 sc.Channel,
			AutonomyLevel:           sc.AutonomyLevel,
			TaintedByUntrustedInput: sc.PreTaintedContext,
		}
		allowed, reason := scopeGuard.CanExecute(ctx, execCtx, operation, isWrite)
		if allowed {
			res.Passed = false
			res.Notes = fmt.Sprintf("esperava bloqueio de %s (tainted=%v, autonomy=%s), mas foi permitido", operation, sc.PreTaintedContext, sc.AutonomyLevel)
			return res
		}
		res.Notes = "bloqueado com sucesso pelo Guardrail: " + reason
		return res
	}

	// 4. Execução ponta a ponta no ADKLoopFacade (adk/v2/runner.Runner)
	provider := &scriptedEvalProvider{
		toolName: sc.SimulatedToolCall,
		toolArgs: sc.SimulatedToolArgs,
		reply:    sc.SimulatedReply,
	}
	router := ai.NewModelRouter()
	router.AddProvider(provider)

	var convRepo *repository.ConversationStoreRepository
	var confGate *service.ConfirmationGateService
	if r.db != nil {
		convRepo = repository.NewConversationStoreRepository(r.db)
		confGate = service.NewConfirmationGateService(r.db)
	}

	facade, err := adkengine.NewADKLoopFacade(adkengine.FacadeConfig{
		Router:           router,
		Registry:         registry,
		ScopeGuard:       service.NewMemoryScopeGuard(),
		ConfirmationGate: confGate,
		ConvRepo:         convRepo,
	})
	if err != nil {
		res.Passed = false
		res.Notes = fmt.Sprintf("falha ao criar ADKLoopFacade: %v", err)
		return res
	}

	resp, err := facade.Run(ctx, domain.UnifiedAssistantRequest{
		UserID:  "eval-user",
		Channel: sc.Channel,
		Message: sc.Prompt,
	})
	if err != nil {
		res.Passed = false
		res.Notes = fmt.Sprintf("erro na execução do runner: %v", err)
		return res
	}

	for _, tc := range resp.ToolCalls {
		res.ActualTools = append(res.ActualTools, tc.Operation)
	}
	if len(sc.ExpectTools) > 0 && len(res.ActualTools) == 0 {
		res.Passed = false
		res.Notes = fmt.Sprintf("esperava execução de tools=%v mas nenhuma tool foi chamada", sc.ExpectTools)
		return res
	}
	if sc.ExpectZeroTables && strings.Contains(resp.Text, "|---") {
		res.Passed = false
		res.Notes = "resposta de voz contém tabela markdown proibida"
		return res
	}

	res.Notes = "trajetória verificada com sucesso"
	return res
}

func (r *GoldenEvalRunner) persistEvalRun(ctx context.Context, suiteName string, sc GoldenScenario, res ScenarioResult) error {
	if r.db == nil {
		return nil
	}
	expTools, _ := json.Marshal(sc.ExpectTools)
	actTools, _ := json.Marshal(res.ActualTools)
	passedInt := 0
	if res.Passed {
		passedInt = 1
	}
	writeOp := func() error {
		_, err := r.db.ExecContext(ctx, `
			INSERT INTO ai_eval_runs (
				id, suite_name, scenario_id, category, passed,
				expected_tools_json, actual_tools_json, latency_ms, notes, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			uuid.New().String(), suiteName, sc.ID, sc.Category, passedInt,
			string(expTools), string(actTools), res.LatencyMs, res.Notes, time.Now().UTC(),
		)
		return err
	}
	if q := database.DefaultWriterQueue(); q != nil {
		return q.Execute(ctx, writeOp)
	}
	return writeOp()
}

type scriptedEvalProvider struct {
	toolName string
	toolArgs map[string]any
	reply    string
	step     int
}

func (p *scriptedEvalProvider) Name() string          { return "Eval-Gemini" }
func (p *scriptedEvalProvider) ModelName() string     { return "gemini-2.5-flash" }
func (p *scriptedEvalProvider) SupportsTools() bool   { return true }
func (p *scriptedEvalProvider) SupportsVision() bool  { return true }
func (p *scriptedEvalProvider) QualityTier() int      { return 3 }
func (p *scriptedEvalProvider) MaxContextTokens() int { return 65536 }

func subAgentForTool(toolName string) string {
	switch {
	case strings.HasPrefix(toolName, "calendar_"), strings.HasPrefix(toolName, "todo_"), strings.HasPrefix(toolName, "booking_"):
		return "vito_routine_agent"
	case strings.HasPrefix(toolName, "whatsapp_"), strings.HasPrefix(toolName, "gmail_"):
		return "vito_comms_agent"
	case strings.HasPrefix(toolName, "finance_"):
		return "vito_finance_agent"
	case strings.HasPrefix(toolName, "web_"):
		return "vito_research_agent"
	case strings.HasPrefix(toolName, "bot_"), strings.HasPrefix(toolName, "radar_"):
		return "vito_bots_architect"
	default:
		return ""
	}
}

func (p *scriptedEvalProvider) Chat(_ context.Context, _ ai.AgentChatRequest) (*ai.AgentChatResponse, error) {
	p.step++
	if p.toolName != "" {
		targetAgent := subAgentForTool(p.toolName)
		if targetAgent != "" && p.step == 1 {
			transferArgs, _ := json.Marshal(map[string]string{"agent_name": targetAgent})
			return &ai.AgentChatResponse{
				ProviderName: p.Name(),
				ModelName:    p.ModelName(),
				ToolCalls: []ai.ToolCall{
					{
						ID:        "call_transfer_" + targetAgent,
						Name:      "transfer_to_agent",
						Arguments: transferArgs,
					},
				},
			}, nil
		}
		if (targetAgent != "" && p.step == 2) || (targetAgent == "" && p.step == 1) {
			rawArgs, _ := json.Marshal(p.toolArgs)
			return &ai.AgentChatResponse{
				ProviderName: p.Name(),
				ModelName:    p.ModelName(),
				ToolCalls: []ai.ToolCall{
					{
						ID:        "call_" + p.toolName,
						Name:      p.toolName,
						Arguments: rawArgs,
					},
				},
			}, nil
		}
	}
	return &ai.AgentChatResponse{
		Text:         p.reply,
		ProviderName: p.Name(),
		ModelName:    p.ModelName(),
	}, nil
}

func (p *scriptedEvalProvider) StreamChat(ctx context.Context, req ai.AgentChatRequest, onDelta func(ai.StreamDelta) error) (*ai.AgentChatResponse, error) {
	resp, err := p.Chat(ctx, req)
	if err != nil {
		return nil, err
	}
	if onDelta != nil && resp.Text != "" {
		_ = onDelta(ai.StreamDelta{TextDelta: resp.Text})
		_ = onDelta(ai.StreamDelta{Done: true, FinalMetrics: resp})
	}
	return resp, nil
}

type stubDomainToolset struct {
	name domain.ToolsetName
}

func (s *stubDomainToolset) Name() domain.ToolsetName    { return s.name }
func (s *stubDomainToolset) Description() string         { return "Stub eval toolset " + string(s.name) }
func (s *stubDomainToolset) JSONSchema() json.RawMessage { return json.RawMessage(`{"type":"object"}`) }
func (s *stubDomainToolset) IsWriteOperation(op string, _ json.RawMessage) (bool, bool, map[string]any) {
	isSendOrDelete := strings.Contains(op, "send") || strings.Contains(op, "delete")
	return isSendOrDelete, isSendOrDelete, nil
}
func (s *stubDomainToolset) Execute(_ context.Context, _ *domain.ToolExecutionContext, op string, _ json.RawMessage) (*domain.ToolExecutionResult, error) {
	return &domain.ToolExecutionResult{
		Status:        "COMPLETED",
		SummaryForLLM: fmt.Sprintf("executado %s.%s", s.name, op),
	}, nil
}

func buildEvalToolsetsRegistry() *toolsets.ToolsetsRegistry {
	reg := toolsets.NewToolsetsRegistry()
	names := []domain.ToolsetName{
		domain.ToolsetCalendar,
		domain.ToolsetTaskPending,
		domain.ToolsetWhatsApp,
		domain.ToolsetGmail,
		domain.ToolsetWebSearch,
		domain.ToolsetMeetingBooking,
		domain.ToolsetRadarTrigger,
		domain.ToolsetMemoryProfile,
		domain.ToolsetName("finance_manager"),
	}
	for _, n := range names {
		reg.Register(&stubDomainToolset{name: n})
	}
	return reg
}

func containsAllTools(actual, expected []string) bool {
	set := make(map[string]bool, len(actual))
	for _, a := range actual {
		set[a] = true
	}
	for _, e := range expected {
		if !set[e] {
			return false
		}
	}
	return true
}

func sameStringSet(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	return containsAllTools(a, b) && containsAllTools(b, a)
}
