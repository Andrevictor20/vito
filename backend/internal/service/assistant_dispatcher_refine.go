package service

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/andrevmp/vito/backend/internal/ai"
)

// executeRefineMessage gerencia o aprimoramento e estilização de mensagens de WhatsApp e E-mail.
func (s *AssistantService) executeRefineMessage(ctx context.Context, userID string, intent *ai.ParsedIntent, input ai.UserInput, res *AssistantResponse) (*AssistantResponse, error) {
	if intent.RefinedMessage == nil {
		res.Message = "Como você gostaria que eu melhore a mensagem? Posso deixá-la mais formal, mais concisa, corrigir a ortografia ou ajustar o tom."
		res.Reply = res.Message
		return res, nil
	}

	ref := intent.RefinedMessage
	refinedText := strings.TrimSpace(ref.RefinedText)
	if refinedText == "" {
		refinedText = strings.TrimSpace(intent.Message)
	}
	if refinedText == "" {
		return clarificationResponse(intent, "Qual texto você gostaria que eu aprimore? Me envie o rascunho ou me diga o que deseja melhorar."), nil
	}

	channel := strings.ToLower(strings.TrimSpace(ref.Channel))
	target := strings.TrimSpace(ref.Target)
	subject := strings.TrimSpace(ref.Subject)

	// Se não veio canal explícito, infere por target (@ = email, senão whatsapp/geral)
	if channel == "" {
		if strings.Contains(target, "@") {
			channel = "email"
		} else {
			channel = "whatsapp"
		}
	}

	// 1. Envio Imediato ("Melhora e manda!")
	if ref.SendNow {
		if channel == "email" && target != "" && strings.Contains(target, "@") {
			if s.gmailSvc != nil {
				if subject == "" {
					subject = deriveDefaultEmailSubject(refinedText)
				}
				_, err := s.gmailSvc.SendEmail(ctx, userID, target, subject, refinedText)
				if err != nil {
					log.Printf("⚠️ [AssistantService] falha ao enviar e-mail refinado (user=%s, to=%s): %v", userID, target, err)
					res.Message = formatGmailActionError("enviar o e-mail aprimorado", err)
					res.Reply = res.Message
					return res, nil
				}
				res.Message = fmt.Sprintf("Ajustei o e-mail e enviei com sucesso para %s (Assunto: \"%s\"):\n\n%s", target, subject, refinedText)
				res.Reply = res.Message
				return res, nil
			}
		}

		if channel == "whatsapp" && target != "" && s.waSender != nil && s.waDirectory != nil {
			chat, err := s.waDirectory.ResolveChat(ctx, userID, target)
			if err == nil && chat != nil {
				if err := s.waSender.SendWhatsAppMessage(ctx, userID, chat.ChatJID, refinedText); err != nil {
					log.Printf("⚠️ [AssistantService] falha ao enviar WhatsApp refinado (user=%s, chat=%s): %v", userID, chat.ChatJID, err)
					res.Message = "Não consegui enviar a mensagem agora. Nada foi enviado — tente de novo em instantes."
					res.Reply = res.Message
					return res, nil
				}
				res.Message = fmt.Sprintf("Ajustei a mensagem e enviei para %s:\n\n%s", s.waDirectory.LabelOf(chat), refinedText)
				res.Reply = res.Message
				return res, nil
			}
		}
	}

	// 2. Modo Rascunho (apenas exibe a versão aprimorada e opcionalmente salva no Gmail)
	if channel == "email" {
		if s.gmailSvc != nil && target != "" && strings.Contains(target, "@") {
			if subject == "" {
				subject = deriveDefaultEmailSubject(refinedText)
			}
			_, _ = s.gmailSvc.CreateDraft(ctx, userID, target, subject, refinedText)
		}
		if target != "" {
			subjLabel := ""
			if subject != "" {
				subjLabel = fmt.Sprintf(" (Assunto: \"%s\")", subject)
			}
			res.Message = fmt.Sprintf("Rascunho de e-mail aprimorado para %s%s (não enviei):\n\n%s", target, subjLabel, refinedText)
		} else {
			res.Message = fmt.Sprintf("Rascunho de e-mail aprimorado (não enviei):\n\n%s", refinedText)
		}
		res.Reply = res.Message
		return res, nil
	}

	// WhatsApp / Geral
	if target != "" {
		res.Message = fmt.Sprintf("Mensagem aprimorada para %s (não enviei):\n\n%s", target, refinedText)
	} else {
		res.Message = fmt.Sprintf("Mensagem aprimorada (não enviei):\n\n%s", refinedText)
	}
	res.Reply = res.Message
	return res, nil
}
