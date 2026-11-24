package service

import (
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

// reVitoTrigger detecta comandos ou menções explícitas ao Vito nas mensagens (@vito, /vito, !vito).
var reVitoTrigger = regexp.MustCompile(`(?i)(?:^|[\s([{\n\r])[@!/]vito\b[:,!-]?\s*`)

// hasVitoCall verifica se a mensagem chama explicitamente o Vito (@vito, /vito, !vito).
// O Vito só deve ser ativado no WhatsApp se tiver a marcação explícita de @vito, /vito e !vito.
func hasVitoCall(text string) (bool, string) {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return false, ""
	}
	if reVitoTrigger.MatchString(trimmed) {
		clean := strings.TrimSpace(reVitoTrigger.ReplaceAllString(trimmed, " "))
		return true, clean
	}
	return false, trimmed
}

// imageAnalysisPrompt é o pedido padrão quando a imagem chega sem legenda.
const imageAnalysisPrompt = "Analise esta imagem e me diga o que ela contém. Se for um documento, recibo, comprovante ou evento, extraia os dados (datas, valores, títulos) e sugira a ação correspondente."

// imageUnavailablePrompt é usado quando a mídia não pôde ser baixada: o Vito
// avisa em vez de inventar o conteúdo da imagem.
const imageUnavailablePrompt = "Não consegui baixar a imagem desta mensagem. Responda ao usuário, de forma breve, que não foi possível ler a imagem e sugira reenviá-la."

// handleMessagesEvent despacha cada mensagem do webhook `messages.upsert` para
// processamento assíncrono em fila limitada, respondendo rápido à Evolution API.
func (s *WhatsAppService) handleMessagesEvent(ctx context.Context, instanceName string, data json.RawMessage) error {
	items := extractInboundItems(data)
	for _, item := range items {
		it := item
		s.runAsync(func() {
			_ = s.processInboundItem(context.WithoutCancel(ctx), instanceName, it.upsertType, it.raw)
		})
	}
	return nil
}

