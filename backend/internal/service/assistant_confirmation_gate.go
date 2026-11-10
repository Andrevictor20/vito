package service

import (
	"strings"

	"github.com/andrevmp/vito/backend/internal/ai"
)

// isExplicitSendConfirmation verifica se a mensagem atual do usuário é uma confirmação expressa para envio de mensagem/e-mail.
// A IA NUNCA deve enviar e-mails ou mensagens externas sem essa aprovação expressa.
func isExplicitSendConfirmation(input ai.UserInput) bool {
	raw := strings.TrimSpace(input.Text)
	lower := strings.ToLower(raw)

	// 1. Ações determinísticas disparadas pelos botões de envio dos cards no chat
	if strings.HasPrefix(lower, "enviar e-mail para ") ||
		strings.HasPrefix(lower, "enviar email para ") ||
		strings.HasPrefix(lower, "enviar mensagem whatsapp para ") ||
		strings.HasPrefix(lower, "enviar whatsapp para ") ||
		strings.HasPrefix(lower, "confirmar e enviar whatsapp para ") ||
		strings.HasPrefix(lower, "confirmar e enviar mensagem whatsapp para ") ||
		strings.HasPrefix(lower, "confirmar e enviar e-mail para ") ||
		strings.HasPrefix(lower, "confirmar e enviar email para ") ||
		strings.HasPrefix(lower, "confirmar envio de ") ||
		strings.HasPrefix(lower, "confirmar envio para ") {
		return true
	}

	// 2. Comandos inequívocos de envio imediato
	explicitPhrases := []string{
		"sim, pode enviar", "sim pode enviar", "pode enviar", "pode mandar",
		"pode disparar", "sim, pode mandar", "sim pode mandar", "confirmo o envio",
		"confirmar envio", "confirmar e enviar", "aprovo o envio", "aprovado, envie",
		"está aprovado, pode mandar", "envie agora", "mande agora", "dispare agora",
		"envia agora", "manda agora", "pode enviar a mensagem", "pode enviar o e-mail",
		"pode enviar o email", "pode mandar o email", "pode mandar o e-mail",
		"pode mandar a mensagem",
	}
	for _, phrase := range explicitPhrases {
		if strings.Contains(lower, phrase) {
			return true
		}
	}

	// Comandos compostos com "agora" explícito (ex: "melhora a proposta e manda pro Marcos agora")
	if strings.Contains(lower, "agora") &&
		(strings.Contains(lower, "manda") || strings.Contains(lower, "envia") ||
			strings.Contains(lower, "mande") || strings.Contains(lower, "envie") ||
			strings.Contains(lower, "dispare")) {
		return true
	}

	// 3. Afirmações curtas ("sim", "envia", "manda") quando o último turno do assistente perguntou se podia enviar
	shortAcks := []string{"sim", "envia", "manda", "confirmo", "ok", "beleza, manda", "pode ir", "manda ver"}
	isShortAck := false
	for _, ack := range shortAcks {
		if lower == ack || strings.HasPrefix(lower, ack+" ") || strings.HasPrefix(lower, ack+",") || strings.HasPrefix(lower, ack+"!") || strings.HasPrefix(lower, ack+".") {
			isShortAck = true
			break
		}
	}

	if isShortAck {
		// Checa histórico de conversa clássico
		if len(input.ConversationHistory) > 0 {
			for i := len(input.ConversationHistory) - 1; i >= 0; i-- {
				hist := input.ConversationHistory[i]
				sender := strings.ToLower(strings.TrimSpace(hist.Sender))
				if sender == "vito" || sender == "assistant" {
					prevText := strings.ToLower(hist.Text)
					if isConfirmationPrompt(prevText) {
						return true
					}
					break
				}
			}
		}
		// Checa janela de conversa do WhatsApp
		if len(input.ConversationWindow) > 0 {
			for i := len(input.ConversationWindow) - 1; i >= 0; i-- {
				win := input.ConversationWindow[i]
				sender := strings.ToLower(strings.TrimSpace(win.Sender))
				if sender == "vito" || sender == "assistant" {
					prevText := strings.ToLower(win.Text)
					if isConfirmationPrompt(prevText) {
						return true
					}
					break
				}
			}
		}
	}

	return false
}

