package service

import (
	"encoding/json"
	"regexp"
	"sort"
	"strings"
	"time"
)

// vitoSignatures são as assinaturas que o próprio Vito usa nas respostas.
// Também servem para reconhecer (e arquivar) as mensagens que ele mesmo enviou.
var vitoSignatures = []string{"💼 Vito:", "🎩 Vito:", "🤖 Vito:", "Vito diz:", "Vito:"}
var reVitoSignature = regexp.MustCompile(`(?i)^[💼🎩🤖]?\s*vito(\([^)]*\))?:`)

// IsVitoMessage informa se o texto é uma resposta gerada pelo próprio Vito.
func IsVitoMessage(text string) bool {
	trimmed := strings.TrimSpace(text)
	if reVitoSignature.MatchString(trimmed) {
		return true
	}
	for _, sig := range vitoSignatures {
		if strings.HasPrefix(trimmed, sig) {
			return true
		}
	}
	return false
}

// StripVitoSignature remove a assinatura do Vito do texto e devolve o conteúdo limpo.
func StripVitoSignature(text string) (string, bool) {
	trimmed := strings.TrimSpace(text)
	if loc := reVitoSignature.FindStringIndex(trimmed); loc != nil && loc[0] == 0 {
		return strings.TrimSpace(trimmed[loc[1]:]), true
	}
	for _, sig := range vitoSignatures {
		if strings.HasPrefix(trimmed, sig) {
			return strings.TrimSpace(strings.TrimPrefix(trimmed, sig)), true
		}
	}
	return trimmed, false
}

// inboundMessage é uma mensagem recebida do WhatsApp já normalizada.
type inboundMessage struct {
	MessageID      string
	RemoteJID      string
	RemoteJIDAlt   string
	FromMe         bool
	Participant    string
	ParticipantAlt string
	PushName       string
	MessageType    string
	Text           string
	QuotedText     string
	QuotedAuthor   string
	Timestamp      time.Time
	IsAudio        bool
	IsImage        bool
	IsReaction     bool
	ImageMime      string
	QuotedID       string
	MediaPayload   interface{}
}

// TestInboundMessage exporta campos essenciais para testes.
type TestInboundMessage struct {
	Text        string
	Participant string
	RemoteJID   string
	FromMe      bool
}

// ParseInboundMessageForTest normaliza uma mensagem para validação em testes de regressão.
func ParseInboundMessageForTest(data json.RawMessage) (*TestInboundMessage, error) {
	msg, err := parseInboundMessage(data)
	if err != nil {
		return nil, err
	}
	return &TestInboundMessage{
		Text:        msg.Text,
		Participant: msg.Participant,
		RemoteJID:   msg.RemoteJID,
		FromMe:      msg.FromMe,
	}, nil
}

// unwrapMessageSubtypes desembala envelopes comuns do WhatsApp como ephemeralMessage e viewOnceMessage.
func unwrapMessageSubtypes(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return raw
	}
	var wrapper struct {
		EphemeralMessage struct {
			Message json.RawMessage `json:"message"`
		} `json:"ephemeralMessage"`
		ViewOnceMessage struct {
			Message json.RawMessage `json:"message"`
		} `json:"viewOnceMessage"`
		ViewOnceMessageV2 struct {
			Message json.RawMessage `json:"message"`
		} `json:"viewOnceMessageV2"`
		DocumentWithCaptionMessage struct {
			Message json.RawMessage `json:"message"`
		} `json:"documentWithCaptionMessage"`
	}
	if err := json.Unmarshal(raw, &wrapper); err == nil {
		if len(wrapper.EphemeralMessage.Message) > 0 {
			return unwrapMessageSubtypes(wrapper.EphemeralMessage.Message)
		}
		if len(wrapper.ViewOnceMessage.Message) > 0 {
			return unwrapMessageSubtypes(wrapper.ViewOnceMessage.Message)
		}
		if len(wrapper.ViewOnceMessageV2.Message) > 0 {
			return unwrapMessageSubtypes(wrapper.ViewOnceMessageV2.Message)
		}
		if len(wrapper.DocumentWithCaptionMessage.Message) > 0 {
			return unwrapMessageSubtypes(wrapper.DocumentWithCaptionMessage.Message)
		}
	}
	return raw
}

