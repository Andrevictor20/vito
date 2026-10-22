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
	formatted := "💼 Vito:\n\n" + onlyOwnerCanCommandMessage
	isGroup := strings.HasSuffix(msg.RemoteJID, "@g.us")
	if isGroup && msg.MessageID != "" {
		_ = s.client.SendTextWithQuoted(ctx, instanceName, msg.RemoteJID, formatted, msg.MessageID)
		return
	}
	_ = s.client.SendText(ctx, instanceName, msg.RemoteJID, formatted)
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