// processInboundItem normaliza, deduplica, filtra replays antigos e executa o fluxo
// conversacional de uma mensagem dentro do worker assíncrono.
func (s *WhatsAppService) processInboundItem(ctx context.Context, instanceName, upsertType string, data json.RawMessage) error {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()

	msg, err := parseInboundMessage(data)
	if err != nil {
		log.Printf("❌ [WhatsAppInbound] parseInboundMessage falhou: %v (data_len=%d)", err, len(data))
		return err
	}

	if msg.IsReaction || strings.EqualFold(msg.MessageType, "reactionMessage") || strings.TrimSpace(msg.Text) == "👀" {
		log.Printf("ℹ️ [WhatsAppInbound] reação descartada para acionamento conversacional (remoteJid=%s)", msg.RemoteJID)
		return nil
	}

	if msg.MessageID != "" {
		if !s.claimMessageID(msg.MessageID) {
			log.Printf("ℹ️ [WhatsAppInbound] MessageID %s duplicado ignorado", msg.MessageID)
			return nil
		}
	}

	if s.inboundCoord != nil {
		unlock := s.inboundCoord.lockChat(instanceName, msg.RemoteJID)
		defer unlock()
	}

	integration, err := s.repo.GetByInstanceName(ctx, instanceName)
	if err != nil || integration == nil {
		if connInteg, connErr := s.repo.FindConnectedInstance(ctx); connErr == nil && connInteg != nil {
			integration = connInteg
			if integration.InstanceName != "" {
				instanceName = integration.InstanceName
			}
		} else {
			log.Printf("⚠️ [WhatsAppInbound] integração não encontrada para instância %q: %v", instanceName, err)
			return nil
		}
	}

	s.learnOwnerAndLIDFromMessage(instanceName, integration, msg)

	// Blindagem pós-queda/reinício: mensagens já arquivadas no banco ou antigas/append
	// NÃO devem disparar Whisper, reação 👀 nem fila de IA.
	alreadyHandled, cachedMediaText := checkShadowInboxDuplicate(ctx, s.contextSvc, integration.UserID, msg, upsertType)
	if alreadyHandled {
		log.Printf("ℹ️ [WhatsAppInbound] MessageID %s já arquivado/tratado no shadow inbox; replay ignorado", msg.MessageID)
		return nil
	}
	if isStaleOrAppendReplay(upsertType, msg.Timestamp, s.maxInboundAge) {
		log.Printf("ℹ️ [WhatsAppInbound] replay antigo/append (%s, ts=%s) arquivado silenciosamente sem Whisper/IA",
			msg.MessageID, msg.Timestamp.Format(time.RFC3339))
		s.archiveStaleMessage(ctx, integration, instanceName, msg)
		return nil
	}

	rawText := strings.TrimSpace(msg.Text)
	if rawText == "" && msg.IsAudio {
		if strings.TrimSpace(cachedMediaText) != "" {
			rawText = strings.TrimSpace(cachedMediaText)
		} else if s.audioTranscriber != nil {
			rawText = s.transcribeAudio(ctx, instanceName, data)
		}
	}

	// Imagem sem legenda é uma mensagem válida: o Vito precisa "enxergar" o arquivo.
	if rawText == "" && !msg.IsImage {
		log.Printf("ℹ️ [WhatsAppInbound] mensagem sem texto nem imagem ignorada (msgType=%s, remoteJid=%s)", msg.MessageType, msg.RemoteJID)
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
	log.Printf("🧭 [WhatsAppContext] instance=%s jid=%s phone=%s kind=%s tipo=%s texto=%d citada=%v fromMe=%v participant=%s",
		instanceName, msg.RemoteJID, integration.Phone, chatKind, msg.MessageType, len(rawText), msg.QuotedText != "", msg.FromMe, msg.Participant)

	// Mensagem gerada pelo próprio Vito: arquiva (faz parte do contexto) e encerra (anti-loop).
	if IsVitoMessage(rawText) || s.isOutboundReply(rawText) {
		clean, _ := StripVitoSignature(rawText)
		s.archiveMessage(ctx, integration.UserID, instanceName, msg, chatKind, clean, "vito")
		return nil
	}

	calledVito, cleanText := hasVitoCall(rawText)

	// Regra 1: Captura de tela / Imagem (msg.IsImage)
	// O Vito NUNCA deve responder a prints ou fotos a menos que tenha a marcação
	// explícita (@vito, /vito, !vito) na legenda da imagem. Sem marcação, arquiva silenciosamente no shadow inbox.
	if msg.IsImage {
		if !calledVito {
			s.archiveMessage(ctx, integration.UserID, instanceName, msg, chatKind, rawText, "user")
			log.Printf("ℹ️ [WhatsAppInbound] imagem sem menção explícita arquivada silenciosamente (jid=%s)", msg.RemoteJID)
			return nil
		}
		rawText = cleanText
		if rawText == "" {
			rawText = imageAnalysisPrompt
		}
	}

	// Regra 2: Áudio (msg.IsAudio)
	// O áudio é transcrito e arquivado no shadow inbox. Porém, o Vito só deve responder
	// se tiver a marcação explícita (@vito, /vito, !vito).
	// Sem menção explícita ao Vito, o áudio é arquivado silenciosamente sem reação nem resposta.
	if msg.IsAudio {
		if !calledVito {
			s.archiveMessage(ctx, integration.UserID, instanceName, msg, chatKind, rawText, "user")
			log.Printf("ℹ️ [WhatsAppInbound] áudio sem menção explícita arquivado silenciosamente (jid=%s)", msg.RemoteJID)
			return nil
		}
		rawText = cleanText
		if rawText == "" {
			rawText = "olá"
		}
	}

	// Regra 3: Texto comum (não imagem, não áudio)
	// O Vito SÓ deve ser ativado no WhatsApp se tiver a marcação explícita de @vito, /vito e !vito.
	// Em qualquer conversa (inclusive chat 'Você', grupos comigo mesmo e grupos com terceiros),
	// mensagens sem a marcação explícita são arquivadas silenciosamente no shadow inbox sem resposta nem reação.
	if !msg.IsImage && !msg.IsAudio {
		if !calledVito {
			s.archiveMessage(ctx, integration.UserID, instanceName, msg, chatKind, rawText, "user")
			log.Printf("ℹ️ [WhatsAppInbound] texto sem marcação explícita arquivado silenciosamente (kind=%s jid=%s)", chatKind, msg.RemoteJID)
			return nil
		}
		rawText = cleanText
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
		if calledVito && !isGroup {
			s.replyOnlyOwnerCanCommand(ctx, instanceName, msg, chatKind)
		}
		return nil
	}

	s.archiveMessage(ctx, integration.UserID, instanceName, msg, chatKind, rawText, "user")
	var threadID string
	if s.agentLoop != nil {
		if s.convBridge != nil {
			if thread, tErr := s.convBridge.GetOrCreateThread(ctx, integration.UserID, msg.RemoteJID); tErr == nil && thread != nil {
				threadID = thread.ID
			}
		}
	} else {
		threadID = s.recordBridgeIncoming(ctx, integration.UserID, msg.RemoteJID, rawText)
	}

	if s.agentLoop == nil && s.assistantSvc == nil {
		return nil
	}

	// Feedback visual imediato: reagir com olhinho para confirmar leitura (timeout curto).
	if msg.MessageID != "" && msg.RemoteJID != "" {
		reactTarget := s.resolveTargetJIDForMessage(ctx, instanceName, msg, chatKind, ownerJID, integration.Phone)
		reactCtx, reactCancel := context.WithTimeout(ctx, 5*time.Second)
		if reactErr := s.client.SendReaction(reactCtx, instanceName, reactTarget, msg.MessageID, "👀", msg.FromMe); reactErr != nil {
			log.Printf("⚠️ [WhatsAppService] falha ao enviar reação 👀 para %s: %v", reactTarget, reactErr)
		}
		reactCancel()
	}

	// O diretório de contatos e as pendências só podem entrar no prompt quando a
	// resposta fica visível apenas para o usuário (chat "Você" ou grupo só dele).
	// Em conversa com terceiro, isso revelaria "a Ana te espera" para o João.
	privateScope := chatKind == domain.WhatsAppChatKindSelf || chatKind == domain.WhatsAppChatKindSelfGroup

	pending := &pendingMessage{
		ctx:          ctx,
		integration:  integration,
		instanceName: instanceName,
		msg:          msg,
		chatKind:     chatKind,
		text:         rawText,
		privateScope: privateScope,
		mediaPayload: data,
		threadID:     threadID,
	}
	return s.processPendingMessage(pending)
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

	var replyText, modelUsed string
	var err error

	if s.agentLoop != nil {
		var quotedParts []string
		if strings.TrimSpace(quoted) != "" {
			quotedParts = append(quotedParts, "Mensagem citada: "+strings.TrimSpace(quoted))
		}
		if len(window) > 0 {
			var winLines []string
			for _, w := range window {
				winLines = append(winLines, fmt.Sprintf("[%s] %s: %s", w.Chat, w.Sender, w.Text))
			}
			quotedParts = append(quotedParts, "Janela recente do WhatsApp:\n"+strings.Join(winLines, "\n"))
		}
		adkResp, adkErr := s.agentLoop.Run(ctx, domain.UnifiedAssistantRequest{
			UserID:               integration.UserID,
			ThreadID:             pending.threadID,
			Channel:              "whatsapp",
			Message:              rawText,
			QuotedContext:        strings.Join(quotedParts, "\n\n"),
			WhatsAppPrivateScope: privateScope,
			ImageB64:             imageB64,
			ImageMime:            imageMime,
		})
		err = adkErr
		if adkResp != nil {
			replyText = adkResp.Reply
			if replyText == "" {
				replyText = adkResp.Text
			}
			if replyText == "" {
				replyText = adkResp.Message
			}
			modelUsed = adkResp.Telemetry.ProviderUsed
		}
	} else if s.assistantSvc != nil {
		var resp *AssistantResponse
		resp, err = s.assistantSvc.Process(ctx, integration.UserID, ai.UserInput{
			Text:                 rawText,
			ConversationHistory:  history,
			QuotedContext:        quoted,
			ConversationWindow:   window,
			WhatsAppPrivateScope: privateScope,
			ImageB64:             imageB64,
			ImageMime:            imageMime,
		})
		if resp != nil {
			replyText = resp.Reply
			if replyText == "" {
				replyText = resp.Message
			}
			modelUsed = resp.ProviderUsed
		}
	}
	if err != nil {
		log.Printf("⚠️ [WhatsAppService] Erro ao processar mensagem do WhatsApp: %v", err)
		assinatura := VitoSignature(ctx, s.contextSvc, integration.UserID, msg.RemoteJID, msg.PushName)
		fallbackReply := fmt.Sprintf("%s\n\nEstou com uma instabilidade temporária nos meus provedores de IA agora. Pode tentar novamente em alguns instantes?", assinatura)
		targetJID := s.resolveTargetJIDForMessage(ctx, instanceName, msg, chatKind, ownerJID, integration.Phone)
		canonicalOwnerJID := ResolveReplyJID(msg.RemoteJID, msg.RemoteJIDAlt, domain.WhatsAppChatKindSelf, ownerJID, integration.Phone)
		s.markOutboundReply(fallbackReply)
		if sendErr := s.sendWhatsAppReplyWithFallback(ctx, instanceName, targetJID, canonicalOwnerJID, chatKind, fallbackReply, msg); sendErr != nil {
			log.Printf("❌ [WhatsAppService] falha ao enviar fallback de erro para %s: %v", targetJID, sendErr)
		}
		return nil
	}

	if replyText == "" {
		s.memory.AddMessage(convKey, "user", rawText)
		return nil
	}

	if modelUsed == "" {
		modelUsed = "vito-assistant"
	}

	assinatura := VitoSignature(ctx, s.contextSvc, integration.UserID, msg.RemoteJID, msg.PushName)
	formattedReply := fmt.Sprintf("%s\n\n%s", assinatura, replyText)
	targetJID := s.resolveTargetJIDForMessage(ctx, instanceName, msg, chatKind, ownerJID, integration.Phone)
	canonicalOwnerJID := ResolveReplyJID(msg.RemoteJID, msg.RemoteJIDAlt, domain.WhatsAppChatKindSelf, ownerJID, integration.Phone)
	s.markOutboundReply(formattedReply)

	sendErr := s.sendWhatsAppReplyWithFallback(ctx, instanceName, targetJID, canonicalOwnerJID, chatKind, formattedReply, msg)
	if sendErr != nil {
		log.Printf("❌ [WhatsAppService] falha definitiva ao enviar resposta para %s: %v", targetJID, sendErr)
		return nil
	}

	log.Printf("📤 [WhatsAppService] resposta enviada com sucesso para %s (%d bytes)", targetJID, len(formattedReply))
	s.memory.AddMessage(convKey, "user", rawText)
	s.memory.AddMessage(convKey, "vito", replyText)
	if s.agentLoop == nil {
		s.recordBridgeOutgoing(ctx, integration.UserID, pending.threadID, msg.RemoteJID, replyText, modelUsed)
	}
	s.notifyWhatsAppReplyIfAllowed(ctx, integration.UserID, chatKind, msg, replyText)

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