// parseInboundMessage normaliza o payload `messages.upsert` da Evolution API.
//
// A Evolution entrega o texto em formatos diferentes conforme o tipo da mensagem
// (`conversation`, `extendedTextMessage.text`, legendas de mídia) e a mensagem citada
// em `contextInfo.quotedMessage` — presente em qualquer subtipo. Por isso a leitura do
// `contextInfo` é feita por varredura genérica das sub-mensagens.
func parseInboundMessage(data json.RawMessage) (*inboundMessage, error) {
	var raw struct {
		Key struct {
			RemoteJID      string `json:"remoteJid"`
			RemoteJIDAlt   string `json:"remoteJidAlt"`
			FromMe         bool   `json:"fromMe"`
			ID             string `json:"id"`
			Participant    string `json:"participant"`
			ParticipantAlt string `json:"participantAlt"`
		} `json:"key"`
		PushName         string          `json:"pushName"`
		MessageType      string          `json:"messageType"`
		Message          json.RawMessage `json:"message"`
		MessageTimestamp int64           `json:"messageTimestamp"`
		ContextInfo      *struct {
			StanzaID      string          `json:"stanzaId"`
			QuotedMessage json.RawMessage `json:"quotedMessage"`
		} `json:"contextInfo"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}

	rawMessage := unwrapMessageSubtypes(raw.Message)

	remoteJID := strings.TrimSpace(raw.Key.RemoteJID)
	if strings.HasSuffix(remoteJID, "@lid") && strings.HasSuffix(strings.TrimSpace(raw.Key.RemoteJIDAlt), "@s.whatsapp.net") {
		remoteJID = strings.TrimSpace(raw.Key.RemoteJIDAlt)
	}
	participant := strings.TrimSpace(raw.Key.Participant)
	if strings.HasSuffix(participant, "@lid") && strings.HasSuffix(strings.TrimSpace(raw.Key.ParticipantAlt), "@s.whatsapp.net") {
		participant = strings.TrimSpace(raw.Key.ParticipantAlt)
	}

	msg := &inboundMessage{
		MessageID:      raw.Key.ID,
		RemoteJID:      remoteJID,
		RemoteJIDAlt:   strings.TrimSpace(raw.Key.RemoteJIDAlt),
		FromMe:         raw.Key.FromMe,
		Participant:    participant,
		ParticipantAlt: strings.TrimSpace(raw.Key.ParticipantAlt),
		PushName:       strings.TrimSpace(raw.PushName),
		MessageType:    raw.MessageType,
		MediaPayload:   data,
	}
	if raw.MessageTimestamp > 0 {
		msg.Timestamp = time.Unix(raw.MessageTimestamp, 0).UTC()
	}

	subtypes := subtypesOf(rawMessage)
	if len(rawMessage) > 0 {
		for _, name := range messageSubtypePriority(subtypes) {
			sub := subtypes[name]
			if text := extractMessageText(sub); text != "" && msg.Text == "" {
				msg.Text = text
			}
			quoted, author := extractQuotedContext(sub)
			if quoted != "" && msg.QuotedText == "" {
				msg.QuotedText = quoted
				msg.QuotedAuthor = author
			}
			if msg.QuotedID == "" {
				msg.QuotedID = extractQuotedID(sub)
			}
		}
		// O `contextInfo` também pode vir no nível de `message` (irmão do
		// subtipo) — é assim que a Evolution entrega em conversa simples.
		if msg.QuotedID == "" {
			msg.QuotedID = extractQuotedID(rawMessage)
		}
		if msg.QuotedText == "" {
			if quoted, author := extractQuotedContext(rawMessage); quoted != "" {
				msg.QuotedText = quoted
				msg.QuotedAuthor = author
			}
		}
		if msg.MessageType == "" {
			for _, name := range []string{"audioMessage", "imageMessage", "videoMessage", "extendedTextMessage", "conversation"} {
				if _, ok := subtypes[name]; ok {
					msg.MessageType = name
					break
				}
			}
		}
	}

	_, hasAudio := subtypes["audioMessage"]
	msg.IsAudio = hasAudio || strings.EqualFold(raw.MessageType, "audioMessage")

	_, hasReaction := subtypes["reactionMessage"]
	msg.IsReaction = hasReaction || strings.EqualFold(raw.MessageType, "reactionMessage")
	if msg.IsReaction {
		msg.Text = ""
	}

	msg.IsImage, msg.ImageMime = detectInboundImage(subtypes, raw.MessageType)

	// O `contextInfo` pode vir no topo do payload (não aninhado em message.<subtype>).
	if raw.ContextInfo != nil {
		if msg.QuotedID == "" {
			msg.QuotedID = strings.TrimSpace(raw.ContextInfo.StanzaID)
		}
		if msg.QuotedText == "" && len(raw.ContextInfo.QuotedMessage) > 0 {
			msg.QuotedText = extractMessageText(raw.ContextInfo.QuotedMessage)
		}
	}

	return msg, nil
}

// detectInboundImage identifica mensagens de imagem e o mime da mídia.
//
// A Evolution entrega a imagem em `imageMessage`; fotos enviadas "uma vez" vêm
// aninhadas em `viewOnceMessage`; e uma foto enviada como documento chega em
// `documentMessage` com mime de imagem.
func detectInboundImage(subtypes map[string]json.RawMessage, messageType string) (bool, string) {
	if raw, ok := subtypes["imageMessage"]; ok {
		return true, mediaMimeOf(raw)
	}
	if raw, ok := subtypes["viewOnceMessage"]; ok {
		// {"message": {"imageMessage": {...}}}
		var wrapper struct {
			Message map[string]json.RawMessage `json:"message"`
		}
		if err := json.Unmarshal(raw, &wrapper); err == nil {
			if inner, ok := wrapper.Message["imageMessage"]; ok {
				return true, mediaMimeOf(inner)
			}
		}
	}
	if raw, ok := subtypes["documentMessage"]; ok {
		mime := mediaMimeOf(raw)
		if strings.HasPrefix(strings.ToLower(mime), "image/") {
			return true, mime
		}
	}
	if strings.Contains(strings.ToLower(messageType), "image") {
		return true, ""
	}
	return false, ""
}

// mediaMimeOf lê o mime declarado pela Evolution na mídia.
func mediaMimeOf(raw json.RawMessage) string {
	var payload struct {
		MimeType string `json:"mimetype"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return ""
	}
	return strings.TrimSpace(payload.MimeType)
}

