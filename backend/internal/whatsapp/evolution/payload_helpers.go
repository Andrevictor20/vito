package evolution

import (
	"encoding/json"
	"github.com/andrevmp/vito/backend/internal/domain"
	"sort"
	"strings"
)

// NormalizeJIDForSend normaliza o JID para envio de mensagens pela Evolution API.
// Em conversas 1-on-1 (@s.whatsapp.net), remove o sufixo de dispositivo multi-device (:33, :1, etc.).
func NormalizeJIDForSend(jid string) string {
	trimmed := strings.TrimSpace(jid)
	if trimmed == "" {
		return ""
	}
	if strings.HasSuffix(trimmed, "@s.whatsapp.net") {
		parts := strings.Split(trimmed, "@")
		userPart := strings.Split(parts[0], ":")[0]
		return userPart + "@s.whatsapp.net"
	}
	if !strings.Contains(trimmed, "@") && strings.Contains(trimmed, ":") {
		return strings.Split(trimmed, ":")[0]
	}
	return trimmed
}

// PhoneDigits extrai apenas os dígitos de um JID/telefone.
func PhoneDigits(raw string) string {
	return domain.PhoneDigits(raw)
}

// SubtypesOf devolve as sub-mensagens do payload `message` por nome.
func SubtypesOf(raw json.RawMessage) map[string]json.RawMessage {
	out := map[string]json.RawMessage{}
	if len(raw) == 0 {
		return out
	}
	_ = json.Unmarshal(raw, &out)
	return out
}

// MessageSubtypePriority ordena as sub-mensagens para extração determinística de texto.
func MessageSubtypePriority(subtypes map[string]json.RawMessage) []string {
	priority := []string{
		"conversation",
		"extendedTextMessage",
		"imageMessage",
		"videoMessage",
		"audioMessage",
		"documentMessage",
		"buttonsMessage",
		"listMessage",
	}
	ordered := make([]string, 0, len(subtypes))
	seen := make(map[string]bool, len(subtypes))
	for _, name := range priority {
		if _, ok := subtypes[name]; ok {
			ordered = append(ordered, name)
			seen[name] = true
		}
	}
	rest := make([]string, 0)
	for name := range subtypes {
		if !seen[name] && name != "reactionMessage" {
			rest = append(rest, name)
		}
	}
	sort.Strings(rest)
	return append(ordered, rest...)
}

// ExtractQuotedContext lê o `contextInfo.quotedMessage` de uma sub-mensagem.
func ExtractQuotedContext(raw json.RawMessage, textExtractor func(json.RawMessage) string) (string, string) {
	var payload struct {
		ContextInfo *struct {
			Participant   string          `json:"participant"`
			QuotedMessage json.RawMessage `json:"quotedMessage"`
		} `json:"contextInfo"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil || payload.ContextInfo == nil {
		return "", ""
	}
	if len(payload.ContextInfo.QuotedMessage) == 0 {
		return "", ""
	}
	var text string
	if textExtractor != nil {
		text = textExtractor(payload.ContextInfo.QuotedMessage)
	}
	return text, strings.TrimSpace(payload.ContextInfo.Participant)
}
