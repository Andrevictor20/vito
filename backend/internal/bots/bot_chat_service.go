package bots

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"google.golang.org/adk/v2/agent"
	"google.golang.org/adk/v2/tool"
	"google.golang.org/adk/v2/tool/functiontool"

	"github.com/andrevmp/vito/backend/internal/catalog"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

// BotChatResponse representa a resposta de um turno no chat dedicado de um Bot (Fase 2).
type BotChatResponse struct {
	ThreadID              string                `json:"thread_id"`
	Reply                 string                `json:"reply"`
	ModelUsed             string                `json:"model_used,omitempty"`
	Cards                 []domain.ChatCard     `json:"cards,omitempty"`
	ToolCalls             []domain.ExecutedTool `json:"tool_calls,omitempty"`
	RequiresConfirmation  bool                  `json:"requires_confirmation"`
	PendingConfirmationID string                `json:"pending_confirmation_id,omitempty"`
	SuggestedChips        []string              `json:"suggested_chips,omitempty"`
}

// BotChatHistory representa o histórico do chat dedicado de um Bot com os chips contextuais.
type BotChatHistory struct {
	ThreadID       string                         `json:"thread_id"`
	Turns          []*repository.ConversationTurn `json:"turns"`
	SuggestedChips []string                       `json:"suggested_chips"`
}

// BotChatService gerencia a sessão dedicada (channel='bot'), seed inicial, memórias e self-config tools (Plano 04 Fase 2).
type BotChatService struct {
	botRepo     *BotRepositorySQLite
	triggerRepo domain.TriggerRepository
	convRepo    *repository.ConversationStoreRepository
	catalog     *catalog.Catalog
	runtime     BotADKRuntime
	runner      *BotRunner
}

// NewBotChatService cria o serviço de chat dedicado por Bot.
func NewBotChatService(
	botRepo *BotRepositorySQLite,
	triggerRepo domain.TriggerRepository,
	convRepo *repository.ConversationStoreRepository,
	cat *catalog.Catalog,
	runtime BotADKRuntime,
	runner *BotRunner,
) *BotChatService {
	return &BotChatService{
		botRepo:     botRepo,
		triggerRepo: triggerRepo,
		convRepo:    convRepo,
		catalog:     cat,
		runtime:     runtime,
		runner:      runner,
	}
}

// GetOrCreateBotThread garante a thread dedicada do bot (channel='bot', external_chat_id=botID) e semeia a 1ª mensagem.
func (s *BotChatService) GetOrCreateBotThread(ctx context.Context, userID, botID string) (string, error) {
	bot, err := s.botRepo.GetByID(ctx, botID, userID)
	if err != nil {
		return "", err
	}

	threadID := strings.TrimSpace(bot.ThreadID)
	if threadID == "" {
		threadID = "bot_" + bot.ID
	}

	if s.convRepo != nil {
		th, err := s.convRepo.GetOrCreateThread(ctx, userID, "bot", threadID)
		if err == nil && th != nil {
			threadID = th.ID
		}
		turns, _ := s.convRepo.ListTurnsByThread(ctx, threadID, 5)
		if len(turns) == 0 {
			seed := s.buildSeedMessage(ctx, bot)
			_ = s.convRepo.AddTurn(ctx, repository.ConversationTurn{
				ID:        uuid.NewString(),
				ThreadID:  threadID,
				UserID:    userID,
				Channel:   "bot",
				Role:      "assistant",
				Origin:    "direct",
				Content:   seed,
				CreatedAt: time.Now().UTC(),
			})
		}
	}

	if bot.ThreadID != threadID {
		bot.ThreadID = threadID
		_ = s.botRepo.Update(ctx, bot)
	}
	if s.runtime != nil {
		_, _ = s.runtime.EnsureBotSession(ctx, userID, bot.ID, threadID)
	}
	return threadID, nil
}

