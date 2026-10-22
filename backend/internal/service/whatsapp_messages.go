package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// reVitoTrigger detecta menções explícitas ao Vito nas mensagens.
var reVitoTrigger = regexp.MustCompile(`(?i)(@vito|!vito|/vito|vito:)\s*`)

// imageAnalysisPrompt é o pedido padrão quando a imagem chega sem legenda.
const imageAnalysisPrompt = "Analise esta imagem e me diga o que ela contém. Se for um documento, recibo, comprovante ou evento, extraia os dados (datas, valores, títulos) e sugira a ação correspondente."

// imageUnavailablePrompt é usado quando a mídia não pôde ser baixada: o Vito
// avisa em vez de inventar o conteúdo da imagem.
const imageUnavailablePrompt = "Não consegui baixar a imagem desta mensagem. Responda ao usuário, de forma breve, que não foi possível ler a imagem e sugira reenviá-la."

// handleMessagesEvent processa um evento `messages.upsert` da Evolution API.
//
// Fluxo (SPEC §5):
//  1. parse da mensagem e transcrição de áudio (Groq Whisper)
//  2. classificação do chat (self | self_group | group | direct)
//  3. arquivamento no shadow inbox — SEMPRE, mesmo em mensagens que não acionam o Vito
//  4. decisão de resposta conforme o gatilho do tipo de chat
//  5. montagem do contexto (mensagem citada + janela) e chamada ao assistente
func (s *WhatsAppService) handleMessagesEvent(ctx context.Context, instanceName string, data json.RawMessage) error {
	msg, err := parseInboundMessage(data)
	if err != nil {
		return err
	}

	rawText := strings.TrimSpace(msg.Text)
	if rawText == "" && msg.IsAudio && s.audioTranscriber != nil {
		rawText = s.transcribeAudio(ctx, instanceName, data)
	}
	// Imagem sem legenda é uma mensagem válida: o Vito precisa "enxergar" o arquivo.
	if rawText == "" && !msg.IsImage {
		return nil
	}

	integration, err := s.repo.GetByInstanceName(ctx, instanceName)
	if err != nil || integration == nil {
		return nil
	}

	chatKind := s.classifyChat(ctx, instanceName, integration, msg.RemoteJID)
	if strings.HasSuffix(msg.RemoteJID, "@g.us") && s.groupMeta != nil {
		// Nomes dos grupos são buscados em background (1 chamada de avatar por grupo).
		s.groupMeta.EnsureLabels(ctx, instanceName)
	}

	// Diagnóstico de entrada: expõe o JID, o telefone da integração e o tipo de chat
	// classificado (essencial para auditar a classificação do chat "Você").
	// O `fromMe` é o que separa o DONO de um terceiro — é a base da blindagem
	// (só o dono dá comandos ao Vito).
	log.Printf("🧭 [WhatsAppContext] instance=%s jid=%s phone=%s kind=%s tipo=%s texto=%d citada=%v fromMe=%v",
		instanceName, msg.RemoteJID, integration.Phone, chatKind, msg.MessageType, len(rawText), msg.QuotedText != "", msg.FromMe)

	// Mensagem gerada pelo próprio Vito: arquiva (faz parte do contexto) e encerra (anti-loop).
	if IsVitoMessage(rawText) {
		clean, _ := StripVitoSignature(rawText)
		s.archiveMessage(ctx, integration.UserID, instanceName, msg, chatKind, clean, "vito")
		return nil
	}

	// Em grupos e conversas com terceiros o Vito só responde quando é citado.
	hasTrigger := reVitoTrigger.MatchString(rawText)
	if RequiresTrigger(chatKind) && !hasTrigger {
		s.archiveMessage(ctx, integration.UserID, instanceName, msg, chatKind, rawText, "user")
		return nil
	}
	if hasTrigger {
		rawText = strings.TrimSpace(reVitoTrigger.ReplaceAllString(rawText, ""))
		if rawText == "" {
			rawText = "olá"
		}
	}

	// Blindagem: só o DONO da instância dá comandos ao Vito. Uma mensagem de
	// terceiro é arquivada (o Vito continua enxergando a conversa) mas NÃO aciona
	// a IA — nem executa agenda/tarefa, nem responde pelo WhatsApp do dono.
	if !CanActOnMessage(chatKind, msg.FromMe) {
		s.archiveMessage(ctx, integration.UserID, instanceName, msg, chatKind, rawText, "user")
		log.Printf("🛡️ [WhatsAppContext] comando de terceiro bloqueado (kind=%s jid=%s fromMe=false)", chatKind, msg.RemoteJID)
		if hasTrigger {
			s.replyOnlyOwnerCanCommand(ctx, instanceName, msg, chatKind)
		}
		return nil
	}

	s.archiveMessage(ctx, integration.UserID, instanceName, msg, chatKind, rawText, "user")

	if s.assistantSvc == nil {
		return nil
	}

	// Feedback visual imediato: reagir com olhinho para confirmar leitura.
	if msg.MessageID != "" && msg.RemoteJID != "" {
		_ = s.client.SendReaction(ctx, instanceName, msg.RemoteJID, msg.MessageID, "👀")
	}

	// O diretório de contatos e as pendências só podem entrar no prompt quando a
	// resposta fica visível apenas para o usuário (chat "Você" ou grupo só dele).
	// Em conversa com terceiro, isso revelaria "a Ana te espera" para o João.
	privateScope := chatKind == domain.WhatsAppChatKindSelf || chatKind == domain.WhatsAppChatKindSelfGroup

	// O processamento com IA roda em BACKGROUND: analisar uma imagem pode levar
	// dezenas de segundos e acontece dentro do handler HTTP do webhook. Processar
	// ali estouraria o timeout do webhook da Evolution, que reenviaria a mensagem
	// e faria o Vito responder duas vezes.
	pending := &pendingMessage{
		ctx:          context.WithoutCancel(ctx),
		integration:  integration,
		instanceName: instanceName,
		msg:          msg,
		chatKind:     chatKind,
		text:         rawText,
		privateScope: privateScope,
		mediaPayload: data,
	}
	s.runAsync(func() { _ = s.processPendingMessage(pending) })

	return nil
}

