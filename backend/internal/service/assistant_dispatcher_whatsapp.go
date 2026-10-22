package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// executeWhatsAppAction despacha as ações do assistente de WhatsApp:
// consultar conversas, listar pendências, rascunhar respostas, enviar
// mensagens em nome do usuário e criar lembretes de resposta.
func (s *AssistantService) executeWhatsAppAction(ctx context.Context, userID string, intent *ai.ParsedIntent, input ai.UserInput, res *AssistantResponse) (*AssistantResponse, error) {
	switch intent.Action {
	case ai.ActionQueryConversation:
		return s.actionQueryConversation(ctx, userID, intent, input, res)
	case ai.ActionSearchConversations:
		return s.actionSearchConversations(ctx, userID, intent, input, res)
	case ai.ActionListPendingConversations:
		return s.actionListPendingConversations(ctx, userID, intent, res)
	case ai.ActionDraftReply:
		return s.actionDraftReply(ctx, userID, intent, res)
	case ai.ActionSendWhatsAppMessage:
		return s.actionSendWhatsAppMessage(ctx, userID, intent, res)
	case ai.ActionCreateReplyReminder:
		return s.actionCreateReplyReminder(ctx, userID, intent, res)
	}
	return res, nil
}

// actionSearchConversations busca no histórico do WhatsApp por conteúdo.
//
// É a resposta a "aquela mensagem da Ana sobre o contrato": a janela de contexto
// só traz o mais recente e a conversa só devolvia as últimas mensagens. A
// busca cobre o texto E a descrição das mídias (o que o Vito "viu" numa foto).
func (s *AssistantService) actionSearchConversations(ctx context.Context, userID string, intent *ai.ParsedIntent, input ai.UserInput, res *AssistantResponse) (*AssistantResponse, error) {
	if intent.Conversation == nil || strings.TrimSpace(intent.Conversation.Query) == "" {
		return clarificationResponse(intent, "O que devo procurar no histórico? Me diga o assunto (ex: 'a mensagem sobre o contrato')."), nil
	}
	if s.waDirectory == nil {
		res.Message = "Não consegui acessar seu histórico do WhatsApp agora."
		res.Reply = res.Message
		return res, nil
	}

	query := strings.TrimSpace(intent.Conversation.Query)
	limit := intent.Conversation.Limit
	if limit <= 0 {
		limit = 8
	}
	messages, err := s.waDirectory.SearchMessages(ctx, userID, query, limit)
	if err != nil {
		log.Printf("⚠️ [AssistantService] falha ao buscar no histórico (user=%s): %v", userID, err)
		res.Message = "Não consegui buscar no seu histórico agora. Tente de novo em instantes."
		res.Reply = res.Message
		return res, nil
	}
	if len(messages) == 0 {
		res.Message = fmt.Sprintf("Não encontrei nada sobre %q no seu histórico do WhatsApp.", query)
		res.Reply = res.Message
		return res, nil
	}

	summary, sumErr := s.summarizeFoundMessages(ctx, input, query, messages)
	if sumErr != nil || strings.TrimSpace(summary) == "" {
		summary = formatFoundMessages(query, messages)
	}
	res.Message = summary
	res.Reply = summary
	return res, nil
}

// summarizeFoundMessages pede à IA um resumo dos trechos encontrados.
func (s *AssistantService) summarizeFoundMessages(ctx context.Context, input ai.UserInput, query string, messages []domain.WhatsAppConversationMessage) (string, error) {
	window := make([]ai.ChatMessageContext, 0, len(messages))
	for _, m := range messages {
		sender := "Contato"
		switch {
		case m.Kind == messageKindVito:
			sender = "Vito"
		case m.FromMe:
			sender = "Você"
		case strings.TrimSpace(m.SenderName) != "":
			sender = m.SenderName
		}
		text := strings.TrimSpace(m.Text)
		if text == "" {
			text = strings.TrimSpace(m.MediaText)
		}
		if text == "" {
			continue
		}
		window = append(window, ai.ChatMessageContext{
			Sender: sender,
			Text:   TruncateContextText(text, 400),
			Chat:   windowChatLabel(m),
			Kind:   m.Kind,
		})
	}
	if len(window) == 0 {
		return "", fmt.Errorf("nenhum trecho legível encontrado")
	}

	question := fmt.Sprintf("O que o usuário quis saber sobre %q? Responda com base nos trechos encontrados, citando o remetente e a data quando houver.", query)
	out, err := s.aiGateway.ParseIntent(ctx, ai.UserInput{
		Text:               question,
		Timezone:           input.Timezone,
		Now:                input.Now,
		ConversationWindow: window,
	})
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out.Message), nil
}

