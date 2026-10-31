package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// reVitoTrigger detecta menções ao Vito nas mensagens (com ou sem @, !, /, :).
var reVitoTrigger = regexp.MustCompile(`(?i)(?:[@!/])?\bvito\b[:,!-]?\s*`)

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
	// Suporte resiliente a payloads da Evolution API onde data é um array ou contém wrapper
	trimmedData := bytes.TrimSpace(data)
	if len(trimmedData) > 0 && trimmedData[0] == '[' {
		var arr []json.RawMessage
		if err := json.Unmarshal(trimmedData, &arr); err == nil && len(arr) > 0 {
			data = arr[0]
		}
	} else if len(trimmedData) > 0 && trimmedData[0] == '{' {
		var wrapper struct {
			Messages []json.RawMessage `json:"messages"`
		}
		if err := json.Unmarshal(trimmedData, &wrapper); err == nil && len(wrapper.Messages) > 0 {
			data = wrapper.Messages[0]
		}
	}

	msg, err := parseInboundMessage(data)
	if err != nil {
		log.Printf("❌ [WhatsAppInbound] parseInboundMessage falhou: %v (data_len=%d)", err, len(data))
		return err
	}

	rawText := strings.TrimSpace(msg.Text)
	if rawText == "" && msg.IsAudio && s.audioTranscriber != nil {
		rawText = s.transcribeAudio(ctx, instanceName, data)
	}

	if msg.IsReaction || strings.EqualFold(msg.MessageType, "reactionMessage") || rawText == "👀" {
		log.Printf("ℹ️ [WhatsAppInbound] reação descartada para acionamento conversacional (remoteJid=%s)", msg.RemoteJID)
		return nil
	}

	if msg.MessageID != "" {
		if s.isMessageIDProcessed(msg.MessageID) {
			log.Printf("ℹ️ [WhatsAppInbound] MessageID %s duplicado ignorado", msg.MessageID)
			return nil
		}
		s.markMessageIDProcessed(msg.MessageID)
	}
	// Imagem sem legenda é uma mensagem válida: o Vito precisa "enxergar" o arquivo.
	if rawText == "" && !msg.IsImage {
		log.Printf("ℹ️ [WhatsAppInbound] mensagem sem texto nem imagem ignorada (msgType=%s, remoteJid=%s)", msg.MessageType, msg.RemoteJID)
		return nil
	}

	integration, err := s.repo.GetByInstanceName(ctx, instanceName)
	if err != nil || integration == nil {
		if connInteg, connErr := s.repo.FindConnectedInstance(ctx); connErr == nil && connInteg != nil {
			integration = connInteg
		} else {
			log.Printf("⚠️ [WhatsAppInbound] integração não encontrada para instância %q: %v", instanceName, err)
			return nil
		}
	}

	// Quando o próprio dono envia mensagem (fromMe=true) e a Evolution API informa
	// o participant em formato @lid, registramos o LID do dono para reconhecer o
	// chat "Você" (@lid) e validar autoria mesmo quando fromMe vier false.
	if msg.FromMe && strings.HasSuffix(msg.Participant, "@lid") && s.ownerCache != nil {
		s.ownerCache.SetLID(instanceName, msg.Participant)
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
	log.Printf("🧭 [WhatsAppContext] instance=%s jid=%s phone=%s kind=%s tipo=%s texto=%d citada=%v fromMe=%v participant=%s",
		instanceName, msg.RemoteJID, integration.Phone, chatKind, msg.MessageType, len(rawText), msg.QuotedText != "", msg.FromMe, msg.Participant)

	// Mensagem gerada pelo próprio Vito: arquiva (faz parte do contexto) e encerra (anti-loop).
	if IsVitoMessage(rawText) || s.isOutboundReply(rawText) {
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
	// O remetente é reconhecido como o dono se:
	//  1) CanActOnMessage devolver true (fromMe=true ou chat pessoal self/self_group)
	//  2) msg.Participant ou msg.RemoteJID corresponder ao número pareado/cadastrado
	ownerJID := ""
	ownerLID := ""
	if s.ownerCache != nil {
		ownerJID, _ = s.ownerCache.JID(instanceName)
		ownerLID = s.ownerCache.LID(instanceName)
	}
	isOwner := CanActOnMessage(chatKind, msg.FromMe) ||
		IsOwnerSender(msg.Participant, integration.Phone, ownerJID) ||
		IsOwnerSender(msg.RemoteJID, integration.Phone, ownerJID) ||
		(ownerLID != "" && (strings.EqualFold(msg.Participant, ownerLID) || strings.EqualFold(msg.RemoteJID, ownerLID)))

	if !isOwner {
		s.archiveMessage(ctx, integration.UserID, instanceName, msg, chatKind, rawText, "user")
		log.Printf("🛡️ [WhatsAppContext] comando de terceiro bloqueado (kind=%s jid=%s participant=%s fromMe=%v)", chatKind, msg.RemoteJID, msg.Participant, msg.FromMe)
		// Em grupo, um terceiro (fromMe=false) que chama @vito não recebe a
		// recusa educada: como cada participante tem o seu próprio Vito
		// instalado, isso evitaria duplicar a resposta e poluir o chat.
		// O Vito continua arquivando a mensagem e enxergando a conversa.
		isGroup := strings.HasSuffix(msg.RemoteJID, "@g.us")
		if hasTrigger && !isGroup {
			s.replyOnlyOwnerCanCommand(ctx, instanceName, msg, chatKind)
		}
		return nil
	}

	s.archiveMessage(ctx, integration.UserID, instanceName, msg, chatKind, rawText, "user")
	threadID := s.recordBridgeIncoming(ctx, integration.UserID, msg.RemoteJID, rawText)

	if s.assistantSvc == nil {
		return nil
	}

	// Feedback visual imediato: reagir com olhinho para confirmar leitura.
	if msg.MessageID != "" && msg.RemoteJID != "" {
		targetJID := NormalizeJIDForSend(msg.RemoteJID)
		_ = s.client.SendReaction(ctx, instanceName, targetJID, msg.MessageID, "👀")
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
		threadID:     threadID,
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
	threadID     string
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

	ownerJID := ""
	if s.ownerCache != nil {
		ownerJID, _ = s.ownerCache.JID(instanceName)
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
		assinatura := VitoSignature(ctx, s.contextSvc, integration.UserID, msg.RemoteJID, msg.PushName)
		fallbackReply := fmt.Sprintf("%s\n\nEstou com uma instabilidade temporária nos meus provedores de IA agora. Pode tentar novamente em alguns instantes?", assinatura)
		targetJID := ResolveReplyJID(msg.RemoteJID, msg.RemoteJIDAlt, chatKind, ownerJID, integration.Phone)
		s.markOutboundReply(fallbackReply)
		if strings.HasSuffix(msg.RemoteJID, "@g.us") && msg.MessageID != "" {
			_ = s.client.SendTextWithQuoted(ctx, instanceName, targetJID, fallbackReply, msg.MessageID)
		} else {
			_ = s.client.SendText(ctx, instanceName, targetJID, fallbackReply)
		}
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

	modelUsed := resp.ProviderUsed
	if modelUsed == "" {
		modelUsed = "vito-assistant"
	}
	s.recordBridgeOutgoing(ctx, integration.UserID, pending.threadID, msg.RemoteJID, replyText, modelUsed)

	assinatura := VitoSignature(ctx, s.contextSvc, integration.UserID, msg.RemoteJID, msg.PushName)
	formattedReply := fmt.Sprintf("%s\n\n%s", assinatura, replyText)
	isGroup := strings.HasSuffix(msg.RemoteJID, "@g.us")
	targetJID := ResolveReplyJID(msg.RemoteJID, msg.RemoteJIDAlt, chatKind, ownerJID, integration.Phone)
	canonicalOwnerJID := ResolveReplyJID(msg.RemoteJID, msg.RemoteJIDAlt, domain.WhatsAppChatKindSelf, ownerJID, integration.Phone)
	s.markOutboundReply(formattedReply)

	var sendErr error
	if isGroup && msg.MessageID != "" {
		sendErr = s.client.SendTextWithQuoted(ctx, instanceName, targetJID, formattedReply, msg.MessageID)
	} else {
		sendErr = s.client.SendText(ctx, instanceName, targetJID, formattedReply)
		if sendErr != nil && canonicalOwnerJID != "" && targetJID != canonicalOwnerJID {
			log.Printf("⚠️ [WhatsAppService] tentativa inicial falhou para %s (%v); tentando fallback para ownerJID %s", targetJID, sendErr, canonicalOwnerJID)
			sendErr = s.client.SendText(ctx, instanceName, canonicalOwnerJID, formattedReply)
		}
	}
	if sendErr != nil {
		log.Printf("❌ [WhatsAppService] falha ao enviar resposta para %s: %v", targetJID, sendErr)
	} else {
		log.Printf("📤 [WhatsAppService] resposta enviada com sucesso para %s (%d bytes)", targetJID, len(formattedReply))
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
			if fetchedCount, ok := s.groupMeta.FetchParticipants(ctx, instanceName, remoteJID); ok {
				participants, fresh = fetchedCount, true
			} else {
				s.groupMeta.EnsureParticipants(ctx, instanceName, remoteJID)
			}
		}
	}

	ownerLID := ""
	selfReference := integration.Phone
	if s.ownerCache != nil {
		ownerLID = s.ownerCache.LID(instanceName)
		if ownerLID != "" && strings.EqualFold(strings.TrimSpace(remoteJID), ownerLID) {
			return domain.WhatsAppChatKindSelf
		}
		ownerJID, ownerFresh := s.ownerCache.JID(instanceName)
		if ownerJID == "" {
			fetchCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
			if fetched, err := s.ownerCache.Fetch(fetchCtx, instanceName); err == nil && fetched != "" {
				ownerJID = fetched
				ownerFresh = true
			}
			cancel()
		}
		if ownerJID != "" {
			selfReference = ownerJID
		}
		if !ownerFresh {
			s.ownerCache.Ensure(ctx, instanceName)
		}
	}
	return ClassifyChat(remoteJID, selfReference, participants, fresh, ownerLID)
}

