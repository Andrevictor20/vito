package ai

import (
	"fmt"
	"strings"
)

// QuotedContextBlock renderiza a mensagem que o usuário apontou/citou no WhatsApp.
// Sem texto citado, devolve string vazia (nenhum ruído no prompt).
func QuotedContextBlock(quoted string) string {
	q := strings.TrimSpace(quoted)
	if q == "" {
		return ""
	}
	return "\n<MENSAGEM CITADA PELO USUÁRIO — é a ela que a mensagem atual se refere. Resolva a referência por ela.>\n" +
		q + "\n</MENSAGEM CITADA PELO USUÁRIO>\n"
}

// ConversationWindowBlock renderiza a janela recente de mensagens do WhatsApp.
// Cada linha carrega o chat de origem para que a IA resolva referências entre conversas.
func ConversationWindowBlock(window []ChatMessageContext) string {
	if len(window) == 0 {
		return ""
	}

	var b strings.Builder
	b.WriteString("\n<CONTEXTO RECENTE DO WHATSAPP — mensagens reais dos chats do usuário. Use para resolver \"isso/aquilo/esse\", para saber o que já foi combinado e o que você já fez.>\n")
	for _, m := range window {
		text := strings.TrimSpace(m.Text)
		if text == "" {
			continue
		}
		chat := strings.TrimSpace(m.Chat)
		if chat == "" {
			chat = "WhatsApp"
		}
		sender := strings.TrimSpace(m.Sender)
		if sender == "" {
			sender = "Usuário"
		}
		b.WriteString(fmt.Sprintf("- [%s] %s: %s\n", chat, sender, text))
	}
	b.WriteString("</CONTEXTO RECENTE DO WHATSAPP>\n")
	return b.String()
}

// WhatsAppContextDirectives devolve as diretivas de resolução de referência e ação
// aplicáveis à superfície do WhatsApp. Só é emitida quando há contexto de verdade,
// para não alterar o comportamento dos demais canais (app e desktop).
func WhatsAppContextDirectives(quoted string, window []ChatMessageContext) string {
	if strings.TrimSpace(quoted) == "" && len(window) == 0 {
		return ""
	}
	return `
DIRETRIZ DE CONTEXTO DO WHATSAPP (RESOLVER REFERÊNCIA E AGIR):
- A MENSAGEM CITADA e o CONTEXTO RECENTE DO WHATSAPP são a fonte de verdade sobre o que o usuário está falando. Resolva por eles pronomes e referências ("isso", "aquilo", "esse", "essa", "ele", "ela", "aí", "isso aqui", "o de ontem", "a que falei").
- Ao decidir se falta informação, considere SEMPRE: texto atual + HISTÓRICO RECENTE + MENSAGEM CITADA + CONTEXTO RECENTE DO WHATSAPP. A coleta progressiva só se aplica ao que NENHUM deles responde.
- NUNCA peça para o usuário repetir, copiar ou colar um conteúdo que já está na MENSAGEM CITADA ou no CONTEXTO RECENTE. A pergunta "sobre o que devo agir?" só é válida se o contexto realmente não resolver.
- INFERIR AÇÃO PELO CONTEÚDO: se a mensagem (ou a citada) trouxer data/horário e descrever um compromisso -> CREATE_EVENT; se for lembrete/tarefa -> CREATE_TODO; se for pergunta sobre a agenda -> QUERY_SCHEDULE; se for pedido de vigilância -> CREATE_TRIGGER.
- AGE E CONFIRME: quando o contexto resolver, execute a ação e confirme de forma curta e explícita o que foi feito (ex: "Agendei: Café com a Ana — quinta, 10h"). Só devolva uma pergunta se a informação for realmente irrecuperável pelo contexto.
- NÃO DUPLIQUE: o CONTEXTO RECENTE inclui o que você já respondeu e o que já foi criado. Não crie duas vezes o mesmo evento ou tarefa.
`
}
