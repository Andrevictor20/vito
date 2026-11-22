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
	workflow  *CrossDomainBriefingWorkflow
	adkRunner *runner.Runner
}

// NewCrossDomainBriefingWorkflowRunner instancia o workflow cross-domain e um Runner ADK dedicado.
func NewCrossDomainBriefingWorkflowRunner(llm model.LLM, bridge *ToolsetBridge) (*CrossDomainBriefingWorkflowRunner, error) {
	if llm == nil {
		return nil, fmt.Errorf("llm não pode ser nil para o briefing cross-domain")
	}
	wf, err := BuildCrossDomainBriefingWorkflow(llm, bridge)
	if err != nil {
		return nil, err
	}
	r, err := runner.New(runner.Config{
		AppName:           "vito_briefing",
		Agent:             wf.SequentialPipeline,
		SessionService:    session.InMemoryService(),
		AutoCreateSession: true,
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao criar runner para briefing cross-domain: %w", err)
	}
	return &CrossDomainBriefingWorkflowRunner{
		workflow:  wf,
		adkRunner: r,
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

// BotAgentConfig descreve a configuração de um Bot isolado instanciado como llmagent no ADK (Plano 01 §2.1.6 & Plano 04).
type BotAgentConfig struct {
	BotID             string
	Name              string
	Goal              string
	FiringFrame       string
	Rules             []string
	SkillsMarkdown    []string
	BotMemories       []string
	AllowedActionKeys []string // Somente bot_actions com política != 'off'
}

// BuildBotLLMAgent instancia um llmagent.New(...) isolado para um Bot com Tools estritamente filtradas por AllowedActionKeys.
func BuildBotLLMAgent(llm model.LLM, bridge *ToolsetBridge, cfg BotAgentConfig) (agent.Agent, []tool.Tool, error) {
	botID := strings.TrimSpace(cfg.BotID)
	if botID == "" {
		botID = "custom"
	}

	var scopedTools []tool.Tool
	if bridge != nil && len(cfg.AllowedActionKeys) > 0 {
		scopedTools = bridge.FilterByActionKeys(cfg.AllowedActionKeys)
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Você é o bot especialista '%s' (ID: bot_%s).\n", cfg.Name, botID))
	sb.WriteString("RESTRIÇÃO DE ESCOPO ÚNICO: Atue exclusivamente dentro da sua função e utilize apenas as ferramentas habilitadas.\n")

	if strings.TrimSpace(cfg.FiringFrame) != "" {
		sb.WriteString("\n## Firing Frame\n" + strings.TrimSpace(cfg.FiringFrame) + "\n")
	}
	if strings.TrimSpace(cfg.Goal) != "" {
		sb.WriteString("\n## Função Principal\n" + strings.TrimSpace(cfg.Goal) + "\n")
	}
	if len(cfg.Rules) > 0 {
		sb.WriteString("\n## Regras Operacionais\n")
		for _, r := range cfg.Rules {
			if strings.TrimSpace(r) != "" {
				sb.WriteString("- " + strings.TrimSpace(r) + "\n")
			}
		}
	}
	if len(cfg.SkillsMarkdown) > 0 {
		sb.WriteString("\n## Habilidades\n")
		for _, sk := range cfg.SkillsMarkdown {
			if strings.TrimSpace(sk) != "" {
				sb.WriteString(strings.TrimSpace(sk) + "\n")
			}
		}
	}
	if len(cfg.BotMemories) > 0 {
		sb.WriteString("\n## Memória do Bot\n")
		for _, mem := range cfg.BotMemories {
			if strings.TrimSpace(mem) != "" {
				sb.WriteString("- " + strings.TrimSpace(mem) + "\n")
			}
		}
	}

	ag, err := llmagent.New(llmagent.Config{
		Name:        "bot_" + botID,
		Description: fmt.Sprintf("Bot ADK isolado: %s (%s)", cfg.Name, cfg.Goal),
		Model:       llm,
		Instruction: sb.String(),
		Tools:       scopedTools,
	})
	if err != nil {
		return nil, nil, err
	}
	return ag, scopedTools, nil
}