func isConfirmationPrompt(prevText string) bool {
	return strings.Contains(prevText, "posso enviar") ||
		strings.Contains(prevText, "deseja que eu envie") ||
		strings.Contains(prevText, "rascunho de e-mail") ||
		strings.Contains(prevText, "rascunho para") ||
		strings.Contains(prevText, "mensagem aprimorada") ||
		strings.Contains(prevText, "não enviei") ||
		strings.Contains(prevText, "quer que eu envie") ||
		strings.Contains(prevText, "você confirma o envio") ||
		strings.Contains(prevText, "preparei a mensagem para") ||
		strings.Contains(prevText, "preparei o e-mail para") ||
		strings.Contains(prevText, "preparei o rascunho")
}

// IsExplicitSendConfirmationText avalia se o texto em si é uma confirmação expressa (para AgentLoop / Chat / Voz).
func IsExplicitSendConfirmationText(text string) bool {
	raw := strings.TrimSpace(text)
	lower := strings.ToLower(raw)

	if strings.HasPrefix(lower, "enviar e-mail para ") ||
		strings.HasPrefix(lower, "enviar email para ") ||
		strings.HasPrefix(lower, "enviar mensagem whatsapp para ") ||
		strings.HasPrefix(lower, "enviar whatsapp para ") ||
		strings.HasPrefix(lower, "confirmar e enviar whatsapp para ") ||
		strings.HasPrefix(lower, "confirmar e enviar mensagem whatsapp para ") ||
		strings.HasPrefix(lower, "confirmar e enviar e-mail para ") ||
		strings.HasPrefix(lower, "confirmar e enviar email para ") ||
		strings.HasPrefix(lower, "confirmar envio de ") ||
		strings.HasPrefix(lower, "confirmar envio para ") {
		return true
	}

	explicitPhrases := []string{
		"sim, pode enviar", "sim pode enviar", "pode enviar", "pode mandar",
		"pode disparar", "sim, pode mandar", "sim pode mandar", "confirmo o envio",
		"confirmar envio", "confirmar e enviar", "aprovo o envio", "aprovado, envie",
		"está aprovado, pode mandar", "envie agora", "mande agora", "dispare agora",
		"envia agora", "manda agora", "pode enviar a mensagem", "pode enviar o e-mail",
		"pode enviar o email", "pode mandar o email", "pode mandar o e-mail",
		"pode mandar a mensagem", "sim", "confirmo", "manda ver", "pode ir",
		"beleza, manda", "sim, confirmo", "sim confirmo",
	}
	for _, phrase := range explicitPhrases {
		if lower == phrase || strings.HasPrefix(lower, phrase+" ") || strings.HasPrefix(lower, phrase+",") || strings.HasPrefix(lower, phrase+"!") || strings.HasPrefix(lower, phrase+".") {
			return true
		}
	}

	if strings.Contains(lower, "agora") &&
		(strings.Contains(lower, "manda") || strings.Contains(lower, "envia") ||
			strings.Contains(lower, "mande") || strings.Contains(lower, "envie") ||
			strings.Contains(lower, "dispare")) {
		return true
	}

	return false
}

// IsExplicitSendCancellationText avalia se o usuário está cancelando a ação pendente.
func IsExplicitSendCancellationText(text string) bool {
	raw := strings.TrimSpace(text)
	lower := strings.ToLower(raw)
	cancelPhrases := []string{
		"não", "nao", "cancela", "cancelar", "cancela o envio", "não envia", "nao envia",
		"não manda", "nao manda", "deixa pra lá", "deixa pra la", "esquece", "abortar",
		"cancela isso", "não quero enviar", "nao quero enviar",
	}
	for _, phrase := range cancelPhrases {
		if lower == phrase || strings.HasPrefix(lower, phrase+" ") || strings.HasPrefix(lower, phrase+",") || strings.HasPrefix(lower, phrase+"!") || strings.HasPrefix(lower, phrase+".") {
			return true
		}
	}
	return false
}

