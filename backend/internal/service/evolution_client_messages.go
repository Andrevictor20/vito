package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// WhatsAppChatMessage é uma mensagem obtida da Evolution API (backfill / janela).
type WhatsAppChatMessage struct {
	ID               string
	RemoteJID        string
	FromMe           bool
	Participant      string
	PushName         string
	MessageType      string
	Text             string
	QuotedText       string
	MessageTimestamp time.Time
	// QuotedID é o stanzaId da mensagem citada (contextInfo.stanzaId).
	QuotedID string
	// MediaKind/MediaMime descrevem a mídia da mensagem (image, audio).
	MediaKind string
	MediaMime string
	// MediaPayload é o envelope {key,message} serializado — o que permite
	// baixar a mídia DEPOIS (sem ele, uma foto antiga é ilegível para sempre).
	MediaPayload string
}

// WhatsAppGroup é um grupo retornado pela Evolution API.
type WhatsAppGroup struct {
	ID      string
	Subject string
	Size    int
}

// EvolutionFindMessagesInput parametriza a busca de mensagens na Evolution API v2.
type EvolutionFindMessagesInput struct {
	InstanceName string
	RemoteJID    string // vazio = todos os chats
	From         time.Time
	To           time.Time
	Page         int
	Offset       int
}

// FindMessages busca mensagens persistidas na Evolution API.
//
// Contrato verificado no fonte da Evolution API v2.3.7 (tag `2.3.7`):
//   - `POST /chat/findMessages/{instance}` com `where.key` ausente devolve TODOS os chats;
//   - `where.key.remoteJid` filtra um chat e `remoteJidAlt` também é considerado (tolerância a @lid);
//   - `where.messageTimestamp` só é aplicado quando `gte` E `lte` vêm juntos;
//   - a resposta vem em ordem decrescente por `messageTimestamp` e inclui `contextInfo`.
func (c *DefaultEvolutionClient) FindMessages(ctx context.Context, in EvolutionFindMessagesInput) ([]WhatsAppChatMessage, error) {
	if in.InstanceName == "" {
		return nil, fmt.Errorf("instância do Evolution API obrigatória")
	}
	offset := in.Offset
	if offset <= 0 {
		offset = 50
	}
	page := in.Page
	if page <= 0 {
		page = 1
	}

	where := map[string]interface{}{}
	if in.RemoteJID != "" {
		where["key"] = map[string]interface{}{"remoteJid": in.RemoteJID}
	}
	// A Evolution só aplica o filtro temporal quando gte E lte estão presentes.
	if !in.From.IsZero() && !in.To.IsZero() {
		where["messageTimestamp"] = map[string]interface{}{
			"gte": in.From.UTC().Format(time.RFC3339),
			"lte": in.To.UTC().Format(time.RFC3339),
		}
	}

	payload := map[string]interface{}{
		"where":  where,
		"page":   page,
		"offset": offset,
	}

	path := fmt.Sprintf("/chat/findMessages/%s", in.InstanceName)
	resp, err := c.doRequest(ctx, http.MethodPost, path, payload)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("evolution api findMessages falhou (status %d): %s", resp.StatusCode, truncateForError(string(bodyBytes)))
	}

	// A Evolution v2.3.7 responde com o envelope
	// {"messages": {total, pages, currentPage, records: [...]}}.
	// O array cru é aceito como fallback (versões/formatos diferentes).
	var envelope struct {
		Messages *struct {
			Total       int                `json:"total"`
			Pages       int                `json:"pages"`
			CurrentPage int                `json:"currentPage"`
			Records     []evolutionMessage `json:"records"`
		} `json:"messages"`
	}
	raw := make([]evolutionMessage, 0, 50)
	if err := json.Unmarshal(bodyBytes, &envelope); err == nil && envelope.Messages != nil {
		raw = envelope.Messages.Records
	} else if err := json.Unmarshal(bodyBytes, &raw); err != nil {
		return nil, fmt.Errorf("resposta do findMessages em formato inesperado: %w", err)
	}

	messages := make([]WhatsAppChatMessage, 0, len(raw))
	for _, m := range raw {
		messages = append(messages, m.toChatMessage())
	}
	return messages, nil
}

// FindGroups lista os grupos da instância com subject e número de participantes.
func (c *DefaultEvolutionClient) FindGroups(ctx context.Context, instanceName string) ([]WhatsAppGroup, error) {
	if instanceName == "" {
		return nil, fmt.Errorf("instância do Evolution API obrigatória")
	}
	path := fmt.Sprintf("/group/fetchAllGroups/%s", instanceName)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("evolution api fetchAllGroups falhou (status %d): %s", resp.StatusCode, truncateForError(string(bodyBytes)))
	}

	var raw []struct {
		ID      string `json:"id"`
		Subject string `json:"subject"`
		Size    int    `json:"size"`
	}
	if err := json.Unmarshal(bodyBytes, &raw); err != nil {
		return nil, err
	}

	groups := make([]WhatsAppGroup, 0, len(raw))
	for _, g := range raw {
		groups = append(groups, WhatsAppGroup{ID: g.ID, Subject: g.Subject, Size: g.Size})
	}
	return groups, nil
}