// formatFoundMessages entrega os trechos reais quando a IA não conseguiu resumir.
func formatFoundMessages(query string, messages []domain.WhatsAppConversationMessage) string {
	var b strings.Builder
	b.WriteString(fmt.Sprintf("Encontrei no histórico sobre %q:\n", query))
	for _, m := range messages {
		text := strings.TrimSpace(m.Text)
		if text == "" {
			text = strings.TrimSpace(m.MediaText)
		}
		if text == "" {
			continue
		}
		sender := "Contato"
		if m.Kind == messageKindVito {
			sender = "Vito"
		} else if m.FromMe {
			sender = "Você"
		} else if strings.TrimSpace(m.SenderName) != "" {
			sender = m.SenderName
		}
		b.WriteString(fmt.Sprintf("- [%s] %s: %s\n", windowChatLabel(m), sender, TruncateContextText(text, 240)))
	}
	return strings.TrimSpace(b.String())
}

// actionQueryConversation lê as últimas mensagens de uma conversa e responde
// com um resumo feito pela IA (segunda chamada, com as mensagens reais como
// janela de contexto).
func (s *AssistantService) actionQueryConversation(ctx context.Context, userID string, intent *ai.ParsedIntent, input ai.UserInput, res *AssistantResponse) (*AssistantResponse, error) {
	if intent.Conversation == nil || strings.TrimSpace(intent.Conversation.Chat) == "" {
		return clarificationResponse(intent, "De qual conversa você quer que eu leia? Me diga o nome do contato (ex: 'a Ana')."), nil
	}
	if s.waDirectory == nil {
		res.Message = "Não consegui acessar suas conversas do WhatsApp agora."
		res.Reply = res.Message
		return res, nil
	}

	chat, err := s.waDirectory.ResolveChat(ctx, userID, intent.Conversation.Chat)
	if err != nil {
		return s.replyChatResolutionError(intent, err), nil
	}

	limit := intent.Conversation.Limit
	if limit <= 0 {
		limit = 10
	}
	messages, err := s.waDirectory.MessagesOf(ctx, userID, chat.ChatJID, limit)
	if err != nil {
		log.Printf("⚠️ [AssistantService] falha ao ler conversa (user=%s, chat=%s): %v", userID, chat.ChatJID, err)
		res.Message = "Não consegui ler essa conversa agora. Tente de novo em instantes."
		res.Reply = res.Message
		return res, nil
	}
	if len(messages) == 0 {
		res.Message = fmt.Sprintf("Não encontrei mensagens recentes na conversa com %s.", s.waDirectory.LabelOf(chat))
		res.Reply = res.Message
		return res, nil
	}

	summary, sumErr := s.summarizeConversation(ctx, userID, input, chat, messages, intent.Message)
	if sumErr != nil || strings.TrimSpace(summary) == "" {
		// Sem a 2ª chamada, entrega o conteúdo real (fato >loquentio).
		summary = formatConversationMessages(s.waDirectory.LabelOf(chat), messages)
	}
	res.Message = summary
	res.Reply = summary
	return res, nil
}