// pendingMessage carrega o que o processamento em background precisa.
type pendingMessage struct {
	ctx          context.Context
	integration  *domain.WhatsAppIntegration
	instanceName string
	msg          *inboundMessage
	chatKind     string
	text         string
	privateScope bool
	mediaPayload json.RawMessage
}

// processPendingMessage monta o contexto, chama o assistente e responde.
func (s *WhatsAppService) processPendingMessage(pending *pendingMessage) error {
	ctx := pending.ctx
	integration := pending.integration
	instanceName := pending.instanceName
	msg := pending.msg
	rawText := pending.text
	chatKind := pending.chatKind
	privateScope := pending.privateScope

	// A imagem é baixada AQUI (depois das regras de gatilho): em grupo ou
	// conversa de terceiro sem menção, a mídia nem chega a ser baixada.
	var imageB64, imageMime string
	imageFailed := false
	if msg.IsImage {
		imageB64, imageMime = s.downloadImage(ctx, instanceName, pending.mediaPayload, msg.ImageMime)
		if imageB64 == "" {
			imageFailed = true
			log.Printf("⚠️ [WhatsAppService] não foi possível obter a imagem da mensagem %s", msg.MessageID)
		} else {
			log.Printf("🖼️ [WhatsAppContext] imagem recebida: mime=%s base64=%d bytes", imageMime, len(imageB64))
		}
	}
	switch {
	case imageFailed:
		// Sem a imagem, o Vito não pode descrever nada — melhor uma resposta
		// honesta do que uma descrição inventada.
		rawText = imageUnavailablePrompt
	case strings.TrimSpace(rawText) == "":
		rawText = imageAnalysisPrompt
	}

	// Enriquecimento SOB DEMANDA: a mídia da mensagem atual (ou da citada) que
	// ainda não foi lida é analisada agora, para o Vito responder com base no
	// que ela realmente diz.
	s.enrichOnDemand(ctx, integration.UserID, msg)
	quoted, window := s.buildContext(ctx, integration.UserID, msg, chatKind, rawText)

	// Métricas do contexto (SPEC §10.2 P7): permitem auditar no Pi o que o Vito
	// enxergou. O conteúdo (truncado) é essential para diagnosticar "não sei".
	log.Printf("🧠 [WhatsAppContext] kind=%s janela=%d cross_chat=%v citada=%v chats=%s msg_id=%s",
		chatKind, len(window), AllowsCrossChat(chatKind), quoted != "", describeWindowChats(window), msg.MessageID)
	if s.contextDebugLog {
		log.Printf("🧠 [WhatsAppContext] conteúdo da janela: %s", describeWindowContent(window))
	}

	convKey := fmt.Sprintf("%s:%s", instanceName, msg.RemoteJID)
	history := s.memory.GetHistory(convKey)
	if len(window) > 0 {
		// A janela é superset do histórico da conversa: evita duplicar tokens no prompt.
		history = nil
	}

	resp, err := s.assistantSvc.Process(ctx, integration.UserID, ai.UserInput{
		Text:                 rawText,
		ConversationHistory:  history,
		QuotedContext:        quoted,
		ConversationWindow:   window,
		WhatsAppPrivateScope: privateScope,
		ImageB64:             imageB64,
		ImageMime:            imageMime,
	})
	if err != nil {
		log.Printf("⚠️ [WhatsAppService] Erro ao processar mensagem do WhatsApp: %v", err)
		return nil
	}

	s.memory.AddMessage(convKey, "user", rawText)

	replyText := resp.Reply
	if replyText == "" {
		replyText = resp.Message
	}
	if replyText == "" {
		return nil
	}
	s.memory.AddMessage(convKey, "vito", replyText)

	formattedReply := fmt.Sprintf("💼 Vito:\n\n%s", replyText)
	isGroup := strings.HasSuffix(msg.RemoteJID, "@g.us")
	if isGroup && msg.MessageID != "" {
		_ = s.client.SendTextWithQuoted(ctx, instanceName, msg.RemoteJID, formattedReply, msg.MessageID)
	} else {
		_ = s.client.SendText(ctx, instanceName, msg.RemoteJID, formattedReply)
	}

	if s.notifSender != nil {
		notifBody := replyText
		if isGroup {
			notifBody = fmt.Sprintf("Respondeu no grupo: %s", replyText)
		}
		if len(notifBody) > 150 {
			notifBody = notifBody[:147] + "..."
		}
		_, _ = s.notifSender.SendPushToUser(integration.UserID, "💬 Vito (WhatsApp)", notifBody, "default", map[string]interface{}{
			"type":      "whatsapp_response",
			"remoteJid": msg.RemoteJID,
		})
	}

	return nil
}