// GetHistory retorna o histórico do chat do bot e os chips contextuais (§6 Fase 2).
func (s *BotChatService) GetHistory(ctx context.Context, userID, botID string) (*BotChatHistory, error) {
	bot, err := s.botRepo.GetByID(ctx, botID, userID)
	if err != nil {
		return nil, err
	}
	threadID, err := s.GetOrCreateBotThread(ctx, userID, botID)
	if err != nil {
		return nil, err
	}
	var turns []*repository.ConversationTurn
	if s.convRepo != nil {
		turns, _ = s.convRepo.ListTurnsByThread(ctx, threadID, 50)
	}
	return &BotChatHistory{
		ThreadID:       threadID,
		Turns:          turns,
		SuggestedChips: s.BuildContextualChips(bot),
	}, nil
}

// SendMessage processa uma mensagem do usuário no chat dedicado do bot.
func (s *BotChatService) SendMessage(ctx context.Context, userID, botID, message string) (*BotChatResponse, error) {
	bot, err := s.botRepo.GetByID(ctx, botID, userID)
	if err != nil {
		return nil, err
	}
	threadID, err := s.GetOrCreateBotThread(ctx, userID, botID)
	if err != nil {
		return nil, err
	}

	msg := strings.TrimSpace(message)
	if msg == "" {
		return nil, fmt.Errorf("mensagem não pode ser vazia")
	}

	if s.convRepo != nil {
		_ = s.convRepo.AddTurn(ctx, repository.ConversationTurn{
			ID:        uuid.NewString(),
			ThreadID:  threadID,
			UserID:    userID,
			Channel:   "bot",
			Role:      "user",
			Origin:    "direct",
			Content:   msg,
			CreatedAt: time.Now().UTC(),
		})
	}

	// Auto-detecção de preferência/memória explícita no chat do bot (AC-05)
	if shouldAutoSaveBotMemory(msg) {
		_ = s.botRepo.AddMemory(ctx, &domain.BotMemory{
			BotID:   bot.ID,
			UserID:  userID,
			Content: msg,
			Source:  "chat",
		})
		if updated, gErr := s.botRepo.GetByID(ctx, botID, userID); gErr == nil {
			bot = updated
		}
	}

	if s.runtime == nil {
		reply := fmt.Sprintf("Entendido! Sigo cuidando de: %s.", bot.Goal)
		s.persistAssistantTurn(ctx, threadID, userID, reply, "", nil)
		return &BotChatResponse{
			ThreadID:       threadID,
			Reply:          reply,
			SuggestedChips: s.BuildContextualChips(bot),
		}, nil
	}

	skillsMD, allowedKeys, policies, connected, locked := s.buildBotExecutionInputs(bot)
	lastRuns := s.loadLastRuns(bot.ID, 3)
	selfTools := s.buildSelfConfigTools(userID, bot.ID)

	res, err := s.runtime.ExecuteBotTurn(ctx, BotRuntimeRequest{
		UserID:            userID,
		Bot:               bot,
		ThreadID:          threadID,
		Channel:           "bot",
		Prompt:            msg,
		SkillsMarkdown:    skillsMD,
		LastRuns:          lastRuns,
		ConnectedActions:  connected,
		LockedActions:     locked,
		AllowedActionKeys: allowedKeys,
		ActionPolicies:    policies,
		ExtraTools:        selfTools,
		MaxLLMCalls:       5,
	})
	if err != nil {
		return nil, err
	}

	s.persistAssistantTurn(ctx, threadID, userID, res.Text, res.ModelUsed, res.Cards)

	return &BotChatResponse{
		ThreadID:              threadID,
		Reply:                 res.Text,
		ModelUsed:             res.ModelUsed,
		Cards:                 res.Cards,
		ToolCalls:             res.ExecutedTools,
		RequiresConfirmation:  res.RequiresConfirmation,
		PendingConfirmationID: res.PendingConfirmationID,
		SuggestedChips:        s.BuildContextualChips(bot),
	}, nil
}

func (s *BotChatService) persistAssistantTurn(ctx context.Context, threadID, userID, reply, modelUsed string, cards []domain.ChatCard) {
	if s.convRepo == nil {
		return
	}
	cardsBytes, _ := json.Marshal(cards)
	_ = s.convRepo.AddTurn(ctx, repository.ConversationTurn{
		ID:        uuid.NewString(),
		ThreadID:  threadID,
		UserID:    userID,
		Channel:   "bot",
		Role:      "assistant",
		Origin:    "direct",
		Content:   reply,
		CardsJSON: string(cardsBytes),
		ModelUsed: modelUsed,
		CreatedAt: time.Now().UTC(),
	})
}

