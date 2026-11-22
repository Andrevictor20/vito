package service

import (
	"context"
	"encoding/json"
	"strings"

	"google.golang.org/adk/v2/tool"
	"google.golang.org/genai"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// BotRuntimeRequest encapsula os dados necessários para executar um turno ADK isolado para um Bot.
type BotRuntimeRequest struct {
	UserID            string
	Bot               *domain.Bot
	ThreadID          string
	Channel           string
	Prompt            string
	FiringFrame       string
	SkillsMarkdown    []string
	LastRuns          []string
	ConnectedActions  []string
	LockedActions     []string
	AllowedActionKeys []string
	ActionPolicies    map[string]domain.ActionPolicy
	ExtraTools        []tool.Tool
	OutputSchema      *genai.Schema
	MaxLLMCalls       int
}

// BotRuntimeResult encapsula a resposta, métricas e artefatos HITL produzidos por um turno de Bot no ADK.
type BotRuntimeResult struct {
	Text                  string
	ModelUsed             string
	ProviderUsed          string
	TokensIn              int
	TokensOut             int
	Cards                 []domain.ChatCard
	ExecutedTools         []domain.ExecutedTool
	RequiresConfirmation  bool
	PendingConfirmationID string
	PendingIDs            []string
}

// BotADKRuntime abstrai a execução de turnos de Bots sobre o motor Google ADK v2 (evita ciclo service <-> adkengine).
type BotADKRuntime interface {
	ExecuteBotTurn(ctx context.Context, req BotRuntimeRequest) (*BotRuntimeResult, error)
	EnsureBotSession(ctx context.Context, userID, botID, threadID string) (string, error)
}

func shouldAutoSaveBotMemory(msg string) bool {
	lower := strings.ToLower(msg)
	for _, kw := range []string{"lembra", "lembre", "prefiro", "sempre", "nunca"} {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}

type botSelfConfigAdapter struct {
	chatSvc *BotChatService
	userID  string
	botID   string
}

func (a *botSelfConfigAdapter) RunNow(ctx context.Context, botID, userID string) (string, error) {
	if a.chatSvc.runner == nil {
		return "Executor de bots não configurado.", nil
	}
	rep, err := a.chatSvc.runner.RunBot(ctx, userID, botID, true)
	if err != nil {
		return "", err
	}
	return rep.Summary, nil
}

func (a *botSelfConfigAdapter) LastGaps(ctx context.Context, botID, userID string) ([]string, error) {
	if a.chatSvc.triggerRepo == nil {
		return nil, nil
	}
	logs, err := a.chatSvc.triggerRepo.ListLogsByTrigger(botID)
	if err != nil || len(logs) == 0 {
		return nil, err
	}
	var rep domain.BotRunReport
	if err := json.Unmarshal([]byte(logs[0].Payload), &rep); err == nil {
		return rep.Cant, nil
	}
	return nil, nil
}

func (a *botSelfConfigAdapter) SaveMemory(ctx context.Context, botID, userID, content, source string) error {
	return a.chatSvc.botRepo.AddMemory(ctx, &domain.BotMemory{
		BotID:   botID,
		UserID:  userID,
		Content: content,
		Source:  source,
	})
}
