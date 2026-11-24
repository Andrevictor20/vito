package adkengine

import (
	"context"
	"fmt"
	"strings"
	"time"

	"google.golang.org/adk/v2/agent"
	"google.golang.org/adk/v2/agent/llmagent"
	"google.golang.org/adk/v2/agent/workflowagents/parallelagent"
	"google.golang.org/adk/v2/agent/workflowagents/sequentialagent"
	"google.golang.org/adk/v2/model"
	"google.golang.org/adk/v2/plugin"
	"google.golang.org/adk/v2/runner"
	"google.golang.org/adk/v2/session"
	"google.golang.org/adk/v2/tool"
	"google.golang.org/genai"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

// CrossDomainBriefingWorkflow encapsula o ParallelAgent coletor multi-domínio e o SequentialAgent sintetizador (Onda 3).
type CrossDomainBriefingWorkflow struct {
	ParallelCollectors agent.Agent
	SequentialPipeline agent.Agent
}

// BuildCrossDomainBriefingWorkflow constrói o workflow ADK de briefing executivo cross-domain:
// 1. ParallelAgent coleta simultaneamente sinais de Rotina (Agenda/Tarefas), Finanças (Safe-to-Spend/Faturas) e Comunicações (WhatsApp/Gmail).
// 2. SequentialAgent executa o ParallelAgent seguido pelo sintetizador executivo (vito_briefing_synthesizer).
func BuildCrossDomainBriefingWorkflow(llm model.LLM, bridge *ToolsetBridge) (*CrossDomainBriefingWorkflow, error) {
	var routineTools, financeTools, commsTools []tool.Tool
	if bridge != nil {
		routineTools = bridge.BuildDomainTools(domain.ToolsetCalendar, domain.ToolsetTaskPending, domain.ToolsetMeetingBooking)
		financeTools = bridge.BuildDomainTools(domain.ToolsetName("finance_manager"))
		commsTools = bridge.BuildDomainTools(domain.ToolsetWhatsApp, domain.ToolsetGmail)
	}

	routineCollector, err := llmagent.New(llmagent.Config{
		Name:        "briefing_routine_collector",
		Description: "Coleta compromissos do dia, conflitos de agenda e tarefas prioritárias pendentes.",
		Model:       llm,
		Instruction: "Colete os compromissos de hoje e as tarefas pendentes prioritárias de forma concisa.",
		Tools:       routineTools,
		OutputKey:   "briefing_routine_signals",
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao criar briefing_routine_collector: %w", err)
	}

	financeCollector, err := llmagent.New(llmagent.Config{
		Name:        "briefing_finance_collector",
		Description: "Coleta resumo financeiro Safe-to-Spend e faturas próximas.",
		Model:       llm,
		Instruction: "Verifique o resumo financeiro Safe-to-Spend e alertas de vencimento próximos.",
		Tools:       financeTools,
		OutputKey:   "briefing_finance_signals",
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao criar briefing_finance_collector: %w", err)
	}

	commsCollector, err := llmagent.New(llmagent.Config{
		Name:        "briefing_comms_collector",
		Description: "Coleta mensagens urgentes não respondidas no WhatsApp e Gmail.",
		Model:       llm,
		Instruction: "Identifique pendências urgentes de resposta em WhatsApp e Gmail.",
		Tools:       commsTools,
		OutputKey:   "briefing_comms_signals",
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao criar briefing_comms_collector: %w", err)
	}

	parallelCollectors, err := parallelagent.New(parallelagent.Config{
		AgentConfig: agent.Config{
			Name:        "vito_parallel_signal_collectors",
			Description: "Coleta paralela de sinais de Rotina, Finanças e Comunicações.",
			SubAgents:   []agent.Agent{routineCollector, financeCollector, commsCollector},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao criar ParallelAgent vito_parallel_signal_collectors: %w", err)
	}

	synthesizer, err := llmagent.New(llmagent.Config{
		Name:        "vito_briefing_synthesizer",
		Description: "Sintetiza os sinais coletados em paralelo em um briefing executivo acionável.",
		Model:       llm,
		Instruction: "Combine os sinais coletados de agenda, tarefas, finanças e comunicações em 3 prioridades claras e acionáveis para o usuário.",
		OutputKey:   "executive_briefing_summary",
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao criar vito_briefing_synthesizer: %w", err)
	}

	sequentialPipeline, err := sequentialagent.New(sequentialagent.Config{
		AgentConfig: agent.Config{
			Name:        "vito_cross_domain_briefing_pipeline",
			Description: "Pipeline sequencial: coleta paralela multi-domínio seguida de síntese executiva.",
			SubAgents:   []agent.Agent{parallelCollectors, synthesizer},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao criar SequentialAgent vito_cross_domain_briefing_pipeline: %w", err)
	}

	return &CrossDomainBriefingWorkflow{
		ParallelCollectors: parallelCollectors,
		SequentialPipeline: sequentialPipeline,
	}, nil
}

// CrossDomainBriefingWorkflowRunner adapta CrossDomainBriefingWorkflow para service.BriefingWorkflowRunner,
// executando ParallelAgent + SequentialAgent via adk/v2/runner.Runner.
type CrossDomainBriefingWorkflowRunner struct {
	workflow   *CrossDomainBriefingWorkflow
	adkRunner  *runner.Runner
	sessionSvc session.Service
}

// NewCrossDomainBriefingWorkflowRunner instancia o workflow cross-domain e um Runner ADK dedicado.
func NewCrossDomainBriefingWorkflowRunner(llm model.LLM, bridge *ToolsetBridge, guardrails ...*GuardrailPlugin) (*CrossDomainBriefingWorkflowRunner, error) {
	if llm == nil {
		return nil, fmt.Errorf("llm não pode ser nil para o briefing cross-domain")
	}
	wf, err := BuildCrossDomainBriefingWorkflow(llm, bridge)
	if err != nil {
		return nil, err
	}
	sessSvc := session.InMemoryService()
	var plugins []*plugin.Plugin
	if len(guardrails) > 0 && guardrails[0] != nil {
		if p, pErr := guardrails[0].BuildADKPlugin(); pErr == nil && p != nil {
			plugins = append(plugins, p)
		}
	}
	r, err := runner.New(runner.Config{
		AppName:           "vito_briefing",
		Agent:             wf.SequentialPipeline,
		SessionService:    sessSvc,
		AutoCreateSession: true,
		PluginConfig: runner.PluginConfig{
			Plugins: plugins,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao criar runner para briefing cross-domain: %w", err)
	}
	return &CrossDomainBriefingWorkflowRunner{
		workflow:   wf,
		adkRunner:  r,
		sessionSvc: sessSvc,
	}, nil
}

// GenerateBriefing executa o pipeline ParallelAgent -> SequentialAgent para sintetizar o briefing matinal.
func (r *CrossDomainBriefingWorkflowRunner) GenerateBriefing(ctx context.Context, input service.BriefingWorkflowInput) (string, error) {
	if r == nil || r.adkRunner == nil {
		return "", fmt.Errorf("CrossDomainBriefingWorkflowRunner não inicializado")
	}
	userID := strings.TrimSpace(input.UserID)
	if userID == "" {
		userID = "briefing_user"
	}
	sessionID := fmt.Sprintf("briefing_%s_%s_%d", userID, input.Date, time.Now().UnixNano())
	ctx = WithTurnExecutionMeta(ctx, &TurnExecutionMeta{
		UserID:   userID,
		ThreadID: sessionID,
		Channel:  "briefing",
	})
	if r.sessionSvc != nil {
		defer func() {
			_ = r.sessionSvc.Delete(context.Background(), &session.DeleteRequest{
				AppName:   "vito_briefing",
				UserID:    userID,
				SessionID: sessionID,
			})
		}()
	}
	prompt := fmt.Sprintf(
		"Gere um briefing matinal executivo conciso (máximo 2 frases, sem emojis) para %s (%s) na data %s. Compromissos hoje: %d. Tarefas pendentes: %d. Resumo base: %s",
		input.UserName, userID, input.Date, input.EventsCount, input.TodosCount, input.BaseSummary,
	)
	userContent := genai.NewContentFromText(prompt, genai.RoleUser)

	var synthesizedText string
	var lastModelText string
	for ev, err := range r.adkRunner.Run(ctx, userID, sessionID, userContent, agent.RunConfig{MaxLLMCalls: 12}) {
		if err != nil {
			return "", err
		}
		if ev == nil || ev.Partial || ev.Content == nil || ev.Content.Role != genai.RoleModel {
			continue
		}
		var parts []string
		for _, p := range ev.Content.Parts {
			if p != nil && !p.Thought && strings.TrimSpace(p.Text) != "" {
				parts = append(parts, strings.TrimSpace(p.Text))
			}
		}
		if len(parts) == 0 {
			continue
		}
		joined := strings.Join(parts, "\n")
		lastModelText = joined
		if ev.Author == "vito_briefing_synthesizer" {
			synthesizedText = joined
		}
	}

	if strings.TrimSpace(synthesizedText) != "" {
		return strings.TrimSpace(synthesizedText), nil
	}
	return strings.TrimSpace(lastModelText), nil
}
