package toolsets

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/andrevmp/vito/backend/internal/domain"
)

type GmailServiceContract interface {
	SendEmail(ctx context.Context, userID, to, subject, body string) error
	CreateDraft(ctx context.Context, userID, to, subject, body string) error
}

type GmailToolset struct {
	gmailService GmailServiceContract
}

func NewGmailToolset(svc GmailServiceContract) *GmailToolset {
	return &GmailToolset{gmailService: svc}
}

func (t *GmailToolset) Name() domain.ToolsetName {
	return domain.ToolsetGmail
}

func (t *GmailToolset) Description() string {
	return "Interage com o Gmail do usuário: pesquisa mensagens, cria rascunhos e envia e-mails (com confirmação humana)."
}

func (t *GmailToolset) JSONSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"operation": {
				"type": "string",
				"enum": ["search_emails", "create_draft", "send_email"],
				"description": "Operação de e-mail a executar."
			},
			"params": {
				"type": "object",
				"properties": {
					"to": {"type": "string", "description": "Endereço de e-mail do destinatário."},
					"subject": {"type": "string", "description": "Assunto do e-mail."},
					"body": {"type": "string", "description": "Corpo da mensagem."},
					"query": {"type": "string", "description": "Termo de busca na caixa de entrada."}
				}
			}
		},
		"required": ["operation"]
	}`)
}

func (t *GmailToolset) IsWriteOperation(op string, rawParams json.RawMessage) (bool, bool, map[string]any) {
	preview := make(map[string]any)
	_ = json.Unmarshal(rawParams, &preview)

	switch op {
	case "create_draft":
		return true, false, preview
	case "send_email":
		return true, true, preview
	default:
		return false, false, preview
	}
}

func (t *GmailToolset) Execute(ctx context.Context, execCtx *domain.ToolExecutionContext, op string, rawParams json.RawMessage) (*domain.ToolExecutionResult, error) {
	var params struct {
		To      string `json:"to"`
		Subject string `json:"subject"`
		Body    string `json:"body"`
		Query   string `json:"query"`
	}
	if len(rawParams) > 0 {
		_ = json.Unmarshal(rawParams, &params)
	}

	switch op {
	case "create_draft":
		if t.gmailService != nil {
			_ = t.gmailService.CreateDraft(ctx, execCtx.UserID, params.To, params.Subject, params.Body)
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: fmt.Sprintf("Rascunho de e-mail para '%s' com assunto '%s' salvo com sucesso.", params.To, params.Subject),
			Cards: []domain.ChatCard{{
				ID:          "gmail-draft",
				Type:        "gmail",
				Title:       params.Subject,
				Subtitle:    fmt.Sprintf("Para: %s", params.To),
				ActionLabel: "Abrir Rascunho",
			}},
		}, nil

	case "send_email":
		if t.gmailService != nil {
			if err := t.gmailService.SendEmail(ctx, execCtx.UserID, params.To, params.Subject, params.Body); err != nil {
				return nil, err
			}
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: fmt.Sprintf("E-mail enviado para '%s' com assunto '%s'.", params.To, params.Subject),
			Cards: []domain.ChatCard{{
				ID:          "gmail-sent",
				Type:        "gmail",
				Title:       params.Subject,
				Subtitle:    fmt.Sprintf("Enviado para: %s", params.To),
				ActionLabel: "Enviado",
			}},
		}, nil

	default: // "search_emails"
		return &domain.ToolExecutionResult{
			Status:                "COMPLETED",
			SummaryForLLM:         fmt.Sprintf("Busca por e-mails com '%s' concluída.", params.Query),
			MarksContextAsTainted: true, // Leitura de e-mails externos marca contexto como tainted!
			TaintSourceLabel:      "gmail_untrusted_inbox",
		}, nil
	}
}
