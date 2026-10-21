package service

import (
	"strings"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// ClassifyChat classifica uma conversa do WhatsApp para definir o escopo de contexto.
//
// Regra (SPEC §2.1):
//   - `self`      → conversa comigo mesmo ("Você")
//   - `self_group`→ grupo do WhatsApp com apenas o usuário (nenhum terceiro vê a resposta)
//   - `group`     → grupo com outras pessoas
//   - `direct`    → 1-on-1 com terceiro
//
// Quando os dados de participantes estão obsoletos ou ausentes, o fallback é o tipo
// MAIS RESTRITIVO (`group`), que bloqueia o contexto cross-chat por construção.
func ClassifyChat(remoteJID, myPhone string, groupParticipants int, participantsFresh bool) string {
	jid := strings.TrimSpace(remoteJID)
	if jid == "" {
		return domain.WhatsAppChatKindDirect
	}

	if strings.HasSuffix(jid, "@g.us") {
		if participantsFresh && groupParticipants == 1 {
			return domain.WhatsAppChatKindSelfGroup
		}
		return domain.WhatsAppChatKindGroup
	}

	cleanJID := strings.Split(jid, "@")[0]
	if myPhone != "" && isMatchingPhone(cleanJID, myPhone) {
		return domain.WhatsAppChatKindSelf
	}
	return domain.WhatsAppChatKindDirect
}

// AllowsCrossChat informa se o Vito pode consultar mensagens de OUTROS chats.
//
// Liberado apenas em conversas pessoais (`self`, `self_group`), onde a resposta do Vito
// não é entregue a terceiros. Em `group` e `direct` a resposta é visível a outras
// pessoas, então o contexto fica restrito ao chat em que o Vito foi acionado.
func AllowsCrossChat(chatKind string) bool {
	return chatKind == domain.WhatsAppChatKindSelf || chatKind == domain.WhatsAppChatKindSelfGroup
}

// RequiresTrigger informa se a mensagem precisa de menção explícita (@vito) para
// acionar o Vito. Conversas pessoais (`self`, `self_group`) dispensam a menção.
func RequiresTrigger(chatKind string) bool {
	return chatKind == domain.WhatsAppChatKindGroup || chatKind == domain.WhatsAppChatKindDirect
}
