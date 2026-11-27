package adkengine

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"google.golang.org/adk/v2/model"
	"google.golang.org/adk/v2/plugin"
	"google.golang.org/adk/v2/plugin/retryandreflect"
	"google.golang.org/adk/v2/session"
	"google.golang.org/genai"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

func buildStandardADKPlugins(guardrail *GuardrailPlugin) ([]*plugin.Plugin, error) {
	var plugins []*plugin.Plugin
	if guardrail != nil {
		p, err := guardrail.BuildADKPlugin()
		if err != nil {
			return nil, err
		}
		if p != nil {
			plugins = append(plugins, p)
		}
	}
	rr, err := retryandreflect.New(
		retryandreflect.WithMaxRetries(2),
		retryandreflect.WithTrackingScope(retryandreflect.Invocation),
	)
	if err != nil {
		return nil, err
	}
	plugins = append(plugins, rr)
	return plugins, nil
}

func (f *ADKLoopFacade) resolveOrCreateThread(ctx context.Context, userID, rawThreadID, channel string) string {
	threadID := strings.TrimSpace(rawThreadID)
	if f.cfg.ConvRepo != nil {
		if threadID == "" {
			if thread, err := f.cfg.ConvRepo.GetOrCreateThread(ctx, userID, channel, ""); err == nil && thread != nil {
				threadID = thread.ID
			}
		} else {
			_, _ = f.cfg.ConvRepo.GetOrCreateThread(ctx, userID, channel, threadID)
		}
	}
	if threadID == "" {
		threadID = uuid.New().String()
	}
	return threadID
}

func (f *ADKLoopFacade) buildVolatileTurnContext(
	ctx context.Context,
	req domain.UnifiedAssistantRequest,
	userID string,
	startTime time.Time,
	autonomyMode domain.AutonomyMode,
	autoFocusBlocks bool,
) string {
	volatileParts := []string{ai.BuildVolatileTurnContextHeader(startTime)}
	if autonomyMode == domain.AutonomyModeProactive {
		volatileParts = append(volatileParts, "### MODO DE AUTONOMIA: PROATIVO\nVocê está operando em modo PROATIVO. Ao lidar com agenda, tarefas, links de agendamento ou organização da rotina, aja com iniciativa e execute diretamente ações seguras usando suas ferramentas, propondo e aplicando ajustes objetivos para conflitos e relatando o que foi feito. Envios externos (WhatsApp, e-mail) e exclusões continuam exigindo confirmação explícita.")
	} else {
		volatileParts = append(volatileParts, "### MODO DE AUTONOMIA: ASSISTIDO\nVocê está operando em modo ASSISTIDO. Seja consultivo antes de alterar a agenda ou executar modificações de rotina: apresente claramente a ação proposta e aguarde confirmação explícita antes de gravar mudanças ou enviar mensagens.")
	}
	if autoFocusBlocks {
		volatileParts = append(volatileParts, "### BLOCOS DE FOCO AUTOMÁTICOS: ATIVADOS\nAo organizar ou revisar a agenda do usuário, proteja janelas contínuas de concentração profunda (60 a 90 minutos), evitando fragmentar intervalos livres e sugerindo ou reservando blocos de foco quando solicitado.")
	}
	if f.contextEnricher != nil && userID != "" {
		if lvl1 := f.contextEnricher.BuildLevel1Context(ctx, userID, req.Message, startTime); lvl1 != "" {
			volatileParts = append(volatileParts, lvl1)
		}
	}
	if strings.TrimSpace(req.QuotedContext) != "" {
		volatileParts = append(volatileParts, "### CONTEXTO CITADO / TELA\n"+strings.TrimSpace(req.QuotedContext))
	}
	if req.Channel == "whatsapp" && !req.WhatsAppPrivateScope {
		volatileParts = append(volatileParts, "### ESCOPO DE PRIVACIDADE WHATSAPP\nConversa visível para terceiros: NUNCA revele dados privados de outros chats, pendências pessoais ou informações confidenciais do dono.")
	}
	return strings.Join(volatileParts, "\n\n")
}

func (f *ADKLoopFacade) seedClientHistoryIfPresent(ctx context.Context, userID, threadID string, history []domain.ConversationHistoryItem, resetHistory bool) {
	if (len(history) == 0 && !resetHistory) || f.sessionService == nil {
		return
	}
	_, _ = f.sessionService.Get(ctx, &session.GetRequest{
		AppName:   adkAppName,
		UserID:    userID,
		SessionID: threadID,
	})
	startIdx := 0
	if len(history) > 8 {
		startIdx = len(history) - 8
	}
	seed := make([]struct{ Role, Content string }, 0, len(history)-startIdx)
	for _, h := range history[startIdx:] {
		seed = append(seed, struct{ Role, Content string }{Role: h.Role, Content: h.Content})
	}
	f.sessionService.SeedClientHistoryWithReset(adkAppName, userID, threadID, seed, resetHistory)
}

func (f *ADKLoopFacade) resolveInitialEffort(ctx context.Context, userID, threadID, botID, channel string) string {
	if f.cfg.ModelResolver == nil {
		return ""
	}
	resolved, err := f.cfg.ModelResolver.Resolve(ctx, service.ModelResolveRequest{
		UserID:   userID,
		ThreadID: threadID,
		BotID:    botID,
		Channel:  channel,
	})
	if err == nil && resolved != nil {
		return resolved.Effort
	}
	return ""
}

