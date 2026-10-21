package service

import (
	"context"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// SelfWindow devolve a janela de contexto para as surfaces do APP e do DESKTOP.
//
// No WhatsApp existe um "chat atual" (onde o Vito foi acionado) e a segurança
// exige não cruzar chats quando a resposta será entregue a terceiros. No app e
// no desktop a resposta só é vista pelo próprio usuário, então o escopo `all`
// pode trazer todos os chats com segurança.
//
// Mapeamento do escopo nas surfaces do app:
//   - `off`    => nada;
//   - `quoted` => nada (não há citação no app);
//   - `chat`   => apenas a conversa "Você" (chat_kind = self);
//   - `all`    => todos os chats do usuário.
func (s *WhatsAppContextService) SelfWindow(ctx context.Context, userID, currentText string) []ai.ChatMessageContext {
	if s.repo == nil {
		return nil
	}
	settings, err := s.Settings(ctx, userID)
	if err != nil {
		return nil
	}
	if settings.Scope == domain.WhatsAppContextScopeOff || settings.Scope == domain.WhatsAppContextScopeQuoted {
		return nil
	}
	size := settings.WindowSize
	if size <= 0 {
		return nil
	}
	if s.cfg.ReferentialEnabled && !NeedsFullWindow(currentText) && size > minTier0Window {
		size = minTier0Window
	}

	since := time.Now().UTC().Add(-s.cfg.MaxAge)
	var messages []domain.WhatsAppConversationMessage
	if settings.Scope == domain.WhatsAppContextScopeAll {
		messages, err = s.repo.RecentMessagesAcrossChats(ctx, userID, size, since)
	} else {
		messages, err = s.repo.RecentMessagesByKind(ctx, userID, domain.WhatsAppChatKindSelf, size, since)
	}
	if err != nil {
		return nil
	}

	window := make([]ai.ChatMessageContext, 0, len(messages))
	for _, m := range messages {
		text := strings.TrimSpace(m.Text)
		if text == "" {
			continue
		}
		if isSensitiveContextMessage(text) {
			continue
		}
		window = append(window, ai.ChatMessageContext{
			Sender: windowSender(m),
			Text:   TruncateContextText(text, s.cfg.TruncChars),
			Chat:   windowChatLabel(m),
		})
	}
	return window
}

// WhatsAppContextPreview mostra ao usuário o que o Vito está enxergando agora.
type WhatsAppContextPreview struct {
	Scope          string   `json:"scope"`
	WindowSize     int      `json:"window_size"`
	MaxAgeDays     int      `json:"max_age_days"`
	ArchivedTotal  int64    `json:"archived_total"`
	WindowMessages int      `json:"window_messages"`
	Chats          []string `json:"chats"`
	Sample         []string `json:"sample"`
}

// Preview monta a prévia do contexto (usada pela tela do Perfil).
func (s *WhatsAppContextService) Preview(ctx context.Context, userID string) (*WhatsAppContextPreview, error) {
	settings, err := s.Settings(ctx, userID)
	if err != nil {
		return nil, err
	}
	since := time.Now().UTC().Add(-s.cfg.MaxAge)
	preview := &WhatsAppContextPreview{
		Scope:      settings.Scope,
		WindowSize: settings.WindowSize,
		MaxAgeDays: int(s.cfg.MaxAge.Hours() / 24),
		Chats:      []string{},
		Sample:     []string{},
	}
	if s.repo == nil {
		return preview, nil
	}

	total, err := s.repo.CountMessages(ctx, userID, since)
	if err != nil {
		return nil, err
	}
	preview.ArchivedTotal = total

	window := s.SelfWindow(ctx, userID, "")
	preview.WindowMessages = len(window)

	seen := map[string]bool{}
	for _, m := range window {
		label := strings.TrimSpace(m.Chat)
		if label != "" && !seen[label] {
			seen[label] = true
			preview.Chats = append(preview.Chats, label)
		}
	}
	for i, m := range window {
		if i >= 5 {
			break
		}
		preview.Sample = append(preview.Sample, TruncateContextText(m.Text, 120))
	}
	return preview, nil
}