// actionListPendingConversations lista as conversas que esperam resposta.
func (s *AssistantService) actionListPendingConversations(ctx context.Context, userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	if s.waDirectory == nil {
		res.Message = "Não consegui acessar suas conversas do WhatsApp agora."
		res.Reply = res.Message
		return res, nil
	}
	pending, err := s.waDirectory.Pending(ctx, userID)
	if err != nil {
		res.Message = "Não consegui verificar suas pendências agora. Tente de novo em instantes."
		res.Reply = res.Message
		return res, nil
	}
	if len(pending) == 0 {
		res.Message = "Nenhuma conversa esperando resposta ✅"
		res.Reply = res.Message
		return res, nil
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("%d conversa(s) esperando sua resposta:\n", len(pending)))
	for _, c := range pending {
		label := s.waDirectory.LabelOf(&c)
		line := "- " + label
		if age := humanizeChatAge(c.LastAt); age != "" {
			line += " (" + age + ")"
		}
		if preview := strings.TrimSpace(c.LastText); preview != "" {
			line += ": " + TruncateContextText(preview, 120)
		}
		b.WriteString(line + "\n")
	}
	res.Message = strings.TrimSpace(b.String())
	res.Reply = res.Message
	return res, nil
}

// actionDraftReply entrega o rascunho que a IA escreveu para um contato.
// O rascunho NÃO é enviado: o usuário decide.
func (s *AssistantService) actionDraftReply(ctx context.Context, userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	draft := strings.TrimSpace(intent.Message)
	if draft == "" {
		return clarificationResponse(intent, "Quer que eu escreva o rascunho? Me diga para quem e sobre o quê (ex: 'rascunhe uma resposta pra Ana sobre o contrato')."), nil
	}
	target := ""
	if s.waDirectory != nil {
		if chat, err := s.waDirectory.ResolveChat(ctx, userID, intent.Conversation.Chat); err == nil {
			target = s.waDirectory.LabelOf(chat)
		}
	}
	if target == "" {
		res.Message = "Rascunho pronto (não enviei):\n\n" + draft
		res.Reply = res.Message
		return res, nil
	}
	res.Message = fmt.Sprintf("Rascunho para %s (não enviei):\n\n%s", target, draft)
	res.Reply = res.Message
	return res, nil
}

// actionSendWhatsAppMessage envia a mensagem em nome do usuário.
func (s *AssistantService) actionSendWhatsAppMessage(ctx context.Context, userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	if intent.WhatsAppMessage == nil || strings.TrimSpace(intent.WhatsAppMessage.Text) == "" {
		return clarificationResponse(intent, "O que eu devo enviar? Me diga o texto e para quem (ex: 'manda pra Ana que quinta está bom')."), nil
	}
	if s.waDirectory == nil || s.waSender == nil {
		res.Message = "Não consegui acessar o WhatsApp agora. Nada foi enviado."
		res.Reply = res.Message
		return res, nil
	}

	chat, err := s.waDirectory.ResolveChat(ctx, userID, intent.WhatsAppMessage.Chat)
	if err != nil {
		return s.replyChatResolutionError(intent, err), nil
	}
	if err := s.waSender.SendWhatsAppMessage(ctx, userID, chat.ChatJID, intent.WhatsAppMessage.Text); err != nil {
		log.Printf("⚠️ [AssistantService] falha ao enviar mensagem do WhatsApp (user=%s, chat=%s): %v", userID, chat.ChatJID, err)
		res.Message = "Não consegui enviar a mensagem agora. Nada foi enviado — tenta de novo em instantes."
		res.Reply = res.Message
		return res, nil
	}
	res.Message = fmt.Sprintf("Enviei para %s:\n\n%s", s.waDirectory.LabelOf(chat), strings.TrimSpace(intent.WhatsAppMessage.Text))
	res.Reply = res.Message
	return res, nil
}

