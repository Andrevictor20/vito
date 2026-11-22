package toolsets

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// BotSelfConfigContract define o contrato mínimo usado pelas ferramentas de auto-configuração no chat do bot (Fase 2).
type BotSelfConfigContract interface {
	RunNow(ctx context.Context, botID, userID string) (string, error)
	LastGaps(ctx context.Context, botID, userID string) ([]string, error)
	SaveMemory(ctx context.Context, botID, userID, content, source string) error
}

// BotSelfConfigToolset expõe as ferramentas de auto-configuração e memória isolada dentro do chat do bot (Plano 04 Fase 2).
type BotSelfConfigToolset struct {
	svc BotSelfConfigContract
}

// NewBotSelfConfigToolset cria o toolset de auto-configuração para o chat dedicado de um Bot.
func NewBotSelfConfigToolset(svc BotSelfConfigContract) *BotSelfConfigToolset {
	return &BotSelfConfigToolset{svc: svc}
}

func (t *BotSelfConfigToolset) Name() domain.ToolsetName {
	return domain.ToolsetName("bot_self_config")
}

func (t *BotSelfConfigToolset) Description() string {
	return "Ferramentas internas do chat do bot: executar agora, explicar lacunas, salvar memória do bot e propor ajustes de função, horário, ações, habilidades ou pausa."
}

func (t *BotSelfConfigToolset) JSONSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"operation": {
				"type": "string",
				"enum": [
					"run_now",
					"explain_last_gaps",
					"propose_update_goal",
					"propose_update_schedule",
					"propose_add_action",
					"propose_add_skill",
					"save_bot_memory",
					"propose_pause_bot"
				]
			},
			"params": {
				"type": "object",
				"properties": {
					"goal": {"type": "string"},
					"schedule": {"type": "string"},
					"frequency": {"type": "string"},
					"action_key": {"type": "string"},
					"action_label": {"type": "string"},
					"skill_key": {"type": "string"},
					"skill_name": {"type": "string"},
					"content": {"type": "string"},
					"reason": {"type": "string"}
				}
			}
		},
		"required": ["operation"]
	}`)
}

func (t *BotSelfConfigToolset) IsWriteOperation(op string, rawParams json.RawMessage) (bool, bool, map[string]any) {
	preview := make(map[string]any)
	_ = json.Unmarshal(rawParams, &preview)
	// Todas as operações propose_* apenas devolvem cartão inline para o usuário tocar [Ação] [Agora não],
	// portanto não mutam estado diretamente no turno.
	return false, false, preview
}

func (t *BotSelfConfigToolset) Execute(ctx context.Context, execCtx *domain.ToolExecutionContext, op string, rawParams json.RawMessage) (*domain.ToolExecutionResult, error) {
	var params struct {
		Goal        string `json:"goal"`
		Schedule    string `json:"schedule"`
		Frequency   string `json:"frequency"`
		ActionKey   string `json:"action_key"`
		ActionLabel string `json:"action_label"`
		SkillKey    string `json:"skill_key"`
		SkillName   string `json:"skill_name"`
		Content     string `json:"content"`
		Reason      string `json:"reason"`
	}
	if len(rawParams) > 0 {
		_ = json.Unmarshal(rawParams, &params)
	}

	botID := ""
	userID := ""
	if execCtx != nil {
		botID = strings.TrimSpace(execCtx.BotID)
		userID = strings.TrimSpace(execCtx.UserID)
	}

	switch op {
	case "run_now":
		if t.svc == nil || botID == "" {
			return &domain.ToolExecutionResult{
				Status:        "COMPLETED",
				SummaryForLLM: "Execução imediata indisponível no momento.",
			}, nil
		}
		summary, err := t.svc.RunNow(ctx, botID, userID)
		if err != nil {
			return nil, err
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: summary,
		}, nil

	case "explain_last_gaps":
		if t.svc == nil || botID == "" {
			return &domain.ToolExecutionResult{
				Status:        "COMPLETED",
				SummaryForLLM: "Nenhuma falha ou pendência registrada na última execução.",
			}, nil
		}
		gaps, err := t.svc.LastGaps(ctx, botID, userID)
		if err != nil {
			return nil, err
		}
		if len(gaps) == 0 {
			return &domain.ToolExecutionResult{
				Status:        "COMPLETED",
				SummaryForLLM: "Na última execução tudo foi verificado sem lacunas.",
			}, nil
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: "Itens que não puderam ser verificados na última execução:\n- " + strings.Join(gaps, "\n- "),
			Data:          gaps,
		}, nil

	case "save_bot_memory":
		content := strings.TrimSpace(params.Content)
		if content == "" {
			return &domain.ToolExecutionResult{
				Status:        "ERROR",
				SummaryForLLM: "Conteúdo da memória não pode ser vazio.",
			}, nil
		}
		if t.svc != nil && botID != "" {
			if err := t.svc.SaveMemory(ctx, botID, userID, content, "chat"); err != nil {
				return nil, err
			}
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: fmt.Sprintf("Memória salva exclusivamente para este bot: %q.", content),
		}, nil

	case "propose_update_goal":
		return proposalCardResult("update_goal", "Atualizar função do bot", params.Goal, "Aplicar função", params.Goal), nil

	case "propose_update_schedule":
		label := strings.TrimSpace(params.Schedule)
		if params.Frequency != "" {
			label = strings.TrimSpace(params.Frequency + " " + label)
		}
		return proposalCardResult("update_schedule", "Atualizar quando executar", label, "Aplicar horário", label), nil

	case "propose_add_action":
		title := strings.TrimSpace(params.ActionLabel)
		if title == "" {
			title = params.ActionKey
		}
		return proposalCardResult("add_action", fmt.Sprintf("Adicionar ação: %s", title), params.ActionKey, "Adicionar ação", params.ActionKey), nil

	case "propose_add_skill":
		title := strings.TrimSpace(params.SkillName)
		if title == "" {
			title = params.SkillKey
		}
		return proposalCardResult("add_skill", fmt.Sprintf("Posso aprender '%s'", title), params.SkillKey, "Adicionar habilidade", params.SkillKey), nil

	case "propose_pause_bot":
		return proposalCardResult("pause_bot", "Pausar este bot", params.Reason, "Pausar bot", botID), nil

	default:
		return &domain.ToolExecutionResult{
			Status:        "ERROR",
			SummaryForLLM: fmt.Sprintf("Operação desconhecida: %s", op),
		}, nil
	}
}

func proposalCardResult(kind, title, subtitle, actionLabel, actionValue string) *domain.ToolExecutionResult {
	return &domain.ToolExecutionResult{
		Status:        "COMPLETED",
		SummaryForLLM: fmt.Sprintf("Proposta '%s' exibida ao usuário para confirmação.", title),
		Data: map[string]any{
			"proposal_type": kind,
			"value":         actionValue,
		},
		Cards: []domain.ChatCard{{
			ID:          uuid.New().String(),
			Type:        "bot_proposal_" + kind,
			Title:       title,
			Subtitle:    subtitle,
			ActionLabel: actionLabel,
			ActionValue: actionValue,
			Confirm:     true,
			Dismiss:     true,
		}},
	}
}
