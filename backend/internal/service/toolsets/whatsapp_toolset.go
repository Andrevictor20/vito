package toolsets

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

type WhatsAppServiceContract interface {
	SendMessage(ctx context.Context, userID, phone, message string) error
	SearchMessages(ctx context.Context, userID, query string, limit int) ([]domain.WhatsAppConversationMessage, error)
	RecentChats(ctx context.Context, userID string) ([]ai.ChatContactSummary, error)
}

type WhatsAppToolset struct {
	waService WhatsAppServiceContract
}

func NewWhatsAppToolset(svc WhatsAppServiceContract) *WhatsAppToolset {
	return &WhatsAppToolset{waService: svc}
}

func (t *WhatsAppToolset) Name() domain.ToolsetName {
	return domain.ToolsetWhatsApp
}

func (t *WhatsAppToolset) Description() string {
	return "Interage com o WhatsApp: consulta conversas e envia mensagens para contatos (com confirmação humana)."
}

func (t *WhatsAppToolset) JSONSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"operation": {
				"type": "string",
				"enum": ["search_messages", "recent_chats", "send_message"],
				"description": "Operação no WhatsApp."
			},
			"params": {
				"type": "object",
				"properties": {
					"recipient": {"type": "string", "description": "Nome ou telefone do destinatário."},
					"message": {"type": "string", "description": "Texto da mensagem a enviar."},
					"query": {"type": "string", "description": "Termo para busca de mensagens."}
				}
			}
		},
		"required": ["operation"]
	}`)
}

func (t *WhatsAppToolset) IsWriteOperation(op string, rawParams json.RawMessage) (bool, bool, map[string]any) {
	preview := make(map[string]any)
	_ = json.Unmarshal(rawParams, &preview)

	switch op {
	case "send_message":
		return true, true, preview
	default:
		return false, false, preview
	}
}

func (t *WhatsAppToolset) Execute(ctx context.Context, execCtx *domain.ToolExecutionContext, op string, rawParams json.RawMessage) (*domain.ToolExecutionResult, error) {
	var params struct {
		Recipient string `json:"recipient"`
		Message   string `json:"message"`
		Query     string `json:"query"`
	}
	if len(rawParams) > 0 {
		_ = json.Unmarshal(rawParams, &params)
	}

	switch op {
	case "send_message":
		if t.waService != nil {
			if err := t.waService.SendMessage(ctx, execCtx.UserID, params.Recipient, params.Message); err != nil {
				return nil, err
			}
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: fmt.Sprintf("Mensagem WhatsApp enviada para %s.", params.Recipient),
			Cards: []domain.ChatCard{{
				ID:          "wa-sent",
				Type:        "whatsapp",
				Title:       fmt.Sprintf("WhatsApp para %s", params.Recipient),
				Subtitle:    params.Message,
				ActionLabel: "Enviado",
			}},
		}, nil

	case "search_messages":
		if t.waService != nil && strings.TrimSpace(params.Query) != "" {
			msgs, err := t.waService.SearchMessages(ctx, execCtx.UserID, params.Query, 6)
			if err == nil && len(msgs) > 0 {
				var sb strings.Builder
				sb.WriteString(fmt.Sprintf("Mensagens encontradas no WhatsApp sobre %q:\n", params.Query))
				for _, m := range msgs {
					sender := m.SenderName
					if m.FromMe {
						sender = "Você"
					} else if sender == "" {
						sender = "Contato"
					}
					txt := m.Text
					if txt == "" {
						txt = m.MediaText
					}
					sb.WriteString(fmt.Sprintf("- [%s] %s: %s\n", m.CreatedAt.Format("02/01 15:04"), sender, txt))
				}
				return &domain.ToolExecutionResult{
					Status:                "COMPLETED",
					SummaryForLLM:         sb.String(),
					MarksContextAsTainted: true,
					TaintSourceLabel:      "whatsapp_external_messages",
				}, nil
			}
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: fmt.Sprintf("Nenhuma mensagem encontrada no histórico do WhatsApp contendo %q.", params.Query),
		}, nil

	default: // "recent_chats"
		if t.waService != nil {
			chats, err := t.waService.RecentChats(ctx, execCtx.UserID)
			if err == nil && len(chats) > 0 {
				var sb strings.Builder
				sb.WriteString("Conversas recentes no WhatsApp:\n")
				limit := 6
				if len(chats) < limit {
					limit = len(chats)
				}
				for _, c := range chats[:limit] {
					line := fmt.Sprintf("- %s", c.Name)
					if c.Preview != "" {
						line += fmt.Sprintf(": %s", c.Preview)
					}
					sb.WriteString(line + "\n")
				}
				return &domain.ToolExecutionResult{
					Status:        "COMPLETED",
					SummaryForLLM: sb.String(),
				}, nil
			}
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: "Nenhuma conversa recente encontrada no WhatsApp.",
		}, nil
	}
}