// actionCreateReplyReminder cria a tarefa/lembrete de responder alguém.
func (s *AssistantService) actionCreateReplyReminder(ctx context.Context, userID string, intent *ai.ParsedIntent, res *AssistantResponse) (*AssistantResponse, error) {
	if intent.ReplyReminder == nil || strings.TrimSpace(intent.ReplyReminder.Chat) == "" {
		return clarificationResponse(intent, "Me lembra de responder quem? E quando (ex: 'a Ana, amanhã às 9h')?"), nil
	}
	if s.todoSvc == nil {
		res.Message = "Não consegui criar o lembrete agora. Tente de novo em instantes."
		res.Reply = res.Message
		return res, nil
	}

	label := intent.ReplyReminder.Chat
	if s.waDirectory != nil {
		if chat, err := s.waDirectory.ResolveChat(ctx, userID, intent.ReplyReminder.Chat); err == nil {
			label = s.waDirectory.LabelOf(chat)
		}
	}

	title := "Responder " + label
	if note := strings.TrimSpace(intent.ReplyReminder.Note); note != "" {
		title += " — " + note
	}
	var due, remind *time.Time
	if !intent.ReplyReminder.When.IsZero() {
		when := intent.ReplyReminder.When
		due = &when
		remind = &when
	}

	todo, err := s.todoSvc.CreateTodoWithOptions(userID, domain.CreateTodoInput{
		Title:    title,
		Priority: "medium",
		DueDate:  due,
		RemindAt: remind,
	})
	if err != nil {
		log.Printf("⚠️ [AssistantService] falha ao criar lembrete de resposta (user=%s, chat=%s): %v", userID, intent.ReplyReminder.Chat, err)
		res.Message = "Não consegui criar o lembrete agora. Tente de novo em instantes."
		res.Reply = res.Message
		return res, nil
	}
	res.Todo = todo
	res.Message = fmt.Sprintf("Combinado — te lembro de responder %s%s.", label, whenSuffix(intent.ReplyReminder.When))
	res.Reply = res.Message
	return res, nil
}

// replyChatResolutionError transforma um erro de resolução em uma pergunta clara.
func (s *AssistantService) replyChatResolutionError(intent *ai.ParsedIntent, err error) *AssistantResponse {
	var ambiguous *ErrAmbiguousChat
	if errors.As(err, &ambiguous) {
		return clarificationResponse(intent, fmt.Sprintf("Você quer dizer %s? Me diga qual.", strings.Join(ambiguous.Candidates, " ou ")))
	}
	var notFound *ErrChatNotFound
	if errors.As(err, &notFound) {
		return clarificationResponse(intent, fmt.Sprintf("Não encontrei nenhuma conversa com %q. Qual o nome do contato?", notFound.Query))
	}
	return clarificationResponse(intent, "Não consegui identificar a conversa. Qual o nome do contato?")
}

// summarizeConversation pede à IA um resumo das mensagens reais da conversa.
func (s *AssistantService) summarizeConversation(ctx context.Context, userID string, input ai.UserInput, chat *domain.WhatsAppChatSummary, messages []domain.WhatsAppConversationMessage, question string) (string, error) {
	window := make([]ai.ChatMessageContext, 0, len(messages))
	for _, m := range messages {
		sender := "Contato"
		switch {
		case m.Kind == messageKindVito:
			sender = "Vito"
		case m.FromMe:
			sender = "Você"
		case strings.TrimSpace(m.SenderName) != "":
			sender = m.SenderName
		}
		window = append(window, ai.ChatMessageContext{
			Sender: sender,
			Text:   TruncateContextText(m.Text, 400),
			Chat:   chat.ChatLabel,
		})
	}

	text := strings.TrimSpace(question)
	if text == "" {
		text = fmt.Sprintf("Quais as últimas mensagens que %s enviou?", chat.ChatLabel)
	}
	out, err := s.aiGateway.ParseIntent(ctx, ai.UserInput{
		Text:               text,
		Timezone:           input.Timezone,
		Now:                input.Now,
		ConversationWindow: window,
	})
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out.Message), nil
}

// formatConversationMessages entrega o conteúdo real quando a IA não conseguiu resumir.
func formatConversationMessages(label string, messages []domain.WhatsAppConversationMessage) string {
	var b strings.Builder
	b.WriteString(fmt.Sprintf("Últimas mensagens de %s:\n", label))
	for _, m := range messages {
		sender := "Contato"
		if m.Kind == messageKindVito {
			sender = "Vito"
		} else if m.FromMe {
			sender = "Você"
		} else if strings.TrimSpace(m.SenderName) != "" {
			sender = m.SenderName
		}
		b.WriteString(fmt.Sprintf("- %s: %s\n", sender, TruncateContextText(m.Text, 240)))
	}
	return strings.TrimSpace(b.String())
}

// whenSuffix formata o "quando" do lembrete para a frase de confirmação.
func whenSuffix(when time.Time) string {
	if when.IsZero() {
		return ""
	}
	return " " + when.Format("02/01 às 15:04")
}