func (s *BotChatService) buildSeedMessage(ctx context.Context, bot *domain.Bot) string {
	lastRun := "ainda não executado"
	if runs := s.loadLastRuns(bot.ID, 1); len(runs) > 0 {
		lastRun = runs[0]
	}
	var skillNames []string
	for _, bs := range bot.Skills {
		if s.catalog != nil {
			if sk, ok := s.catalog.Skill(bs.SkillKey); ok {
				skillNames = append(skillNames, sk.Name)
				continue
			}
		}
		skillNames = append(skillNames, bs.SkillKey)
	}
	skillsStr := "nenhuma"
	if len(skillNames) > 0 {
		skillsStr = strings.Join(skillNames, ", ")
	}
	return fmt.Sprintf("Oi! Eu cuido de uma coisa só: %s. Última execução: %s. Habilidades: %s.", bot.Goal, lastRun, skillsStr)
}

func (s *BotChatService) buildBotExecutionInputs(bot *domain.Bot) (
	skillsMD []string,
	allowedKeys []string,
	policies map[string]domain.ActionPolicy,
	connected []string,
	locked []string,
) {
	policies = make(map[string]domain.ActionPolicy, len(bot.Actions))
	for _, a := range bot.Actions {
		policies[a.ActionKey] = a.Policy
		if a.Policy == domain.ActionPolicyOff {
			continue
		}
		if spec, ok := domain.ActionCatalog[a.ActionKey]; ok && spec.AppKey != "" && s.runner != nil && s.runner.appChecker != nil {
			connApps := s.runner.appChecker(context.Background(), bot.UserID)
			if isConnected, known := connApps[spec.AppKey]; known && !isConnected {
				locked = append(locked, fmt.Sprintf("%s (app '%s' desconectado)", a.ActionKey, spec.AppKey))
				continue
			}
		}
		allowedKeys = append(allowedKeys, a.ActionKey)
		connected = append(connected, fmt.Sprintf("%s (%s)", a.ActionKey, a.Policy))
	}
	if s.catalog != nil {
		for _, bs := range bot.Skills {
			if sk, ok := s.catalog.Skill(bs.SkillKey); ok {
				skillsMD = append(skillsMD, fmt.Sprintf("### %s\nQuando usar: %s\nPassos:\n- %s\nContrato: %s",
					sk.Name, sk.When, strings.Join(sk.Steps, "\n- "), sk.OutputContract))
			}
		}
	}
	return
}

func (s *BotChatService) loadLastRuns(botID string, limit int) []string {
	if s.triggerRepo == nil {
		return nil
	}
	logs, err := s.triggerRepo.ListLogsByTrigger(botID)
	if err != nil || len(logs) == 0 {
		return nil
	}
	if len(logs) > limit {
		logs = logs[:limit]
	}
	out := make([]string, 0, len(logs))
	for _, l := range logs {
		out = append(out, fmt.Sprintf("%s: %s", l.TriggeredAt.Format("02/01 15:04"), l.Message))
	}
	return out
}

// BuildContextualChips retorna os chips contextuais do chat do bot (Plano 04 Fase 2).
func (s *BotChatService) BuildContextualChips(bot *domain.Bot) []string {
	chips := []string{
		"Executar agora",
		"O que você não conseguiu verificar?",
	}
	hasAction := make(map[string]bool, len(bot.Actions))
	for _, a := range bot.Actions {
		hasAction[a.ActionKey] = true
	}
	if !hasAction["task"] {
		chips = append(chips, "Adicionar Criar tarefa")
	} else if !hasAction["evt"] {
		chips = append(chips, "Adicionar Criar evento")
	}
	chips = append(chips, "Adicionar habilidade", "Mudar sua função")
	return chips
}

