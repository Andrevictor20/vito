package whatsapp

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
	waService      WhatsAppServiceContract
	entityResolver domain.EntityLinkResolver
}

func NewWhatsAppToolset(svc WhatsAppServiceContract) *WhatsAppToolset {
	return &WhatsAppToolset{waService: svc}
}

// NewWhatsAppToolsetContract cria o contrato WhatsAppServiceContract conectando serviço e diretório.
func NewWhatsAppToolsetContract(svc *WhatsAppService, dir *WhatsAppDirectoryService) WhatsAppServiceContract {
	return &whatsAppServiceAdapter{svc: svc, dir: dir}
}

// NewWhatsAppToolsetFromService constrói o WhatsAppToolset diretamente a partir de *WhatsAppService e *WhatsAppDirectoryService.
func NewWhatsAppToolsetFromService(svc *WhatsAppService, dir *WhatsAppDirectoryService) *WhatsAppToolset {
	if svc == nil {
		return NewWhatsAppToolset(nil)
	}
	return NewWhatsAppToolset(NewWhatsAppToolsetContract(svc, dir))
}

type whatsAppServiceAdapter struct {
	svc *WhatsAppService
	dir *WhatsAppDirectoryService
}

func (a *whatsAppServiceAdapter) SendMessage(ctx context.Context, userID, phone, message string) error {
	target := strings.TrimSpace(phone)
	if target == "" {
		return fmt.Errorf("destinatário do WhatsApp é obrigatório")
	}
	if strings.Contains(target, "@s.whatsapp.net") || strings.Contains(target, "@g.us") {
		return a.svc.SendWhatsAppMessage(ctx, userID, NormalizeJIDForSend(target), message)
	}
	if len(domain.PhoneDigits(target)) >= 8 {
		if normalized := domain.NormalizePhone(target); normalized != "" {
			cleanDigits := strings.TrimPrefix(normalized, "+")
			return a.svc.SendWhatsAppMessage(ctx, userID, cleanDigits+"@s.whatsapp.net", message)
		}
	}
	if a.dir != nil {
		chat, err := a.dir.ResolveChat(ctx, userID, target)
		if err == nil && chat != nil && chat.ChatJID != "" {
			return a.svc.SendWhatsAppMessage(ctx, userID, NormalizeJIDForSend(chat.ChatJID), message)
		}
	}
	return fmt.Errorf("contato %q não encontrado na sua agenda do WhatsApp. Por favor, confirme o número com DDD", target)
}

func (a *whatsAppServiceAdapter) SearchMessages(ctx context.Context, userID, query string, limit int) ([]domain.WhatsAppConversationMessage, error) {
	if a.dir != nil {
		return a.dir.SearchMessages(ctx, userID, query, limit)
	}
	return nil, nil
}

func (a *whatsAppServiceAdapter) RecentChats(ctx context.Context, userID string) ([]ai.ChatContactSummary, error) {
	if a.dir != nil {
		return a.dir.Directory(ctx, userID)
	}
	return nil, nil
}

// SetEntityLinkResolver conecta o resolvedor cross-canal para traduzir nomes/apelidos em JID/telefone.
func (t *WhatsAppToolset) SetEntityLinkResolver(resolver domain.EntityLinkResolver) {
	t.entityResolver = resolver
}

func (t *WhatsAppToolset) Name() domain.ToolsetName {
	return domain.ToolsetWhatsApp
}

func (t *WhatsAppToolset) Description() string {
	return "Interage com o WhatsApp: consulta conversas e envia mensagens para contatos (com confirmação humana)."
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
		recipient := strings.TrimSpace(params.Recipient)
		if recipient != "" && !strings.Contains(recipient, "@") && t.entityResolver != nil {
			if links, err := t.entityResolver.Resolve(ctx, execCtx.UserID, recipient); err == nil {
				for _, el := range links {
					if strings.TrimSpace(el.Phone) != "" {
						recipient = strings.TrimSpace(el.Phone)
						break
					}
					if strings.TrimSpace(el.WhatsAppJID) != "" {
						recipient = strings.TrimSpace(el.WhatsAppJID)
						break
					}
				}
			}
		}
		if t.waService != nil {
			if err := t.waService.SendMessage(ctx, execCtx.UserID, recipient, params.Message); err != nil {
				return &domain.ToolExecutionResult{
					Status:        "ERROR",
					SummaryForLLM: fmt.Sprintf("Não foi possível enviar a mensagem no WhatsApp: %v", err),
				}, nil
			}
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: fmt.Sprintf("Mensagem WhatsApp enviada com sucesso para %s: %q.", recipient, params.Message),
			Cards: []domain.ChatCard{{
				ID:          "wa-sent",
				Type:        "whatsapp",
				Title:       recipient,
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

// BotActions declara as ações de WhatsApp disponíveis para Bots (Plano 04 §3 / Fase 5).
func (t *WhatsAppToolset) BotActions() []domain.BotActionSpec {
	return []domain.BotActionSpec{
		{
			AppKey:      "wa",
			ActionKey:   "wa:waread",
			Label:       "Ler conversas e mensagens",
			Description: "Pesquisa conversas e mensagens recentes no WhatsApp.",
			IsWrite:     false,
			AlwaysAsk:   false,
			Operations:  []string{"search_messages", "recent_chats"},
		},
		{
			AppKey:      "wa",
			ActionKey:   "wa:wasend",
			Label:       "Enviar mensagem",
			Description: "Envia uma mensagem pelo WhatsApp (sempre pede aprovação).",
			IsWrite:     true,
			AlwaysAsk:   true,
			Operations:  []string{"send_message"},
		},
	}
}
