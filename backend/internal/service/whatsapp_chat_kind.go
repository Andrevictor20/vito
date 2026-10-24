package service

import (
	"regexp"
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

	if strings.HasSuffix(jid, "@broadcast") || jid == "status@broadcast" {
		return domain.WhatsAppChatKindBroadcast
	}
	if strings.HasSuffix(jid, "@newsletter") {
		return domain.WhatsAppChatKindNewsletter
	}

	if strings.HasSuffix(jid, "@g.us") {
		if participantsFresh && groupParticipants == 1 {
			return domain.WhatsAppChatKindSelfGroup
		}
		return domain.WhatsAppChatKindGroup
	}

	cleanJID := strings.Split(jid, "@")[0]
	if myPhone != "" && IsSelfChatJID(cleanJID, myPhone) {
		return domain.WhatsAppChatKindSelf
	}
	return domain.WhatsAppChatKindDirect
}

// IsSelfChatJID informa se um JID pertence à conversa do próprio usuário ("Você").
//
// O WhatsApp endereça a conversa consigo mesmo com um **prefixo** sobre o número
// (observado em produção: `047559884097322@s.whatsapp.net` para o número
// `559884097322`). Por isso a comparação é feita por **sufixo**, tolerando ainda
// a diferença do 9º dígito brasileiro.
func IsSelfChatJID(jid, phone string) bool {
	j := phoneDigits(jid)
	p := phoneDigits(phone)
	if j == "" || p == "" {
		return false
	}
	if j == p {
		return true
	}
	// Prefixo do note-to-self: o JID termina com o número do usuário.
	if strings.HasSuffix(j, p) {
		return true
	}
	// Tolerância do 9º dígito brasileiro, nos dois sentidos.
	jCanon, pCanon := canonicalBRPhone(j), canonicalBRPhone(p)
	if jCanon == pCanon {
		return true
	}
	return strings.HasSuffix(j, pCanon)
}

// canonicalBRPhone remove o 9º dígito de um celular brasileiro (DDI 55 + DDD + 9 + 8).
func canonicalBRPhone(digits string) string {
	if len(digits) == 13 && strings.HasPrefix(digits, "55") {
		return digits[:4] + digits[5:]
	}
	return digits
}

// phoneDigits extrai apenas os dígitos de um JID/telefone.
func phoneDigits(raw string) string {
	return regexp.MustCompile(`\D+`).ReplaceAllString(raw, "")
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

// CanActOnMessage informa se o Vito pode executar comandos a partir desta
// mensagem.
//
// REGRA DE OURO: só o DONO da instância dá comandos ao Vito.
//
// Sem isso, qualquer pessoa num grupo (ou num 1-on-1) podia escrever
// "@vito cria uma reunião amanhã" e o Vito criava o evento NA CONTA DO DONO —
// além de poder responder pelo WhatsApp dele (SEND_WHATSAPP_MESSAGE).
//
// A exceção é o chat "Você" (`self`) e o grupo só dele (`self_group`): por
// construção não há terceiros ali — o ClassifyChat cai sempre no tipo mais
// restritivo (`group`) quando os participantes são desconhecidos, e o
// fallback de `CanActOnMessage` mantém o dono com acesso.
func CanActOnMessage(chatKind string, fromMe bool) bool {
	if fromMe {
		return true
	}
	return chatKind == domain.WhatsAppChatKindSelf || chatKind == domain.WhatsAppChatKindSelfGroup
}
