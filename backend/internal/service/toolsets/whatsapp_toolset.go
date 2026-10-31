package toolsets

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/andrevmp/vito/backend/internal/domain"
)

type WhatsAppServiceContract interface {
	SendMessage(ctx context.Context, userID, phone, message string) error
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
		return &domain.ToolExecutionResult{
			Status:                "COMPLETED",
			SummaryForLLM:         fmt.Sprintf("Busca no WhatsApp por '%s' concluída.", params.Query),
			MarksContextAsTainted: true, // Leitura de mensagens de terceiros marca contexto como tainted!
			TaintSourceLabel:      "whatsapp_external_messages",
		}, nil

	default: // "recent_chats"
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: "Conversas recentes recuperadas.",
		}, nil
	}
}