// tryReconstructConfirmationIntent tenta recuperar a intenção anterior caso o usuário esteja apenas confirmando no WhatsApp.
func tryReconstructConfirmationIntent(input ai.UserInput) *ai.ParsedIntent {
	var lastAssistantText string
	for i := len(input.ConversationHistory) - 1; i >= 0; i-- {
		h := input.ConversationHistory[i]
		s := strings.ToLower(strings.TrimSpace(h.Sender))
		if s == "vito" || s == "assistant" {
			lastAssistantText = h.Text
			break
		}
	}
	if lastAssistantText == "" && len(input.ConversationWindow) > 0 {
		for i := len(input.ConversationWindow) - 1; i >= 0; i-- {
			w := input.ConversationWindow[i]
			s := strings.ToLower(strings.TrimSpace(w.Sender))
			if s == "vito" || s == "assistant" {
				lastAssistantText = w.Text
				break
			}
		}
	}
	if lastAssistantText == "" {
		return nil
	}

	// 1. Proposta de WhatsApp: "Preparei a mensagem para <Contato>:\n\n<Texto>\n\nPosso enviar?"
	if strings.Contains(lastAssistantText, "Preparei a mensagem para ") {
		lines := strings.Split(lastAssistantText, "\n")
		var contact string
		var bodyParts []string
		collecting := false
		for _, line := range lines {
			trimmed := strings.TrimSpace(line)
			if strings.HasPrefix(trimmed, "Preparei a mensagem para ") {
				contact = strings.TrimPrefix(trimmed, "Preparei a mensagem para ")
				contact = strings.TrimSuffix(contact, ":")
				contact = strings.TrimSpace(contact)
				collecting = true
				continue
			}
			if collecting {
				if strings.Contains(trimmed, "Posso enviar?") {
					break
				}
				if trimmed != "" {
					bodyParts = append(bodyParts, trimmed)
				}
			}
		}
		if contact != "" && len(bodyParts) > 0 {
			return &ai.ParsedIntent{
				Action: ai.ActionSendWhatsAppMessage,
				WhatsAppMessage: &ai.ParsedWhatsAppMessage{
					Chat: contact,
					Text: strings.Join(bodyParts, "\n"),
				},
			}
		}
	}

	// 2. Proposta de E-mail: "Preparei o e-mail para <To> (Assunto: "<Subj>"):\n\n<Body>\n\nPosso enviar?"
	// ou "Preparei o rascunho do e-mail para..."
	if strings.Contains(lastAssistantText, "e-mail para ") || strings.Contains(lastAssistantText, "email para ") {
		lines := strings.Split(lastAssistantText, "\n")
		var to string
		var subj string
		var bodyParts []string
		collecting := false
		for _, line := range lines {
			trimmed := strings.TrimSpace(line)
			if strings.Contains(trimmed, "e-mail para ") || strings.Contains(trimmed, "email para ") {
				idx := strings.Index(trimmed, "para ")
				if idx >= 0 {
					rest := trimmed[idx+5:]
					if sIdx := strings.Index(rest, "("); sIdx >= 0 {
						to = strings.TrimSpace(rest[:sIdx])
						if subjIdx := strings.Index(rest, "Assunto:"); subjIdx >= 0 {
							sRest := rest[subjIdx+8:]
							sRest = strings.Trim(sRest, " \t\r\n:\"')")
							subj = sRest
						}
					} else {
						to = strings.TrimSpace(strings.TrimSuffix(rest, ":"))
					}
				}
				collecting = true
				continue
			}
			if collecting {
				if strings.Contains(trimmed, "Posso enviar?") {
					break
				}
				if trimmed != "" {
					bodyParts = append(bodyParts, trimmed)
				}
			}
		}
		if to != "" && len(bodyParts) > 0 {
			return &ai.ParsedIntent{
				Action: ai.ActionSendEmail,
				EmailMessage: &ai.ParsedEmailMessage{
					To:      to,
					Subject: subj,
					Body:    strings.Join(bodyParts, "\n"),
				},
			}
		}
	}

	return nil
}