// transcribeAudio baixa o áudio da Evolution API e transcreve com o Whisper.
func (s *WhatsAppService) transcribeAudio(ctx context.Context, instanceName string, data json.RawMessage) string {
	b64, err := s.client.GetMediaBase64(ctx, instanceName, data)
	if err != nil || b64 == "" {
		return ""
	}
	audioBytes, decodeErr := base64.StdEncoding.DecodeString(b64)
	if decodeErr != nil || len(audioBytes) == 0 {
		return ""
	}
	transcribed, trErr := s.audioTranscriber.Transcribe(ctx, bytes.NewReader(audioBytes), "audio.ogg")
	if trErr != nil {
		return ""
	}
	return strings.TrimSpace(transcribed)
}

// classifyChat classifica a conversa e agenda a atualização do cache de participantes.
//
// A referência para reconhecer o chat "Você" é o **JID do owner** da instância
// (o número realmente pareado), e não o telefone cadastrado na conta Vito — que
// pode ser outro número. Sem o owner, o fallback é o telefone cadastrado.
func (s *WhatsAppService) classifyChat(ctx context.Context, instanceName string, integration *domain.WhatsAppIntegration, remoteJID string) string {
	participants, fresh := 0, false
	if strings.HasSuffix(remoteJID, "@g.us") && s.groupMeta != nil {
		participants, fresh = s.groupMeta.ParticipantsCount(remoteJID)
		if !fresh {
			s.groupMeta.EnsureParticipants(ctx, instanceName, remoteJID)
		}
	}

	selfReference := integration.Phone
	if s.ownerCache != nil {
		if ownerJID, ownerFresh := s.ownerCache.JID(instanceName); ownerFresh {
			selfReference = ownerJID
		} else {
			s.ownerCache.Ensure(ctx, instanceName)
		}
	}
	return ClassifyChat(remoteJID, selfReference, participants, fresh)
}