// subtypesOf devolve as sub-mensagens do payload `message` por nome.
func subtypesOf(raw json.RawMessage) map[string]json.RawMessage {
	out := map[string]json.RawMessage{}
	if len(raw) == 0 {
		return out
	}
	_ = json.Unmarshal(raw, &out)
	return out
}

// messageSubtypePriority ordena as sub-mensagens para extração determinística de texto.
func messageSubtypePriority(subtypes map[string]json.RawMessage) []string {
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

// extractQuotedContext lê o `contextInfo.quotedMessage` de uma sub-mensagem.
func extractQuotedContext(raw json.RawMessage) (string, string) {
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
	text := extractMessageText(payload.ContextInfo.QuotedMessage)
	return text, strings.TrimSpace(payload.ContextInfo.Participant)
}

// extractQuotedID lê o `contextInfo.stanzaId` — a identidade da mensagem citada.
//
// É o que permite resolver a mensagem marcada ("responder a esta mensagem")
// mesmo quando ela é antiga, ou quando é uma imagem/áudio (o texto citado é
// vazio e só o id permite achar a mensagem arquivada).
func extractQuotedID(raw json.RawMessage) string {
	var payload struct {
		ContextInfo *struct {
			StanzaID string `json:"stanzaId"`
		} `json:"contextInfo"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil || payload.ContextInfo == nil {
		return ""
	}
	return strings.TrimSpace(payload.ContextInfo.StanzaID)
}
