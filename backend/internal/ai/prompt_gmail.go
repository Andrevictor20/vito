package ai

import "strings"

// GmailAssistantDirectives injeta instruções para escrita de rascunhos e envio de e-mails via Gmail.
func GmailAssistantDirectives(appStateFlags []string, recentEmails []string) string {
	hasGmail := len(recentEmails) > 0
	if !hasGmail {
		for _, f := range appStateFlags {
			if strings.Contains(strings.ToUpper(f), "GMAIL") {
				hasGmail = true
				break
			}
		}
	}
	if !hasGmail {
		return ""
	}

	return `
DIRETRIZ DE ESCRITA E ENVIO DE E-MAILS (GMAIL):
- Você pode criar rascunhos e enviar e-mails pela conta do Gmail conectada do usuário:
  1. RASCUNHO DE E-MAIL ("escreva um e-mail para...", "crie um rascunho de e-mail...", "prepare um e-mail para...", "redija um e-mail"):
     -> Use "action": "DRAFT_EMAIL" e preencha "email_message": {"to": "email@dominio.com", "subject": "Assunto claro e executivo", "body": "Texto completo do e-mail"}.
     -> O rascunho ficará salvo no Gmail do usuário sem ser disparado automaticamente.
  2. ENVIO DIRETO DE E-MAIL ("envie um e-mail para...", "mande um e-mail agora para...", "dispare o e-mail para...", "responda o e-mail de X dizendo..."):
     -> Use "action": "SEND_EMAIL" e preencha "email_message": {"to": "email@dominio.com", "subject": "Assunto claro e executivo", "body": "Texto completo do e-mail"}.
     -> Só use "SEND_EMAIL" quando o usuário pedir explicitamente para ENVIAR/MANDAR/RESPONDER o e-mail. Na dúvida entre rascunhar ou enviar, prefira "DRAFT_EMAIL".
  3. RESOLUÇÃO DO DESTINATÁRIO E COLETA PROGRESSIVA:
     -> Se o usuário pedir para responder a um e-mail recente (ex: "responda o último e-mail de fulano"), extraia o endereço de e-mail diretamente do bloco E-MAILS RECENTES (campo "De: Nome <email@dominio.com>") e use "Re: <Assunto original>" em "subject".
     -> Se o endereço de e-mail do destinatário não foi informado pelo usuário e não consta nos E-MAILS RECENTES, nas memórias ou no histórico da conversa, NUNCA invente um endereço: use "action": "NEEDS_CLARIFICATION" perguntando para qual endereço de e-mail deve enviar.
`
}