// archiveMessage persiste a mensagem no shadow inbox (idempotente por id).
func (s *WhatsAppService) archiveMessage(ctx context.Context, userID, instanceName string, msg *inboundMessage, chatKind, text, senderRole string) {
	if s.contextSvc == nil || msg.MessageID == "" || userID == "" {
		return
	}
	timestamp := msg.Timestamp
	if timestamp.IsZero() {
		timestamp = time.Now().UTC()
	}
	fromMe := msg.FromMe
	kind := messageKind(msg)
	if senderRole == "vito" {
		fromMe = true
		kind = messageKindVito
	}

	// Mídia: o tipo, o mime e o envelope de download (a Evolution precisa dele
	// para devolver a mídia quando o Vito for enricher a mensagem).
	mediaKind := ""
	mediaMime := ""
	mediaStatus := domain.WhatsAppMediaStatusNone
	mediaPayload := ""
	switch {
	case msg.IsImage:
		mediaKind = domain.WhatsAppMediaKindImage
		mediaMime = msg.ImageMime
	case msg.IsAudio:
		mediaKind = domain.WhatsAppMediaKindAudio
	}
	if mediaKind != "" {
		if raw, ok := msg.MediaPayload.(json.RawMessage); ok {
			mediaPayload = string(raw)
		}
		if mediaPayload != "" {
			mediaStatus = domain.WhatsAppMediaStatusPending
		}
	}

	entry := &domain.WhatsAppConversationMessage{
		ID:               msg.MessageID,
		UserID:           userID,
		InstanceName:     instanceName,
		ChatJID:          msg.RemoteJID,
		ChatKind:         chatKind,
		ChatLabel:        s.resolveChatLabel(chatKind, msg),
		SenderJID:        firstNonEmpty(msg.Participant, msg.RemoteJID),
		SenderName:       msg.PushName,
		FromMe:           fromMe,
		Kind:             kind,
		Text:             text,
		QuotedText:       strings.TrimSpace(msg.QuotedText),
		QuotedID:         strings.TrimSpace(msg.QuotedID),
		MediaKind:        mediaKind,
		MediaMime:        mediaMime,
		MediaStatus:      mediaStatus,
		MediaPayload:     mediaPayload,
		MessageTimestamp: timestamp,
		CreatedAt:        time.Now().UTC(),
	}
	if err := s.contextSvc.Archive(ctx, entry); err != nil {
		log.Printf("⚠️ [WhatsAppService] falha ao arquivar mensagem: %v", err)
	}
}

// buildContext monta a mensagem citada e a janela de contexto do WhatsApp.
func (s *WhatsAppService) buildContext(ctx context.Context, userID string, msg *inboundMessage, chatKind, text string) (string, []ai.ChatMessageContext) {
	if s.contextSvc == nil {
		return "", nil
	}
	settings, err := s.contextSvc.Settings(ctx, userID)
	if err != nil {
		return "", nil
	}
	quoted := ""
	if settings.Scope != domain.WhatsAppContextScopeOff {
		quoted = s.resolveQuoted(ctx, userID, msg)
	}
	window := s.contextSvc.Window(ctx, userID, msg.RemoteJID, chatKind, text, msg.MessageID)
	return quoted, window
}

