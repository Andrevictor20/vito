package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// executeGmailAction despacha as ações de escrita de rascunho (DRAFT_EMAIL) e envio direto de e-mail (SEND_EMAIL) via Gmail.
func (s *AssistantService) executeGmailAction(ctx context.Context, userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	if s.gmailSvc == nil {
		res.Message = "Não consegui acessar a integração com o Gmail agora. Nada foi enviado."
		res.Reply = res.Message
		return res, nil
	}

	if intent.EmailMessage == nil || strings.TrimSpace(intent.EmailMessage.To) == "" || !strings.Contains(intent.EmailMessage.To, "@") {
		return clarificationResponse(intent, "Para qual endereço de e-mail devo enviar? Me diga o destinatário (ex: nome@empresa.com) e o que gostaria de escrever."), nil
	}

	to := strings.TrimSpace(intent.EmailMessage.To)
	body := strings.TrimSpace(intent.EmailMessage.Body)
	if body == "" {
		return clarificationResponse(intent, fmt.Sprintf("O que você gostaria de escrever no e-mail para %s?", to)), nil
	}

	subject := strings.TrimSpace(intent.EmailMessage.Subject)
	if subject == "" {
		subject = deriveDefaultEmailSubject(body)
	}

	switch intent.Action {
	case ai.ActionDraftEmail:
		_, err := s.gmailSvc.CreateDraft(ctx, userID, to, subject, body)
		if err != nil {
			log.Printf("⚠️ [AssistantService] falha ao criar rascunho no Gmail (user=%s, to=%s): %v", userID, to, err)
			res.Message = formatGmailActionError("criar o rascunho", err)
			res.Reply = res.Message
			return res, nil
		}
		if res.Message == "" || res.Message == defaultMessageFor(ai.ActionDraftEmail) {
			res.Message = fmt.Sprintf("Criei o rascunho no seu Gmail para %s com o assunto \"%s\".\n\n%s", to, subject, body)
		}
		res.Reply = res.Message
		return res, nil

	case ai.ActionSendEmail:
		_, err := s.gmailSvc.SendEmail(ctx, userID, to, subject, body)
		if err != nil {
			log.Printf("⚠️ [AssistantService] falha ao enviar e-mail pelo Gmail (user=%s, to=%s): %v", userID, to, err)
			res.Message = formatGmailActionError("enviar o e-mail", err)
			res.Reply = res.Message
			return res, nil
		}
		if res.Message == "" || res.Message == defaultMessageFor(ai.ActionSendEmail) {
			res.Message = fmt.Sprintf("E-mail enviado com sucesso para %s (Assunto: \"%s\").\n\n%s", to, subject, body)
		}
		res.Reply = res.Message
		return res, nil
	}

	return res, nil
}

func deriveDefaultEmailSubject(body string) string {
	firstLine := strings.TrimSpace(strings.Split(body, "\n")[0])
	words := strings.Fields(firstLine)
	if len(words) == 0 {
		return "Mensagem"
	}
	if len(words) > 6 {
		return strings.Join(words[:6], " ") + "..."
	}
	return strings.Join(words, " ")
}

func formatGmailActionError(actionLabel string, err error) string {
	if errors.Is(err, domain.ErrGmailNotConnected) {
		return fmt.Sprintf("Sua conta do Gmail ainda não está conectada. Conecte o Gmail na aba Perfil para que eu possa %s.", actionLabel)
	}
	if errors.Is(err, domain.ErrGmailAuthFailed) || errors.Is(err, domain.ErrGmailInvalidCredentials) {
		return fmt.Sprintf("Sua autorização do Gmail expirou ou precisa das permissões de escrita. Reconecte sua conta do Gmail na aba Perfil para que eu possa %s.", actionLabel)
	}
	return fmt.Sprintf("Não consegui %s no Gmail agora (%v). Tente novamente em instantes.", actionLabel, err)
}
