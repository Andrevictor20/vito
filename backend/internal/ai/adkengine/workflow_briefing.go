package adkengine

import (
	"fmt"
	"strings"

	"google.golang.org/adk/v2/agent"
	"google.golang.org/adk/v2/agent/llmagent"
	"google.golang.org/adk/v2/agent/workflowagents/parallelagent"
	"google.golang.org/adk/v2/agent/workflowagents/sequentialagent"
	"google.golang.org/adk/v2/model"
	"google.golang.org/adk/v2/tool"

	"github.com/andrevmp/vito/backend/internal/domain"
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
