package service

import "strings"

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
		"pode criar", "sim, pode criar", "sim pode criar",
		"cria o bot", "crie o bot", "pode fazer", "sim, pode fazer", "sim pode fazer",
		"confirmar", "confirma", "beleza, pode criar", "ok, pode criar", "sim, cria",
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

// IsShortConfirmationReply reconhece também respostas curtas afirmativas em PT-BR quando já há uma ação pendente aguardando confirmação.
func IsShortConfirmationReply(text string) bool {
	if IsExplicitSendConfirmationText(text) {
		return true
	}
	clean := strings.TrimSpace(strings.ToLower(text))
	clean = strings.TrimRight(clean, ".!? ")
	shortReplies := map[string]bool{
		"ok": true, "okay": true, "beleza": true, "blz": true,
		"pode": true, "claro": true, "bora": true, "perfeito": true,
		"fechado": true, "isso": true, "isso mesmo": true, "exato": true,
		"faz isso": true, "faça isso": true, "faca isso": true,
		"tá bom": true, "ta bom": true, "tudo bem": true,
		"aceito": true, "autorizo": true, "pode sim": true, "sim pode": true,
		"com certeza": true, "positivo": true,
		"cria aí": true, "cria ai": true, "cria agora": true, "crie agora": true,
		"quero sim": true, "manda": true, "vai": true, "vai lá": true, "vai la": true,
	}
	return shortReplies[clean]
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
