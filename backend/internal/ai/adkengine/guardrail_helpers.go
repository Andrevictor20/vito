package adkengine

import (
	"fmt"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// FormatSuspendedAction formata a resposta e ChatCard para uma ferramenta suspensa no ConfirmationGate.
func FormatSuspendedAction(
	operation string,
	pendingID string,
	reason string,
	preview map[string]any,
) (finalAnswer string, card domain.ChatCard, waMsg *domain.ChatWhatsAppMessage, gmailMsg *domain.ChatGmailMessage) {
	switch operation {
	case "send_message":
		rec, _ := preview["recipient"].(string)
		msg, _ := preview["message"].(string)
		if rec == "" {
			rec = "o destinatário"
		}
		finalAnswer = fmt.Sprintf("Preparei a mensagem para %s:\n\n\"%s\"\n\nPosso enviar?", rec, msg)
		card = domain.ChatCard{
			ID:          pendingID,
			Type:        "whatsapp",
			Title:       fmt.Sprintf("WhatsApp para %s", rec),
			Subtitle:    msg,
			ActionLabel: "Confirmar Envio",
			Confirm:     true,
		}
		waMsg = &domain.ChatWhatsAppMessage{
			ID:            pendingID,
			RecipientName: rec,
			Message:       msg,
			Status:        "ready",
		}
	case "send_email":
		to, _ := preview["to"].(string)
		subj, _ := preview["subject"].(string)
		body, _ := preview["body"].(string)
		if subj == "" {
			subj = "Mensagem do Vito"
		}
		if to == "" {
			to = "o destinatário"
		}
		finalAnswer = fmt.Sprintf("Preparei o e-mail para %s (Assunto: \"%s\"):\n\n\"%s\"\n\nPosso enviar?", to, subj, body)
		card = domain.ChatCard{
			ID:          pendingID,
			Type:        "gmail",
			Title:       subj,
			Subtitle:    fmt.Sprintf("Para: %s", to),
			ActionLabel: "Confirmar Envio",
			Confirm:     true,
		}
		gmailMsg = &domain.ChatGmailMessage{
			ID:             pendingID,
			RecipientEmail: to,
			Subject:        subj,
			Body:           body,
			Status:         "ready",
		}
	default:
		finalAnswer = fmt.Sprintf("Preparei a ação '%s'. Para sua segurança, você confirma o envio?", operation)
		card = domain.ChatCard{
			ID:          pendingID,
			Type:        "confirm",
			Title:       fmt.Sprintf("Confirmar: %s", operation),
			Subtitle:    reason,
			ActionLabel: "Confirmar Agora",
			Confirm:     true,
		}
	}
	return
}