// resolveQuoted resolve a mensagem marcada ("responder a esta mensagem").
//
// A resolução é por ID (contextInfo.stanzaId) e não só pelo texto embutido:
//   - a citada pode ser antiga (o texto inline vem junto, mas o id é o elo real);
//   - a citada pode ser uma imagem/áudio — nesses casos o texto inline é VAZIO
//     e só o id permite achar a mensagem arquivada (e o que o Vito viu nela).
func (s *WhatsAppService) resolveQuoted(ctx context.Context, userID string, msg *inboundMessage) string {
	if msg == nil {
		return ""
	}
	if s.contextSvc != nil && msg.QuotedID != "" {
		if archived, err := s.contextSvc.MessageByID(ctx, userID, msg.QuotedID); err == nil && archived != nil {
			if text := quotedTextOf(archived); text != "" {
				return text
			}
		}
	}
	return strings.TrimSpace(msg.QuotedText)
}

// resolveChatLabel define o rótulo do chat exibido no contexto (ex.: "Você", "Família", "Ana").
func (s *WhatsAppService) resolveChatLabel(chatKind string, msg *inboundMessage) string {
	switch chatKind {
	case domain.WhatsAppChatKindSelf:
		return "Você"
	case domain.WhatsAppChatKindSelfGroup, domain.WhatsAppChatKindGroup:
		if s.groupMeta != nil {
			if subject := s.groupMeta.Subject(msg.RemoteJID); subject != "" {
				return subject
			}
		}
		return "Grupo"
	default:
		// O nome SALVO pelo dono tem prioridade sobre o nome de perfil: é o nome
		// pelo qual o usuário fala da pessoa ("isa", não "bella"). O nome de
		// perfil (pushName da mensagem) fica como segundo rótulo.
		if s.contactsCache != nil {
			if name := s.contactsCache.Name(msg.RemoteJID); name != "" {
				s.labelsMu.Lock()
				if s.chatLabels == nil {
					s.chatLabels = make(map[string]string)
				}
				s.chatLabels[msg.RemoteJID] = name
				s.labelsMu.Unlock()
				return name
			}
		}
		s.labelsMu.Lock()
		defer s.labelsMu.Unlock()
		if s.chatLabels == nil {
			s.chatLabels = make(map[string]string)
		}
		if !msg.FromMe && strings.TrimSpace(msg.PushName) != "" {
			s.chatLabels[msg.RemoteJID] = msg.PushName
			// O nome de perfil vira ALIAS do contato salvo: é o que permite ao
			// Vito entender "isa" e "bella" como a mesma pessoa.
			s.contactsCache.SetProfile(msg.RemoteJID, msg.PushName)
		}
		if label, ok := s.chatLabels[msg.RemoteJID]; ok {
			return label
		}
		return "Contato"
	}
}

// messageKind classifica o tipo da mensagem arquivada.
func messageKind(msg *inboundMessage) string {
	switch {
	case msg.IsAudio:
		return "audio"
	case strings.Contains(strings.ToLower(msg.MessageType), "image"):
		return "image"
	case strings.TrimSpace(msg.Text) != "":
		return "text"
	default:
		return "other"
	}
}

// WhatsAppMessageSender envia uma mensagem do WhatsApp em nome do usuário.
//
// Interface (e não o tipo concreto) para o AssistantService não depender do
// WhatsAppService — que já depende do AssistantService.
type WhatsAppMessageSender interface {
	SendWhatsAppMessage(ctx context.Context, userID, chatJID, text string) error
}

// SendWhatsAppMessage envia uma mensagem a uma conversa, em nome do usuário.
func (s *WhatsAppService) SendWhatsAppMessage(ctx context.Context, userID, chatJID, text string) error {
	if strings.TrimSpace(chatJID) == "" || strings.TrimSpace(text) == "" {
		return fmt.Errorf("conversa e texto são obrigatórios")
	}
	integration, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		return err
	}
	if integration == nil || integration.Status != domain.WhatsAppStatusConnected {
		return fmt.Errorf("WhatsApp não está conectado")
	}
	return s.client.SendText(ctx, integration.InstanceName, chatJID, text)
}
