package adkengine

import (
	"fmt"
	"strings"

	"google.golang.org/adk/v2/agent"
	"google.golang.org/adk/v2/agent/llmagent"
	"google.golang.org/adk/v2/model"
	"google.golang.org/adk/v2/tool"
	"google.golang.org/genai"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// DefaultBotFiringFrame é o frame obrigatório injetado em execuções autônomas agendadas (Plano 04 §2.1).
const DefaultBotFiringFrame = "EXECUÇÃO DE ROTINA AGENDADA: este bot está disparando agora. Execute as ações permitidas para cumprir sua função. NÃO crie, pause ou edite a configuração do bot nesta execução."

// BotAgentConfig descreve a configuração de um Bot isolado instanciado como llmagent no ADK (Plano 01 §2.1.6 & Plano 04).
type BotAgentConfig struct {
	BotID             string
	Name              string
	Goal              string
	FiringFrame       string
	Rules             []string
	SkillsMarkdown    []string
	BotMemories       []string
	LastRuns          []string
	ConnectedActions  []string
	LockedActions     []string
	AllowedActionKeys []string
	ExecutionContext  *domain.ToolExecutionContext
	ExtraTools        []tool.Tool
	OutputSchema      *genai.Schema
}

// BuildBotLLMAgent instancia um llmagent.New(...) isolado para um Bot com Tools estritamente filtradas
// por ToolExecutionContext / AllowedActionKeys e Instruction composta (Plano 04 Fases 1, 2 e 3).
func BuildBotLLMAgent(llm model.LLM, bridge *ToolsetBridge, cfg BotAgentConfig) (agent.Agent, []tool.Tool, error) {
	botID := strings.TrimSpace(cfg.BotID)
	if botID == "" {
		botID = "custom"
	}

	var scopedTools []tool.Tool
	if bridge != nil {
		if cfg.ExecutionContext != nil {
			scopedTools = bridge.ToolsForBotContext(cfg.ExecutionContext)
		} else if len(cfg.AllowedActionKeys) > 0 {
			scopedTools = bridge.FilterByActionKeys(cfg.AllowedActionKeys)
		}
	}
	if len(cfg.ExtraTools) > 0 {
		scopedTools = append(scopedTools, cfg.ExtraTools...)
	}

	instruction := BuildBotInstruction(botID, cfg)

	ag, err := llmagent.New(llmagent.Config{
		Name:         "bot_" + botID,
		Description:  fmt.Sprintf("Bot ADK isolado: %s (%s)", cfg.Name, cfg.Goal),
		Model:        llm,
		Instruction:  instruction,
		Tools:        scopedTools,
		OutputSchema: cfg.OutputSchema,
	})
	if err != nil {
		return nil, nil, err
	}
	return ag, scopedTools, nil
}

// BuildBotInstruction compõe o system prompt isolado do Bot seguindo o contrato do Plano 04.
func BuildBotInstruction(botID string, cfg BotAgentConfig) string {
	var sb strings.Builder
	name := strings.TrimSpace(cfg.Name)
	if name == "" {
		name = "Bot Especialista"
	}
	sb.WriteString(fmt.Sprintf("Você é o bot especialista '%s' (ID: bot_%s).\n", name, botID))
	sb.WriteString("RESTRIÇÃO DE ESCOPO ÚNICO: Atue exclusivamente dentro da sua função e utilize apenas as ferramentas habilitadas.\n")
	sb.WriteString("Se o usuário pedir algo fora da sua função, responda exatamente: \"Eu cuido só desta função. Para outros assuntos, fale com o Vito principal.\"\n")

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
	if len(cfg.ConnectedActions) > 0 || len(cfg.LockedActions) > 0 {
		sb.WriteString("\n## Ações\n")
		if len(cfg.ConnectedActions) > 0 {
			sb.WriteString("Conectadas: " + strings.Join(cfg.ConnectedActions, ", ") + "\n")
		}
		if len(cfg.LockedActions) > 0 {
			sb.WriteString("Travadas (app desconectado — registre em cant se precisar): " + strings.Join(cfg.LockedActions, ", ") + "\n")
		}
	}
	if len(cfg.LastRuns) > 0 {
		sb.WriteString("\n## Últimas Execuções\n")
		limit := len(cfg.LastRuns)
		if limit > 3 {
			limit = 3
		}
		for _, lr := range cfg.LastRuns[:limit] {
			if strings.TrimSpace(lr) != "" {
				sb.WriteString("- " + strings.TrimSpace(lr) + "\n")
			}
		}
	}
	return sb.String()
}

// BotRunReportOutputSchema retorna o schema JSON estruturado (genai.Schema) para BotRunReport (Plano 04 Fase 3).
func BotRunReportOutputSchema() *genai.Schema {
	return &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"summary": {
				Type:        genai.TypeString,
				Description: "Resumo curto e objetivo da execução em português.",
			},
			"should_notify": {
				Type:        genai.TypeBoolean,
				Description: "True apenas se houver novidade relevante ou alteração que mereça avisar o usuário.",
			},
			"verified": {
				Type:        genai.TypeArray,
				Items:       &genai.Schema{Type: genai.TypeString},
				Description: "Lista do que foi verificado nesta execução.",
			},
			"did": {
				Type:        genai.TypeArray,
				Items:       &genai.Schema{Type: genai.TypeString},
				Description: "Lista de ações executadas automaticamente.",
			},
			"waiting": {
				Type:        genai.TypeArray,
				Items:       &genai.Schema{Type: genai.TypeString},
				Description: "Lista de ações que ficaram aguardando aprovação do usuário.",
			},
			"cant": {
				Type:        genai.TypeArray,
				Items:       &genai.Schema{Type: genai.TypeString},
				Description: "Lista de itens que não puderam ser verificados (fonte falhou ou app desconectado).",
			},
		},
		Required: []string{"summary", "should_notify", "verified", "did", "waiting", "cant"},
	}
}
