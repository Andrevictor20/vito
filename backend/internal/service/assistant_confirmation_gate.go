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

	if isShortAck && len(input.ConversationHistory) > 0 {
		for i := len(input.ConversationHistory) - 1; i >= 0; i-- {
			hist := input.ConversationHistory[i]
			sender := strings.ToLower(strings.TrimSpace(hist.Sender))
			if sender == "vito" || sender == "assistant" {
				prevText := strings.ToLower(hist.Text)
				if strings.Contains(prevText, "posso enviar") ||
					strings.Contains(prevText, "deseja que eu envie") ||
					strings.Contains(prevText, "rascunho de e-mail") ||
					strings.Contains(prevText, "rascunho para") ||
					strings.Contains(prevText, "mensagem aprimorada") ||
					strings.Contains(prevText, "não enviei") ||
					strings.Contains(prevText, "quer que eu envie") {
					return true
				}
				break
			}
		}
	}

	return false
}
