package gmail

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/andrevmp/vito/backend/internal/domain"
)

type GmailServiceContract interface {
	SendEmail(ctx context.Context, userID, to, subject, body string) error
	CreateDraft(ctx context.Context, userID, to, subject, body string) error
	ScanEmails(ctx context.Context, userID string) (*domain.GmailScanResult, error)
}

type GmailToolset struct {
	gmailService   GmailServiceContract
	entityResolver domain.EntityLinkResolver
}

func NewGmailToolset(svc GmailServiceContract) *GmailToolset {
	return &GmailToolset{gmailService: svc}
}

// SetEntityLinkResolver conecta o resolvedor cross-canal para traduzir nomes/apelidos em endereços de e-mail.
func (t *GmailToolset) SetEntityLinkResolver(resolver domain.EntityLinkResolver) {
	t.entityResolver = resolver
}

func (t *GmailToolset) Name() domain.ToolsetName {
	return domain.ToolsetGmail
}

func (t *GmailToolset) Description() string {
	return "Interage com o Gmail do usuário: pesquisa mensagens, cria rascunhos e envia e-mails (com confirmação humana)."
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
		cleanTo := strings.TrimSpace(params.To)
		if cleanTo != "" && !strings.Contains(cleanTo, "@") && t.entityResolver != nil {
			if links, err := t.entityResolver.Resolve(ctx, execCtx.UserID, cleanTo); err == nil {
				for _, el := range links {
					if strings.Contains(el.Email, "@") {
						cleanTo = strings.TrimSpace(el.Email)
						break
					}
				}
			}
		}
		if cleanTo == "" || !strings.Contains(cleanTo, "@") {
			return &domain.ToolExecutionResult{
				Status:        "ERROR",
				SummaryForLLM: fmt.Sprintf("Não foi possível enviar o e-mail: o endereço %q não é um e-mail válido (ex: nome@empresa.com). Por favor, informe o e-mail do destinatário.", params.To),
			}, nil
		}
		if t.gmailService != nil {
			if err := t.gmailService.SendEmail(ctx, execCtx.UserID, cleanTo, params.Subject, params.Body); err != nil {
				return &domain.ToolExecutionResult{
					Status:        "ERROR",
					SummaryForLLM: fmt.Sprintf("Não foi possível enviar o e-mail pelo Gmail: %v", err),
				}, nil
			}
		}
		subj := params.Subject
		if subj == "" {
			subj = "Mensagem enviada pelo Vito"
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: fmt.Sprintf("E-mail enviado com sucesso para %s com assunto %q.", cleanTo, subj),
			Cards: []domain.ChatCard{{
				ID:          "gmail-sent",
				Type:        "gmail",
				Title:       subj,
				Subtitle:    fmt.Sprintf("Enviado para: %s", cleanTo),
				ActionLabel: "Enviado",
			}},
		}, nil

	default: // "search_emails"
		if t.gmailService != nil {
			scan, err := t.gmailService.ScanEmails(ctx, execCtx.UserID)
			if err == nil && scan != nil {
				var sb strings.Builder
				sb.WriteString("Varredura recente do Gmail:\n")
				found := 0
				for _, b := range scan.Bills {
					dueStr := "a definir"
					if b.DueDate != nil {
						dueStr = b.DueDate.Format("02/01/2006")
					}
					sb.WriteString(fmt.Sprintf("- [FATURA] %s: R$ %.2f (Vence: %s, Beneficiário: %s)\n", b.Subject, b.AmountBRL, dueStr, b.Beneficiary))
					found++
				}
				for _, f := range scan.Flights {
					sb.WriteString(fmt.Sprintf("- [VOO] %s (%s -> %s, Cód: %s)\n", f.Airline, f.Origin, f.Destination, f.BookingCode))
					found++
				}
				for _, u := range scan.UrgentEmails {
					sb.WriteString(fmt.Sprintf("- [E-MAIL] %s: %s (De: %s)\n", u.Subject, u.Snippet, u.From))
					found++
				}
				if found > 0 {
					return &domain.ToolExecutionResult{
						Status:                "COMPLETED",
						SummaryForLLM:         sb.String(),
						MarksContextAsTainted: true,
						TaintSourceLabel:      "gmail_untrusted_inbox",
					}, nil
				}
			}
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: fmt.Sprintf("Nenhum e-mail ou fatura recente encontrado com o termo %q.", params.Query),
		}, nil
	}
}

// BotActions declara as ações de Gmail disponíveis para Bots (Plano 04 §3 / Fase 5).
func (t *GmailToolset) BotActions() []domain.BotActionSpec {
	return []domain.BotActionSpec{
		{
			AppKey:      "gmail",
			ActionKey:   "gmail:mailr",
			Label:       "Ler e-mails",
			Description: "Pesquisa e lê e-mails recentes na caixa de entrada do Gmail.",
			IsWrite:     false,
			AlwaysAsk:   false,
			Operations:  []string{"search_emails", "scan_emails"},
		},
		{
			AppKey:      "gmail",
			ActionKey:   "gmail:draft",
			Label:       "Rascunhar resposta",
			Description: "Cria um rascunho de e-mail no Gmail sem enviar.",
			IsWrite:     false,
			AlwaysAsk:   false,
			Operations:  []string{"create_draft"},
		},
		{
			AppKey:      "gmail",
			ActionKey:   "gmail:mailsend",
			Label:       "Enviar e-mail",
			Description: "Envia um e-mail pelo Gmail (sempre pede aprovação).",
			IsWrite:     true,
			AlwaysAsk:   true,
			Operations:  []string{"send_email"},
		},
	}
}

// NewGmailToolsetFromService constrói o GmailToolset diretamente a partir de *GmailService.
func NewGmailToolsetFromService(svc *GmailService) *GmailToolset {
	if svc == nil {
		return NewGmailToolset(nil)
	}
	return NewGmailToolset(&gmailServiceAdapter{svc: svc})
}

type gmailServiceAdapter struct {
	svc *GmailService
}

func (a *gmailServiceAdapter) SendEmail(ctx context.Context, userID, to, subject, body string) error {
	cleanSubj := strings.TrimSpace(subject)
	if cleanSubj == "" {
		cleanSubj = "Mensagem enviada pelo Vito"
	}
	_, err := a.svc.SendEmail(ctx, userID, to, cleanSubj, body)
	return err
}

func (a *gmailServiceAdapter) CreateDraft(ctx context.Context, userID, to, subject, body string) error {
	_, err := a.svc.CreateDraft(ctx, userID, to, subject, body)
	return err
}

func (a *gmailServiceAdapter) ScanEmails(ctx context.Context, userID string) (*domain.GmailScanResult, error) {
	return a.svc.ScanEmails(ctx, userID)
}
