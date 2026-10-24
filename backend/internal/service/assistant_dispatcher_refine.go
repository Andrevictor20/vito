package service

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// executeRefineMessage gerencia o aprimoramento e estilização de mensagens de WhatsApp e E-mail.
// REGRA DE OURO: Se o texto for isolado (sem destinatário), apenas devolve a versão melhorada.
// Se houver destinatário, NUNCA envia sem confirmação explícita prévia.
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

	target := strings.TrimSpace(ref.Target)
	subject := strings.TrimSpace(ref.Subject)
	channel := strings.ToLower(strings.TrimSpace(ref.Channel))

	// Caso A: Mensagem isolada sem destinatário (ex: "de forma mais formal a seguinte mensagem...")
	// Retorna apenas a resposta estilizada, sem inventar destinatários e sem disparar integrações.
	if target == "" {
		directiveLabel := "Aqui está a mensagem ajustada"
		switch strings.ToLower(strings.TrimSpace(ref.Directive)) {
		case "formal":
			directiveLabel = "Aqui está a versão formal"
		case "concise":
			directiveLabel = "Aqui está a versão concisa"
		case "expand":
			directiveLabel = "Aqui está a versão detalhada"
		case "grammar":
			directiveLabel = "Aqui está a versão corrigida"
		case "commercial":
			directiveLabel = "Aqui está a versão comercial"
		case "friendly":
			directiveLabel = "Aqui está a versão amigável"
		}
		res.Message = fmt.Sprintf("%s (não enviei):\n\n%s", directiveLabel, refinedText)
		res.Reply = res.Message
		return res, nil
	}

	// Caso B: Mensagem com destinatário identificado
	if channel == "" {
		if strings.Contains(target, "@") {
			channel = "email"
		} else {
			channel = "whatsapp"
		}
	}

	if channel == "email" {
		if subject == "" {
			subject = deriveDefaultEmailSubject(refinedText)
		}

		// Envio real somente com confirmação humana explícita
		if ref.SendNow && isExplicitSendConfirmation(input) {
			if s.gmailSvc != nil {
				_, err := s.gmailSvc.SendEmail(ctx, userID, target, subject, refinedText)
				if err != nil {
					log.Printf("⚠️ [AssistantService] falha ao enviar e-mail refinado (user=%s, to=%s): %v", userID, target, err)
					res.Message = formatGmailActionError("enviar o e-mail aprimorado", err)
					res.Reply = res.Message
					return res, nil
				}
				res.GmailMessage = &domain.ChatGmailMessage{
					RecipientEmail: target,
					Subject:        subject,
					Body:           refinedText,
					Status:         "sent",
					SentAt:         time.Now().Format(time.RFC3339),
				}
				res.Message = fmt.Sprintf("Ajustei o e-mail e enviei com sucesso para %s (Assunto: \"%s\").", target, subject)
				res.Reply = res.Message
				return res, nil
			}
		}

		// Modo Prévia Segura (cria rascunho e exibe card com botão de envio)
		if s.gmailSvc != nil && strings.Contains(target, "@") {
			_, _ = s.gmailSvc.CreateDraft(ctx, userID, target, subject, refinedText)
		}
		res.GmailMessage = &domain.ChatGmailMessage{
			RecipientEmail: target,
			Subject:        subject,
			Body:           refinedText,
			Status:         "ready",
		}
		subjLabel := ""
		if subject != "" {
			subjLabel = fmt.Sprintf(" (Assunto: \"%s\")", subject)
		}
		res.Message = fmt.Sprintf("Rascunho de e-mail aprimorado para %s%s (não enviei):\n\n%s\n\nPosso enviar?", target, subjLabel, refinedText)
		res.Reply = res.Message
		return res, nil
	}

	// Canal WhatsApp
	targetLabel := target
	var chatJID string
	if s.waDirectory != nil {
		if chat, err := s.waDirectory.ResolveChat(ctx, userID, target); err == nil && chat != nil {
			targetLabel = s.waDirectory.LabelOf(chat)
			chatJID = chat.ChatJID
		}
	}

	// Envio real somente com confirmação expressa
	if ref.SendNow && isExplicitSendConfirmation(input) && chatJID != "" && s.waSender != nil {
		if err := s.waSender.SendWhatsAppMessage(ctx, userID, chatJID, refinedText); err != nil {
			log.Printf("⚠️ [AssistantService] falha ao enviar WhatsApp refinado (user=%s, chat=%s): %v", userID, chatJID, err)
			res.Message = "Não consegui enviar a mensagem agora. Nada foi enviado — tente de novo em instantes."
			res.Reply = res.Message
			return res, nil
		}
		res.WhatsAppMessage = &domain.ChatWhatsAppMessage{
			RecipientName:  targetLabel,
			RecipientPhone: chatJID,
			Message:        refinedText,
			Status:         "sent",
			SentAt:         time.Now().Format(time.RFC3339),
		}
		res.Message = fmt.Sprintf("Ajustei a mensagem e enviei para %s:\n\n%s", targetLabel, refinedText)
		res.Reply = res.Message
		return res, nil
	}

	// Modo Prévia Segura WhatsApp
	res.WhatsAppMessage = &domain.ChatWhatsAppMessage{
		RecipientName:  targetLabel,
		RecipientPhone: chatJID,
		Message:        refinedText,
		Status:         "ready",
	}
	res.Message = fmt.Sprintf("Rascunho de mensagem para %s (não enviei):\n\n%s\n\nPosso enviar?", targetLabel, refinedText)
	res.Reply = res.Message
	return res, nil
}