func (f *ADKLoopFacade) resolveUserPersonaAndAutonomy(req domain.UnifiedAssistantRequest, userID string) (string, ai.PersonaStyle, string, domain.AutonomyMode, bool) {
	userName := "você"
	personaStyle := ai.StyleBalanced
	autonomyLevel := ""
	autonomyMode := domain.AutonomyModeAssisted
	autoFocusBlocks := false

	if f.userRepo != nil && userID != "" {
		if u, err := f.userRepo.GetByID(userID); err == nil && u != nil && u.Name != "" {
			fields := strings.Fields(u.Name)
			if len(fields) > 0 {
				userName = fields[0]
			}
		}
	}

	isExplicitConfirm := service.IsExplicitSendConfirmationText(req.Message)
	if isExplicitConfirm {
		autonomyLevel = "confirmed"
	}

	needsSettings := req.StyleOverride == "" || !isExplicitConfirm
	var settings *domain.AISettings
	if needsSettings && f.aiSettingsRepo != nil && userID != "" {
		if s, err := f.aiSettingsRepo.GetSettings(userID); err == nil && s != nil {
			settings = s
		}
	}

	if req.StyleOverride != "" {
		personaStyle = ai.PersonaStyle(req.StyleOverride)
	} else if settings != nil && settings.PersonaStyle != "" {
		personaStyle = ai.PersonaStyle(settings.PersonaStyle)
	}

	if settings != nil {
		if settings.AutonomyMode == domain.AutonomyModeProactive {
			autonomyMode = domain.AutonomyModeProactive
		}
		autoFocusBlocks = settings.AutoFocusBlocks
	}

	if !isExplicitConfirm && autonomyMode == domain.AutonomyModeProactive {
		autonomyLevel = "autonomous_write"
	}

	return userName, personaStyle, autonomyLevel, autonomyMode, autoFocusBlocks
}

func (f *ADKLoopFacade) synthesizeFallbackAnswer(
	ctx context.Context,
	req domain.UnifiedAssistantRequest,
	threadID, staticPrompt, volatileContext string,
	executedTools []domain.ExecutedTool,
) string {
	var toolSummaries []string
	if f.sessionService != nil {
		if sessResp, err := f.sessionService.Get(ctx, &session.GetRequest{
			AppName:   adkAppName,
			UserID:    req.UserID,
			SessionID: threadID,
		}); err == nil && sessResp != nil && sessResp.Session != nil {
			for ev := range sessResp.Session.Events().All() {
				if ev == nil || ev.Content == nil {
					continue
				}
				for _, p := range ev.Content.Parts {
					if p != nil && p.FunctionResponse != nil && p.FunctionResponse.Response != nil {
						if s, ok := p.FunctionResponse.Response["summary_for_llm"].(string); ok && strings.TrimSpace(s) != "" {
							toolSummaries = append(toolSummaries, strings.TrimSpace(s))
						}
					}
				}
			}
		}
	}

	if len(executedTools) > 0 && f.routedLLM != nil {
		sysPrompt := staticPrompt + "\n\n" + volatileContext + "\n\nDIRETRIZ MANDATÓRIA: Sintetize os dados factuais obtidos pelas ferramentas acima diretamente para o usuário em texto claro, objetivo e em português."
		synthReq := &model.LLMRequest{
			Config: &genai.GenerateContentConfig{
				SystemInstruction: genai.NewContentFromText(sysPrompt, "system"),
			},
			Contents: []*genai.Content{
				genai.NewContentFromText(req.Message, genai.RoleUser),
				genai.NewContentFromText("Dados obtidos pelas ferramentas:\n"+strings.Join(toolSummaries, "\n\n"), genai.RoleUser),
			},
		}
		meta := &TurnExecutionMeta{
			UserID:   req.UserID,
			ThreadID: threadID,
			Channel:  req.Channel,
			BotID:    req.BotID,
		}
		synthCtx := WithTurnExecutionMeta(ctx, meta)
		var synthParts []string
		for resp, err := range f.routedLLM.GenerateContent(synthCtx, synthReq, false) {
			if err != nil || resp == nil || resp.Content == nil {
				continue
			}
			for _, p := range resp.Content.Parts {
				if p != nil && !p.Thought && strings.TrimSpace(p.Text) != "" {
					synthParts = append(synthParts, strings.TrimSpace(p.Text))
				}
			}
		}
		if len(synthParts) > 0 {
			return strings.Join(synthParts, "\n")
		}
	}

	if len(toolSummaries) > 0 {
		return strings.Join(toolSummaries, "\n\n")
	}
	if len(executedTools) > 0 {
		return "Ação concluída com sucesso."
	}
	return "Não consegui obter uma resposta para essa solicitação no momento. Por favor, tente novamente."
}

// extractMessageCards extrai metadados de cards de WhatsApp e Gmail produzidos em ferramentas.
func extractMessageCards(cards []domain.ChatCard) (*domain.ChatWhatsAppMessage, *domain.ChatGmailMessage) {
	var waMsg *domain.ChatWhatsAppMessage
	var gmailMsg *domain.ChatGmailMessage
	now := time.Now().Format(time.RFC3339)
	for _, c := range cards {
		switch c.Type {
		case "whatsapp":
			waMsg = &domain.ChatWhatsAppMessage{
				ID:            c.ID,
				RecipientName: c.Title,
				Message:       c.Subtitle,
				Status:        "sent",
				SentAt:        now,
			}
		case "gmail":
			gmailMsg = &domain.ChatGmailMessage{
				ID:             c.ID,
				RecipientEmail: c.Subtitle,
				Subject:        c.Title,
				Status:         "sent",
				SentAt:         now,
			}
		}
	}
	return waMsg, gmailMsg
}