type botSelfEmptyArgs struct{}
type botSelfGoalArgs struct {
	Goal string `json:"goal" jsonschema:"Nova função ou objetivo principal do bot."`
}
type botSelfScheduleArgs struct {
	Schedule  string `json:"schedule,omitempty" jsonschema:"Horário no formato HH:MM."`
	Frequency string `json:"frequency,omitempty" jsonschema:"Frequência de execução (ex.: daily, hourly, weekly)."`
}
type botSelfActionArgs struct {
	ActionKey   string `json:"action_key" jsonschema:"Chave da ação a adicionar (ex.: cal:list, wa:waread)."`
	ActionLabel string `json:"action_label,omitempty" jsonschema:"Rótulo amigável opcional da ação."`
}
type botSelfSkillArgs struct {
	SkillKey  string `json:"skill_key" jsonschema:"Chave do pacote de habilidade."`
	SkillName string `json:"skill_name,omitempty" jsonschema:"Nome opcional da habilidade."`
}
type botSelfMemoryArgs struct {
	Content string `json:"content" jsonschema:"Preferência ou instrução permanente para a memória isolada do bot."`
}
type botSelfPauseArgs struct {
	Reason string `json:"reason,omitempty" jsonschema:"Motivo opcional para pausar o bot."`
}

func newTypedBotSelfTool[T any](ts *BotSelfConfigToolset, userID, botID, name, op, desc string) (tool.Tool, error) {
	return functiontool.New(functiontool.Config{
		Name:        name,
		Description: desc,
	}, func(ctx agent.Context, args T) (map[string]any, error) {
		raw, _ := json.Marshal(args)
		res, err := ts.Execute(ctx, &domain.ToolExecutionContext{UserID: userID, BotID: botID}, op, raw)
		if err != nil {
			return map[string]any{"status": "ERROR", "error": err.Error()}, nil
		}
		outMap := map[string]any{
			"status":          res.Status,
			"summary_for_llm": res.SummaryForLLM,
		}
		if len(res.Cards) > 0 {
			outMap["cards"] = res.Cards
		}
		return outMap, nil
	})
}

// buildSelfConfigTools expõe as 8 operações de BotSelfConfigToolset como functiontools ADK tipadas no chat do bot.
func (s *BotChatService) buildSelfConfigTools(userID, botID string) []tool.Tool {
	adapter := &botSelfConfigAdapter{chatSvc: s, userID: userID, botID: botID}
	ts := NewBotSelfConfigToolset(adapter)
	candidates := []func() (tool.Tool, error){
		func() (tool.Tool, error) {
			return newTypedBotSelfTool[botSelfEmptyArgs](ts, userID, botID, "run_now", "run_now", "Executa o bot agora mesmo de forma real.")
		},
		func() (tool.Tool, error) {
			return newTypedBotSelfTool[botSelfEmptyArgs](ts, userID, botID, "explain_last_gaps", "explain_last_gaps", "Explica o que o bot não conseguiu verificar na última execução.")
		},
		func() (tool.Tool, error) {
			return newTypedBotSelfTool[botSelfGoalArgs](ts, userID, botID, "propose_update_goal", "propose_update_goal", "Propõe alterar a função principal do bot (exige confirmação do usuário).")
		},
		func() (tool.Tool, error) {
			return newTypedBotSelfTool[botSelfScheduleArgs](ts, userID, botID, "propose_update_schedule", "propose_update_schedule", "Propõe alterar o horário ou frequência de execução do bot.")
		},
		func() (tool.Tool, error) {
			return newTypedBotSelfTool[botSelfActionArgs](ts, userID, botID, "propose_add_action", "propose_add_action", "Propõe adicionar uma nova ação ao bot.")
		},
		func() (tool.Tool, error) {
			return newTypedBotSelfTool[botSelfSkillArgs](ts, userID, botID, "propose_add_skill", "propose_add_skill", "Propõe adicionar um pacote de habilidade ao bot.")
		},
		func() (tool.Tool, error) {
			return newTypedBotSelfTool[botSelfMemoryArgs](ts, userID, botID, "save_bot_memory", "save_bot_memory", "Salva uma preferência ou instrução permanente na memória isolada deste bot.")
		},
		func() (tool.Tool, error) {
			return newTypedBotSelfTool[botSelfPauseArgs](ts, userID, botID, "propose_pause_bot", "propose_pause_bot", "Propõe pausar este bot.")
		},
	}
	var out []tool.Tool
	for _, build := range candidates {
		if ft, err := build(); err == nil && ft != nil {
			out = append(out, ft)
		}
	}
	return out
}
