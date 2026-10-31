package service

import (
	"context"
	"strings"
	"time"
)

// onlyOwnerCanCommandMessage é a resposta a um terceiro que tentou dar um
// comando ao Vito.
//
// É honesta e educada: explica o limite sem executar nada. O nome do dono NÃO
// é revelado (o Vito não confirma para quem é a conta).
const onlyOwnerCanCommandMessage = "Desculpe — neste chat eu só aceito comandos do dono da conta."

// blockedReplyCooldown evita que "spam de @vito" vire spam de resposta no
// grupo (e nem push no celular do dono).
const blockedReplyCooldown = 30 * time.Minute

// replyOnlyOwnerCanCommand responde ao terceiro que tentou comandar o Vito.
//
// A resposta vai no mesmo chat (com citação em grupo) e NÃO gera push para o
// dono: a tentativa fica registrada no log, não no celular.
func (s *WhatsAppService) replyOnlyOwnerCanCommand(ctx context.Context, instanceName string, msg *inboundMessage, chatKind string) {
	if msg == nil || msg.RemoteJID == "" {
		return
	}
	if !s.allowBlockedReply(msg.RemoteJID) {
		return
	}
	// Busca o userID da instância para montar a assinatura com nome (quando
	// houver 2+ chamadores distintos no chat).
	userID := ""
	if integration, err := s.repo.GetByInstanceName(ctx, instanceName); err == nil && integration != nil {
		userID = integration.UserID
	}
	assinatura := VitoSignature(ctx, s.contextSvc, userID, msg.RemoteJID, msg.PushName)
	formatted := assinatura + "\n\n" + onlyOwnerCanCommandMessage
	isGroup := strings.HasSuffix(msg.RemoteJID, "@g.us")
	targetJID := NormalizeJIDForSend(msg.RemoteJID)
	if isGroup && msg.MessageID != "" {
		_ = s.client.SendTextWithQuoted(ctx, instanceName, targetJID, formatted, msg.MessageID)
		return
	}
	_ = s.client.SendText(ctx, instanceName, targetJID, formatted)
}

// allowBlockedReply aplica o cooldown por conversa.
func (s *WhatsAppService) allowBlockedReply(chatJID string) bool {
	if chatJID == "" {
		return false
	}
	s.blockedMu.Lock()
	defer s.blockedMu.Unlock()
	if s.blockedReplies == nil {
		s.blockedReplies = make(map[string]time.Time)
	}
	if last, ok := s.blockedReplies[chatJID]; ok && time.Since(last) < blockedReplyCooldown {
		return false
	}
	s.blockedReplies[chatJID] = time.Now().UTC()
	return true
}

// blockedReplyCount devolve quantas conversas receberam a resposta educativa
// (usado nos testes e no diagnóstico).
func (s *WhatsAppService) blockedReplyCount() int {
	s.blockedMu.Lock()
	defer s.blockedMu.Unlock()
	return len(s.blockedReplies)
}

// VitoSignature monta a assinatura da resposta do Vito.
//
// Padrão: "💼 Vito:". Quando há 2 ou mais chamadores distintos no mesmo chat
// (Detectado via DistinctVitoCallers), usa "💼 Vito(Nome):" para distinguir
// qual instância do Vito está respondendo, evitando confusão quando 2 pessoas
// têm o Vito instalado no mesmo grupo.
func VitoSignature(ctx context.Context, contextSvc *WhatsAppContextService, userID, chatJID, senderName string) string {
	if contextSvc == nil || userID == "" || chatJID == "" {
		return "💼 Vito:"
	}
	chamadores, err := contextSvc.DistinctVitoCallers(ctx, userID, chatJID)
	if err != nil || chamadores < 2 {
		return "💼 Vito:"
	}
	nome := strings.TrimSpace(senderName)
	if nome == "" {
		return "💼 Vito:"
	}
	return "💼 Vito(" + nome + "):"
}
