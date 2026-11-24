package adkengine

import (
	"context"
	"strings"

	"google.golang.org/adk/v2/session"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

func (f *ADKLoopFacade) resolveUserPersonaAndAutonomy(req domain.UnifiedAssistantRequest, userID string) (string, ai.PersonaStyle, string) {
	userName := "você"
	personaStyle := ai.StyleBalanced
	autonomyLevel := ""

	if f.userRepo != nil && userID != "" {
		if u, err := f.userRepo.GetByID(userID); err == nil && u != nil && u.Name != "" {
			fields := strings.Fields(u.Name)
			if len(fields) > 0 {
				userName = fields[0]
			}
		}
	}
	if req.StyleOverride != "" {
		personaStyle = ai.PersonaStyle(req.StyleOverride)
	} else if f.aiSettingsRepo != nil && userID != "" {
		if s, err := f.aiSettingsRepo.GetSettings(userID); err == nil && s != nil && s.PersonaStyle != "" {
			personaStyle = ai.PersonaStyle(s.PersonaStyle)
		}
	}

	if service.IsExplicitSendConfirmationText(req.Message) {
		autonomyLevel = "confirmed"
	} else if f.aiSettingsRepo != nil && userID != "" {
		if st, err := f.aiSettingsRepo.GetSettings(userID); err == nil && st != nil && st.AutonomyMode == domain.AutonomyModeProactive {
			autonomyLevel = "autonomous_write"
		}
	}

	return userName, personaStyle, autonomyLevel
}

func (f *ADKLoopFacade) synthesizeFallbackAnswer(
	ctx context.Context,
	req domain.UnifiedAssistantRequest,
	threadID, staticPrompt, volatileContext string,
	executedTools []domain.ExecutedTool,
) string {
	var toolSummaries []string
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

	if len(executedTools) > 0 && f.cfg.Router != nil {
		synthReq := ai.AgentChatRequest{
			ThreadID:     threadID,
			UserID:       req.UserID,
			Channel:      req.Channel,
			Task:         ai.TaskChat,
			SystemPrompt: staticPrompt + "\n\n" + volatileContext + "\n\nDIRETRIZ MANDATÓRIA: Sintetize os dados factuais obtidos pelas ferramentas acima diretamente para o usuário em texto claro, objetivo e em português.",
			Messages: []ai.TurnMessage{
				{Role: ai.RoleUser, Content: req.Message},
				{Role: ai.RoleTool, Content: strings.Join(toolSummaries, "\n\n")},
			},
		}
		if prov, err := f.cfg.Router.SelectProvider(ctx, synthReq); err == nil && prov != nil {
			if synthResp, err := prov.Chat(ctx, synthReq); err == nil && synthResp != nil && strings.TrimSpace(synthResp.Text) != "" {
				return strings.TrimSpace(synthResp.Text)
			}
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