// FindParticipants retorna a lista de participantes de um grupo.
// `len(participants) == 1` caracteriza um grupo do WhatsApp com apenas o usuário.
func (c *DefaultEvolutionClient) FindParticipants(ctx context.Context, instanceName, groupJID string) ([]string, error) {
	if instanceName == "" || groupJID == "" {
		return nil, fmt.Errorf("instância e grupo obrigatórios")
	}
	path := fmt.Sprintf("/group/participants/%s?groupId=%s", instanceName, url.QueryEscape(groupJID))
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("evolution api findParticipants falhou (status %d): %s", resp.StatusCode, truncateForError(string(bodyBytes)))
	}

	var raw struct {
		Participants []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"participants"`
	}
	if err := json.Unmarshal(bodyBytes, &raw); err != nil {
		return nil, err
	}

	participants := make([]string, 0, len(raw.Participants))
	for _, p := range raw.Participants {
		participants = append(participants, p.ID)
	}
	return participants, nil
}

// FindOwnerJID descobre o JID do dono (número realmente pareado) da instância.
//
// Importante: o telefone cadastrado na conta Vito pode ser DIFERENTE do número do
// WhatsApp pareado (ex.: celular pessoal cadastrado no app + chip empresarial
// pareado na Evolution). Só o JID do owner da instância identifica com segurança
// o chat "Você" (note-to-self).
func (c *DefaultEvolutionClient) FindOwnerJID(ctx context.Context, instanceName string) (string, error) {
	if instanceName == "" {
		return "", fmt.Errorf("instância do Evolution API obrigatória")
	}
	resp, err := c.doRequest(ctx, http.MethodGet, "/instance/fetchInstances", nil)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("evolution api fetchInstances falhou (status %d): %s", resp.StatusCode, truncateForError(string(bodyBytes)))
	}

	var payload interface{}
	if err := json.Unmarshal(bodyBytes, &payload); err != nil {
		return "", err
	}
	if jid := findOwnerJIDIn(payload, instanceName); jid != "" {
		return jid, nil
	}
	return "", fmt.Errorf("owner da instância %s não encontrado na resposta do fetchInstances", instanceName)
}

// findOwnerJIDIn procura o JID do owner em uma resposta de fetchInstances.
// O formato variou entre versões, então a busca é tolerante: qualquer chave
// "owner"/"ownerJid" (string ou objeto com jid/id) abaixo do objeto da instância.
func findOwnerJIDIn(node interface{}, instanceName string) string {
	switch value := node.(type) {
	case map[string]interface{}:
		matchesInstance := instanceName == ""
		if name, ok := value["name"].(string); ok && name != "" {
			matchesInstance = name == instanceName
		}
		if matchesInstance {
			for _, key := range []string{"owner", "ownerJid", "jid"} {
				if jid, ok := value[key].(string); ok && strings.Contains(jid, "@s.whatsapp.net") {
					return jid
				}
				if nested, ok := value[key].(map[string]interface{}); ok {
					for _, inner := range []string{"jid", "id"} {
						if jid, ok := nested[inner].(string); ok && strings.Contains(jid, "@s.whatsapp.net") {
							return jid
						}
					}
				}
			}
		}
		for _, key := range []string{"owner", "ownerJid"} {
			if jid, ok := value[key].(string); ok && strings.Contains(jid, "@s.whatsapp.net") {
				return jid
			}
		}
		for _, child := range value {
			if jid := findOwnerJIDIn(child, instanceName); jid != "" {
				return jid
			}
		}
	case []interface{}:
		for _, item := range value {
			if jid := findOwnerJIDIn(item, instanceName); jid != "" {
				return jid
			}
		}
	}
	return ""
}

// evolutionMessage é o formato cru devolvido por findMessages.
type evolutionMessage struct {
	ID  string `json:"id"`
	Key struct {
		ID          string `json:"id"`
		RemoteJID   string `json:"remoteJid"`
		FromMe      bool   `json:"fromMe"`
		Participant string `json:"participant"`
	} `json:"key"`
	PushName         string          `json:"pushName"`
	MessageType      string          `json:"messageType"`
	Message          json.RawMessage `json:"message"`
	MessageTimestamp int64           `json:"messageTimestamp"`
	ContextInfo      *struct {
		QuotedMessage json.RawMessage `json:"quotedMessage"`
		StanzaID      string          `json:"stanzaId"`
	} `json:"contextInfo"`
}

func (m evolutionMessage) toChatMessage() WhatsAppChatMessage {
	msg := WhatsAppChatMessage{
		ID:               firstNonEmpty(m.ID, m.Key.ID),
		RemoteJID:        m.Key.RemoteJID,
		FromMe:           m.Key.FromMe,
		Participant:      m.Key.Participant,
		PushName:         m.PushName,
		MessageType:      m.MessageType,
		MessageTimestamp: time.Unix(m.MessageTimestamp, 0).UTC(),
	}
	msg.Text = extractMessageText(m.Message)
	if m.ContextInfo != nil && len(m.ContextInfo.QuotedMessage) > 0 {
		msg.QuotedText = extractMessageText(m.ContextInfo.QuotedMessage)
	}
	if m.ContextInfo != nil {
		msg.QuotedID = strings.TrimSpace(m.ContextInfo.StanzaID)
	}
	if msg.QuotedText == "" {
		// Fallback: algumas versões aninham o contextInfo dentro de message.<subtype>.
		for _, sub := range messageSubtypePriority(subtypesOf(m.Message)) {
			if quoted, _ := extractQuotedContext(subtypesOf(m.Message)[sub]); quoted != "" {
				msg.QuotedText = quoted
				break
			}
		}
	}
	msg.MediaKind, msg.MediaMime = detectMediaKind(m.Message, m.MessageType)
	msg.MediaPayload = buildMediaPayload(m)
	return msg
}

// detectMediaKind identifica a mídia da mensagem (image/audio) e o seu mime.
func detectMediaKind(message json.RawMessage, messageType string) (string, string) {
	subtypes := subtypesOf(message)
	if raw, ok := subtypes["imageMessage"]; ok {
		return domain.WhatsAppMediaKindImage, mediaMimeOf(raw)
	}
	if raw, ok := subtypes["viewOnceMessage"]; ok {
		var wrapper struct {
			Message map[string]json.RawMessage `json:"message"`
		}
		if err := json.Unmarshal(raw, &wrapper); err == nil {
			if inner, ok := wrapper.Message["imageMessage"]; ok {
				return domain.WhatsAppMediaKindImage, mediaMimeOf(inner)
			}
		}
	}
	if raw, ok := subtypes["audioMessage"]; ok {
		return domain.WhatsAppMediaKindAudio, mediaMimeOf(raw)
	}
	if raw, ok := subtypes["documentMessage"]; ok {
		if mime := mediaMimeOf(raw); strings.HasPrefix(strings.ToLower(mime), "image/") {
			return domain.WhatsAppMediaKindImage, mime
		}
	}
	switch {
	case strings.Contains(strings.ToLower(messageType), "image"):
		return domain.WhatsAppMediaKindImage, ""
	case strings.Contains(strings.ToLower(messageType), "audio"):
		return domain.WhatsAppMediaKindAudio, ""
	}
	return "", ""
}

// buildMediaPayload monta o envelope {key, message} que a Evolution API usa para
// baixar a mídia (POST /chat/getBase64FromMediaMessage). Sem esse envelope a
// mídia do histórico é irrecuperável.
func buildMediaPayload(m evolutionMessage) string {
	if detectKind, _ := detectMediaKind(m.Message, m.MessageType); detectKind == "" {
		return ""
	}
	envelope := map[string]interface{}{
		"key": map[string]interface{}{
			"id":          firstNonEmpty(m.ID, m.Key.ID),
			"remoteJid":   m.Key.RemoteJID,
			"fromMe":      m.Key.FromMe,
			"participant": m.Key.Participant,
		},
		"message": m.Message,
	}
	raw, err := json.Marshal(envelope)
	if err != nil {
		return ""
	}
	return string(raw)
}

// extractMessageText extrai o texto de uma mensagem da Evolution, tolerando os
// formatos que a API usa:
//
//	"texto simples"                                   -> string crua
//	{"conversation": "texto"}                          -> texto simples
//	{"extendedTextMessage": {"text": "texto"}}         -> texto formatado
//	{"text": "texto"}                                  -> conteúdo de um subtipo
//	{"imageMessage": {"caption": "legenda"}}            -> legenda de mídia
func extractMessageText(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}

	// 1) String crua (formato `conversation`).
	var plain string
	if err := json.Unmarshal(raw, &plain); err == nil {
		return strings.TrimSpace(plain)
	}

	// 2) Estrutura completa de mensagem.
	var full struct {
		Conversation        string `json:"conversation"`
		ExtendedTextMessage struct {
			Text string `json:"text"`
		} `json:"extendedTextMessage"`
		ImageMessage struct {
			Caption string `json:"caption"`
		} `json:"imageMessage"`
		VideoMessage struct {
			Caption string `json:"caption"`
		} `json:"videoMessage"`
	}
	if err := json.Unmarshal(raw, &full); err == nil {
		for _, candidate := range []string{
			full.Conversation,
			full.ExtendedTextMessage.Text,
			full.ImageMessage.Caption,
			full.VideoMessage.Caption,
		} {
			if trimmed := strings.TrimSpace(candidate); trimmed != "" {
				return trimmed
			}
		}
	}

	// 3) Conteúdo de um subtipo ({text} | {caption} | {title}).
	var subtype struct {
		Text    string `json:"text"`
		Caption string `json:"caption"`
		Title   string `json:"title"`
	}
	if err := json.Unmarshal(raw, &subtype); err == nil {
		for _, candidate := range []string{subtype.Text, subtype.Caption, subtype.Title} {
			if trimmed := strings.TrimSpace(candidate); trimmed != "" {
				return trimmed
			}
		}
	}

	return ""
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func truncateForError(s string) string {
	const max = 240
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}
