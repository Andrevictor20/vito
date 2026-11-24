package adkengine

import (
	"context"
	"fmt"
	"github.com/andrevmp/vito/backend/internal/bots"
	"strings"

	"github.com/google/uuid"
	"google.golang.org/adk/v2/agent"
	"google.golang.org/adk/v2/plugin"
	"google.golang.org/adk/v2/runner"
	"google.golang.org/adk/v2/session"
	"google.golang.org/genai"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// BotRuntimeAdapter implementa bots.BotADKRuntime sobre RoutedLLM, ToolsetBridge, GuardrailPlugin e SQLiteSessionService.
type BotRuntimeAdapter struct {
	routedLLM      *RoutedLLM
	sessionService *SQLiteSessionService
	bridge         *ToolsetBridge
	guardrail      *GuardrailPlugin
}

// NewBotRuntimeAdapter cria o adaptador de runtime ADK dedicado a Bots.
func NewBotRuntimeAdapter(
	routedLLM *RoutedLLM,
	sessionService *SQLiteSessionService,
	bridge *ToolsetBridge,
	guardrail *GuardrailPlugin,
) *BotRuntimeAdapter {
	return &BotRuntimeAdapter{
		routedLLM:      routedLLM,
		sessionService: sessionService,
		bridge:         bridge,
		guardrail:      guardrail,
	}
}

// EnsureBotSession garante que a sessão ADK do bot exista no SQLiteSessionService (channel='bot').
func (a *BotRuntimeAdapter) EnsureBotSession(ctx context.Context, userID, botID, threadID string) (string, error) {
	if a.sessionService == nil {
		if threadID != "" {
			return threadID, nil
		}
		return botID, nil
	}
	sid := strings.TrimSpace(threadID)
	if sid == "" {
		sid = botID
	}
	_, err := a.sessionService.Get(ctx, &session.GetRequest{
		AppName:   adkAppName,
		UserID:    userID,
		SessionID: sid,
	})
	if err == nil {
		return sid, nil
	}
	resp, err := a.sessionService.Create(ctx, &session.CreateRequest{
		AppName:   adkAppName,
		UserID:    userID,
		SessionID: sid,
		State: map[string]any{
			"channel": "bot",
			"bot_id":  botID,
		},
	})
	if err != nil {
		return sid, err
	}
	if resp != nil && resp.Session != nil {
		return resp.Session.ID(), nil
	}
	return sid, nil
}

// ExecuteBotTurn instancia o llmagent isolado do bot e executa um turno via adk/v2/runner.Runner.
func (a *BotRuntimeAdapter) ExecuteBotTurn(ctx context.Context, req bots.BotRuntimeRequest) (*bots.BotRuntimeResult, error) {
	if a.routedLLM == nil {
		return nil, fmt.Errorf("RoutedLLM não configurado no BotRuntimeAdapter")
	}
	if req.Bot == nil {
		return nil, fmt.Errorf("Bot é obrigatório para ExecuteBotTurn")
	}

	var memories []string
	for _, m := range req.Bot.Memories {
		if m.IsActive && strings.TrimSpace(m.Content) != "" {
			memories = append(memories, m.Content)
		}
	}

	execCtx := buildBotToolExecutionContext(req.UserID, req.Bot, req.ActionPolicies)

	schema := req.OutputSchema
	if schema == nil && req.FiringFrame != "" {
		schema = BotRunReportOutputSchema()
	}

	ag, _, err := BuildBotLLMAgent(a.routedLLM, a.bridge, BotAgentConfig{
		BotID:             req.Bot.ID,
		Name:              req.Bot.Title,
		Goal:              req.Bot.Goal,
		FiringFrame:       req.FiringFrame,
		Rules:             req.Bot.Rules,
		SkillsMarkdown:    req.SkillsMarkdown,
		BotMemories:       memories,
		LastRuns:          req.LastRuns,
		ConnectedActions:  req.ConnectedActions,
		LockedActions:     req.LockedActions,
		AllowedActionKeys: req.AllowedActionKeys,
		ExecutionContext:  execCtx,
		ExtraTools:        req.ExtraTools,
		OutputSchema:      schema,
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao instanciar llmagent do bot: %w", err)
	}

	var plugins []*plugin.Plugin
	if a.guardrail != nil {
		if p, pErr := a.guardrail.BuildADKPlugin(); pErr == nil && p != nil {
			plugins = append(plugins, p)
		}
	}

	r, err := runner.New(runner.Config{
		AppName:           adkAppName,
		Agent:             ag,
		SessionService:    a.sessionService,
		AutoCreateSession: true,
		PluginConfig: runner.PluginConfig{
			Plugins: plugins,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao inicializar runner do bot: %w", err)
	}

	threadID := strings.TrimSpace(req.ThreadID)
	if threadID == "" {
		threadID = req.Bot.ID
	}
	channel := strings.TrimSpace(req.Channel)
	if channel == "" {
		channel = "bot"
	}
	maxCalls := req.MaxLLMCalls
	if maxCalls <= 0 {
		maxCalls = 5
	}

	collector := &TurnCollector{}
	meta := &TurnExecutionMeta{
		UserID:            req.UserID,
		ThreadID:          threadID,
		TurnID:            uuid.NewString(),
		BotID:             req.Bot.ID,
		BotActionPolicies: req.ActionPolicies,
		Channel:           channel,
	}
	runCtx := WithTurnExecutionMeta(ctx, meta)
	runCtx = context.WithValue(runCtx, collectorContextKey{}, collector)

	stateDelta := map[string]any{
		"channel":                    channel,
		"bot_id":                     req.Bot.ID,
		"bot_action_policies":        req.ActionPolicies,
		"tainted_by_untrusted_input": false,
		"static_system_prompt":       BuildBotInstruction(req.Bot.ID, BotAgentConfig{BotID: req.Bot.ID, Name: req.Bot.Title, Goal: req.Bot.Goal, FiringFrame: req.FiringFrame, Rules: req.Bot.Rules, SkillsMarkdown: req.SkillsMarkdown, BotMemories: memories, LastRuns: req.LastRuns, ConnectedActions: req.ConnectedActions, LockedActions: req.LockedActions}),
	}

	userContent := genai.NewContentFromText(req.Prompt, genai.RoleUser)
	var finalParts []string
	for ev, runErr := range r.Run(
		runCtx,
		req.UserID,
		threadID,
		userContent,
		agent.RunConfig{MaxLLMCalls: maxCalls},
		runner.WithStateDelta(stateDelta),
	) {
		if runErr != nil {
			return nil, runErr
		}
		if ev == nil || ev.Partial || ev.Content == nil || ev.Content.Role != genai.RoleModel {
			continue
		}
		for _, p := range ev.Content.Parts {
			if p != nil && !p.Thought && strings.TrimSpace(p.Text) != "" {
				finalParts = append(finalParts, p.Text)
			}
		}
	}

	collector.Mu.Lock()
	res := &bots.BotRuntimeResult{
		Cards:                 append([]domain.ChatCard(nil), collector.Cards...),
		ExecutedTools:         append([]domain.ExecutedTool(nil), collector.ExecutedTools...),
		RequiresConfirmation:  collector.RequiresConfirmation,
		PendingConfirmationID: collector.PendingConfirmationID,
	}
	if collector.PendingConfirmationID != "" {
		res.PendingIDs = []string{collector.PendingConfirmationID}
	}
	if collector.RequiresConfirmation && collector.SuspendedPromptText != "" {
		res.Text = collector.SuspendedPromptText
	} else if len(finalParts) > 0 {
		res.Text = strings.TrimSpace(finalParts[len(finalParts)-1])
	}
	collector.Mu.Unlock()

	meta.Mu.Lock()
	res.ModelUsed = meta.ModelDisplayName
	if res.ModelUsed == "" {
		res.ModelUsed = meta.ModelUsed
	}
	res.ProviderUsed = meta.ProviderUsed
	res.TokensIn = meta.TokensIn
	res.TokensOut = meta.TokensOut
	meta.Mu.Unlock()

	return res, nil
}

func buildBotToolExecutionContext(userID string, bot *domain.Bot, policies map[string]domain.ActionPolicy) *domain.ToolExecutionContext {
	execCtx := &domain.ToolExecutionContext{
		UserID:            userID,
		BotID:             bot.ID,
		Channel:           "bot",
		AllowedOperations: make(map[domain.ToolsetName][]string),
		ActionPolicies:    policies,
	}
	tsSeen := make(map[domain.ToolsetName]bool)
	for actKey, pol := range policies {
		if pol == domain.ActionPolicyOff {
			continue
		}
		spec, ok := domain.ActionCatalog[actKey]
		if !ok || spec.Toolset == "" {
			continue
		}
		tsName := domain.ToolsetName(spec.Toolset)
		if !tsSeen[tsName] {
			tsSeen[tsName] = true
			execCtx.AllowedToolsets = append(execCtx.AllowedToolsets, tsName)
		}
		execCtx.AllowedOperations[tsName] = append(execCtx.AllowedOperations[tsName], spec.Operations...)
	}
	return execCtx
}
