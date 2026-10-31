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

// ContactDirectoryBlock lista os contatos recentes do WhatsApp.
//
// Sem isso o Vito não sabe com quem o usuário está falando: os chats "@lid"
// chegam sem nome e o rótulo genérico "Contato" não permite resolver
// "as mensagens da Ana" nem dizer "a Ana te espera".
func ContactDirectoryBlock(directory []ChatContactSummary) string {
	if len(directory) == 0 {
		return ""
	}
	if len(directory) > 25 {
		directory = directory[:25]
	}
	var b strings.Builder
	b.WriteString("\n<SEUS CONTATOS — conversas recentes do WhatsApp. É daqui que saem os nomes que o usuário usa ao se referir a alguém.>\n")
	for _, c := range directory {
		name := strings.TrimSpace(c.Name)
		if name == "" {
			continue
		}
		preview := strings.TrimSpace(c.Preview)
		age := strings.TrimSpace(c.Age)
		line := "- " + name
		// O alias é o outro nome do mesmo contato (salvo pelo dono x perfil do
		// WhatsApp). Listar os dois evita o "não sei": o usuário pode chamar a
		// pessoa por qualquer um dos dois.
		if alias := strings.TrimSpace(c.Alias); alias != "" {
			line += " (" + alias + ")"
		}
		if age != "" {
			line += " (" + age + ")"
		}
		if preview != "" {
			line += ": " + preview
		}
		b.WriteString(line + "\n")
	}
	b.WriteString("</SEUS CONTATOS>\n")
	return b.String()
}

// PendingConversationsBlock lista as conversas que esperam resposta do usuário.
func PendingConversationsBlock(pending []ChatContactSummary) string {
	if len(pending) == 0 {
		return ""
	}
	if len(pending) > 10 {
		pending = pending[:10]
	}
	var b strings.Builder
	b.WriteString("\n<PENDÊNCIAS DE RESPOSTA — conversas em que a última mensagem NÃO foi sua.>\n")
	for _, c := range pending {
		name := strings.TrimSpace(c.Name)
		if name == "" {
			continue
		}
		preview := strings.TrimSpace(c.Preview)
		age := strings.TrimSpace(c.Age)
		line := "- " + name
		if age != "" {
			line += " (" + age + ")"
		}
		if preview != "" {
			line += ": " + preview
		}
		b.WriteString(line + "\n")
	}
	b.WriteString("</PENDÊNCIAS DE RESPOSTA>\n")
	return b.String()
}

// WhatsAppAssistantDirectives descreve as ações do assistente de WhatsApp.
//
// Emitida só quando há diretório ou pendências, para não poluir o prompt das
// outras surfaces.
func WhatsAppAssistantDirectives(directory, pending []ChatContactSummary) string {
	if len(directory) == 0 && len(pending) == 0 {
		return ""
	}
	return `
DIRETRIZ DE ASSISTENTE DE WHATSAPP (consultar conversas, responder, lembrar):
- Você tem acesso às conversas do WhatsApp do usuário (SEUS CONTATOS e PENDÊNCIAS DE RESPOSTA). Quando ele perguntar sobre uma conversa ("quais as últimas mensagens que a Ana enviou", "o que o João quer"), use "action": "QUERY_CONVERSATION" com o nome do contato e "limit" (padrão 10) — a resposta vem das mensagens reais, não da sua memória.
- Quando ele procurar algo ESPECÍFICO no histórico ("aquela mensagem sobre o contrato", "aquela foto do recibo", "aquele áudio que a Ana mandou"), use "action": "SEARCH_CONVERSATIONS" com "conversation": {"query": "<assunto>", "limit": 8}. A busca cobre também a descrição das imagens e a transcrição dos áudios. NÃO responda "não sei" sem tentar essa busca quando o usuário citar um assunto do passado.
- "quem está me esperando" / "minhas pendências" / "com quem eu preciso falar" -> "action": "LIST_PENDING_CONVERSATIONS".
- "me ajuda a responder a Ana" / "o que eu respondo pro João" -> "action": "DRAFT_REPLY" com o texto pronto no campo "message" (aqui você escreve como se fosse o usuário, e o Vito mostra o rascunho). NÃO envie sem pedido explícito.
- "manda pra Ana" / "envia isso pra João" -> "action": "SEND_WHATSAPP_MESSAGE" com "whatsapp_message": {"chat": "Ana", "text": "..."}. Só use quando o usuário mandar ENVIAR de forma explícita; se o alvo estiver ambíguo, devolva a lista de candidatos. REGRA DE OURO: A IA NUNCA envia mensagem externa de WhatsApp sem confirmação explícita prévia no chat ou clique no botão de envio do card interativo.
- "me lembra de responder a Ana amanhã às 9h" -> "action": "CREATE_REPLY_REMINDER" com "reply_reminder": {"chat": "Ana", "when": "amanhã às 9h", "note": "..."}.
- Ao responder sobre conversas, cite o NOME do contato como o usuário o conhece (o bloco SEUS CONTATOS traz o nome) e diga de onde veio a informação.
- Nunca invente conteúdo de conversa: se a conversa não estiver no diretório, pergunte o nome do contato.
`
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
- O CONTEXTO RECENTE CONTÉM A RESPOSTA quando ela existe. Antes de dizer que não sabe, varra o bloco: mensagens de outros chats podem ser exatamente o que o usuário está retomando ("a reunião que falei com a Ana"). Responder "não sei" com o contexto disponível é um erro — o bloco é a memória do usuário, não ruído.
- Ao decidir se falta informação, considere SEMPRE: texto atual + HISTÓRICO RECENTE + MENSAGEM CITADA + CONTEXTO RECENTE DO WHATSAPP. A coleta progressiva só se aplica ao que NENHUM deles responde.
- NUNCA peça para o usuário repetir, copiar ou colar um conteúdo que já está na MENSAGEM CITADA ou no CONTEXTO RECENTE. A pergunta "sobre o que devo agir?" só é válida se o contexto realmente não resolver.
- INFERIR AÇÃO PELO CONTEÚDO: se a mensagem (ou a citada) trouxer data/horário e descrever um compromisso -> CREATE_EVENT; se for lembrete/tarefa -> CREATE_TODO; se for pergunta sobre a agenda -> QUERY_SCHEDULE; se for pedido de vigilância -> CREATE_TRIGGER.
- AGE E CONFIRME: quando o contexto resolver, execute a ação e confirme de forma curta e explícita o que foi feito (ex: "Agendei: Café com a Ana — quinta, 10h"). Só devolva uma pergunta se a informação for realmente irrecuperável pelo contexto.
- NÃO DUPLIQUE: o CONTEXTO RECENTE inclui o que você já respondeu e o que já foi criado. Não crie duas vezes o mesmo evento ou tarefa.
`
}
