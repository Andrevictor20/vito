package service

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// WhatsAppContextConfig parametrização do contexto conversacional do WhatsApp.
type WhatsAppContextConfig struct {
	ScopeDefault       string
	WindowDefault      int
	WindowMax          int
	TruncChars         int
	MaxAge             time.Duration
	ReferentialEnabled bool
}

// DefaultWhatsAppContextConfig devolve a configuração padrão (SPEC §6.5).
func DefaultWhatsAppContextConfig() WhatsAppContextConfig {
	return WhatsAppContextConfig{
		ScopeDefault:  domain.WhatsAppContextScopeAll,
		WindowDefault: 12,
		WindowMax:     48,
		TruncChars:    240,
		// A janela precisa enxergar pelo menos o mesmo período que o backfill
		// importa (30 dias). Com 72h o histórico importado era filtrado fora e
		// o Vito respondia "não sei" mesmo com o cross-chat ligado.
		MaxAge:             30 * 24 * time.Hour,
		ReferentialEnabled: true,
	}
}

// WhatsAppContextService persiste e monta o contexto de conversa do WhatsApp.
type WhatsAppContextService struct {
	repo domain.WhatsAppConversationRepository
	cfg  WhatsAppContextConfig
}

// NewWhatsAppContextService cria o serviço de contexto do WhatsApp.
func NewWhatsAppContextService(repo domain.WhatsAppConversationRepository, cfg WhatsAppContextConfig) *WhatsAppContextService {
	if cfg.ScopeDefault == "" {
		cfg.ScopeDefault = domain.WhatsAppContextScopeAll
	}
	if cfg.WindowDefault <= 0 {
		cfg.WindowDefault = 12
	}
	if cfg.WindowMax <= 0 {
		cfg.WindowMax = 48
	}
	if cfg.TruncChars <= 0 {
		cfg.TruncChars = 240
	}
	if cfg.MaxAge <= 0 {
		cfg.MaxAge = 72 * time.Hour
	}
	return &WhatsAppContextService{repo: repo, cfg: cfg}
}

// Settings devolve as preferências de escopo do usuário (persistidas ou padrão).
func (s *WhatsAppContextService) Settings(ctx context.Context, userID string) (*domain.WhatsAppContextSettings, error) {
	settings := &domain.WhatsAppContextSettings{
		UserID:     userID,
		Scope:      s.cfg.ScopeDefault,
		WindowSize: s.cfg.WindowDefault,
		UpdatedAt:  time.Now().UTC(),
	}
	if s.repo == nil || userID == "" {
		return settings, nil
	}
	stored, err := s.repo.GetContextSettings(ctx, userID)
	if err != nil {
		return settings, err
	}
	if stored != nil {
		settings.Scope = stored.Scope
		settings.WindowSize = stored.WindowSize
		settings.UpdatedAt = stored.UpdatedAt
	}
	return settings, nil
}

// UpdateSettings valida e persiste o escopo e o tamanho da janela escolhidos pelo usuário.
func (s *WhatsAppContextService) UpdateSettings(ctx context.Context, userID, scope string, windowSize int) (*domain.WhatsAppContextSettings, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("repositório de contexto indisponível")
	}
	normalized := strings.ToLower(strings.TrimSpace(scope))
	switch normalized {
	case domain.WhatsAppContextScopeOff, domain.WhatsAppContextScopeQuoted,
		domain.WhatsAppContextScopeChat, domain.WhatsAppContextScopeAll:
	default:
		return nil, fmt.Errorf("scope inválido: %q (use off, quoted, chat ou all)", scope)
	}
	if windowSize < 0 || windowSize > s.cfg.WindowMax {
		return nil, fmt.Errorf("window_size deve estar entre 0 e %d", s.cfg.WindowMax)
	}

	settings := &domain.WhatsAppContextSettings{
		UserID:     userID,
		Scope:      normalized,
		WindowSize: windowSize,
		UpdatedAt:  time.Now().UTC(),
	}
	if err := s.repo.SaveContextSettings(ctx, settings); err != nil {
		return nil, err
	}
	return settings, nil
}

// PurgeMessages remove todas as mensagens arquivadas do usuário (botão "Limpar histórico").
func (s *WhatsAppContextService) PurgeMessages(ctx context.Context, userID string) error {
	if s.repo == nil {
		return nil
	}
	return s.repo.DeleteMessages(ctx, userID)
}

// Archive persiste uma mensagem do WhatsApp no shadow inbox.
func (s *WhatsAppContextService) Archive(ctx context.Context, msg *domain.WhatsAppConversationMessage) error {
	if s.repo == nil || msg == nil {
		return nil
	}
	return s.repo.SaveMessage(ctx, msg)
}

// PruneOlderThan remove mensagens fora da retenção configurada.
func (s *WhatsAppContextService) PruneOlderThan(ctx context.Context, cutoff time.Time) (int64, error) {
	if s.repo == nil {
		return 0, nil
	}
	return s.repo.PruneOlderThan(ctx, cutoff)
}

// Window monta a janela de contexto entregue ao assistente.
//
// Regras (SPEC §7):
//   - `off`    => nenhuma janela;
//   - `quoted` => nenhuma janela (o bloco da mensagem citada é montado à parte);
//   - `chat`   => mensagens apenas do chat em que o Vito foi acionado;
//   - `all`    =>janela de todos os chats, PERMITIDO apenas em conversas pessoais
//     (`self`, `self_group`) — em `group`/`direct` o contexto fica restrito ao chat.
func (s *WhatsAppContextService) Window(ctx context.Context, userID, chatJID, chatKind, currentText, excludeID string) []ai.ChatMessageContext {
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

	// Tier 0: mensagem autocontida não precisa da janela completa.
	if s.cfg.ReferentialEnabled && !NeedsFullWindow(currentText) && size > minTier0Window {
		size = minTier0Window
	}

	since := time.Now().UTC().Add(-s.cfg.MaxAge)
	crossChat := settings.Scope == domain.WhatsAppContextScopeAll && AllowsCrossChat(chatKind)

	var messages []domain.WhatsAppConversationMessage
	if crossChat {
		messages = s.crossChatWindow(ctx, userID, chatJID, size, since)
	} else {
		messages, err = s.repo.RecentMessages(ctx, userID, chatJID, size, since)
		if err != nil {
			return nil
		}
	}

	window := make([]ai.ChatMessageContext, 0, len(messages))
	for _, m := range messages {
		if excludeID != "" && m.ID == excludeID {
			continue
		}
		text := strings.TrimSpace(m.Text)
		if text == "" {
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

// maxMessagesPerChatInWindow limita quantas mensagens de um MESMO chat entram na
// parte cross-chat da janela. Sem esse teto, uma conversa muito ativa (o chat
// "Você") expulsa as outras — e o Vito nunca via a conversa que o usuário
// estava retomando.
const maxMessagesPerChatInWindow = 3

// crossChatWindow monta a janela com diversidade: metade do chat em que o Vito
// foi acionado e metade distribuída pelos demais chats (no máximo
// maxMessagesPerChatInWindow de cada), do mais recente para o mais antigo.
func (s *WhatsAppContextService) crossChatWindow(ctx context.Context, userID, chatJID string, size int, since time.Time) []domain.WhatsAppConversationMessage {
	half := size / 2
	if half < 1 {
		half = 1
	}
	otherLimit := size - half

	selected := make([]domain.WhatsAppConversationMessage, 0, size)

	current, err := s.repo.RecentMessages(ctx, userID, chatJID, half+1, since)
	if err == nil && len(current) > half {
		current = current[len(current)-half:]
	}
	selected = append(selected, current...)

	others, err := s.repo.RecentMessagesAcrossChats(ctx, userID, size*4, since)
	if err == nil {
		perChat := make(map[string]int, 8)
		chosen := 0
		for i := len(others) - 1; i >= 0 && chosen < otherLimit; i-- {
			m := others[i]
			if m.ChatJID == chatJID {
				continue
			}
			if perChat[m.ChatJID] >= maxMessagesPerChatInWindow {
				continue
			}
			perChat[m.ChatJID]++
			selected = append(selected, m)
			chosen++
		}
	}

	sort.SliceStable(selected, func(i, j int) bool {
		return selected[i].MessageTimestamp.Before(selected[j].MessageTimestamp)
	})
	if len(selected) > size {
		selected = selected[len(selected)-size:]
	}
	return selected
}

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

// minTier0Window é o piso da janela quando a mensagem é autocontida.
// 6 (e não 3) porque uma janela de 3 raramente carrega a conversa que o
// usuário está retomando — o Vito voltava a dizer "não sei".
const minTier0Window = 6

// messageKindVito marca as mensagens geradas pelo próprio Vito.
const messageKindVito = "vito"

// referentialPattern detecta marcadores anafóricos de referência/continuidade.
//
// Dois grupos:
//   - anáforas: pronomes e expressões que **apontam para trás** ("isso", "aquilo",
//     "sobre essa");
//   - marcadores de **recuperação de memória**: "lembra", "falei", "aquela conversa",
//     "ontem" — o usuário pede algo que só existe no histórico.
//
// Verbos de comando genéricos ("agenda", "anota", "cria") NÃO entram aqui: em
// "agenda uma reunião de alinhamento" o verbo é comando, não referência.
var referentialPattern = regexp.MustCompile(`(?i)\b(isso|aquilo|essa|esse|essas|esses|ele|ela|eles|elas|aqui|disso|dessa|desse|nisso|sobre isso|sobre aquilo|sobre essa|sobre esse|sobre ele|sobre ela|daquele|daquela|lembra|lembre|falei|falamos|conversa|conversamos|aconteceu|ontem|anteontem|sobre o que|que eu te contei|que eu falei)\b`)

// NeedsFullWindow decide se a mensagem do usuário exige a janela completa de contexto.
//
// Mensagem curta ou com marcador referencial ("isso", "aquilo", "sobre essa") depende do
// contexto para ser entendida. Mensagem autocontida ("cria uma tarefa revisar contrato")
// dispensa a janela completa — economia de tokens sem perda de resultado (SPEC §10.2 P2).
func NeedsFullWindow(text string) bool {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return true
	}
	if referentialPattern.MatchString(trimmed) {
		return true
	}
	return len([]rune(trimmed)) <= 24
}

// TruncateContextText corta o texto no limite de caracteres, preferindo fronteira de palavra.
func TruncateContextText(text string, maxChars int) string {
	trimmed := strings.TrimSpace(text)
	if maxChars <= 0 {
		return trimmed
	}
	runes := []rune(trimmed)
	if len(runes) <= maxChars {
		return trimmed
	}
	cut := string(runes[:maxChars])
	if idx := strings.LastIndex(cut, " "); idx > maxChars/2 {
		cut = cut[:idx]
	}
	return cut + "…"
}

// windowSender define quem escreveu a mensagem na janela de contexto.
func windowSender(m domain.WhatsAppConversationMessage) string {
	if m.Kind == messageKindVito || IsVitoMessage(m.Text) {
		return "Vito"
	}
	if m.FromMe {
		return "Você"
	}
	if name := strings.TrimSpace(m.SenderName); name != "" {
		return name
	}
	return "Contato"
}

// windowChatLabel define o rótulo do chat de origem na janela de contexto.
func windowChatLabel(m domain.WhatsAppConversationMessage) string {
	if label := strings.TrimSpace(m.ChatLabel); label != "" {
		return label
	}
	switch m.ChatKind {
	case domain.WhatsAppChatKindSelf:
		return "Você"
	case domain.WhatsAppChatKindDirect:
		return "Contato"
	default:
		return "Grupo"
	}
}

// describeWindowContent resume o conteúdo da janela para o log de diagnóstico.
// Sem isso, "não sei" é impossível de depurar: via-se o tamanho, não o que o
// Vito realmente leu.
func describeWindowContent(window []ai.ChatMessageContext) string {
	if len(window) == 0 {
		return "(vazia)"
	}
	parts := make([]string, 0, len(window))
	for i, m := range window {
		if i >= 6 {
			parts = append(parts, fmt.Sprintf("(+%d mais)", len(window)-i))
			break
		}
		sender := strings.TrimSpace(m.Sender)
		if sender == "" {
			sender = "?"
		}
		chat := strings.TrimSpace(m.Chat)
		if chat == "" {
			chat = "?"
		}
		parts = append(parts, fmt.Sprintf("[%s/%s] %s", chat, sender, TruncateContextText(m.Text, 90)))
	}
	return strings.Join(parts, " | ")
}

// describeWindowChats lista os chats presentes na janela (para o log de diagnóstico).
func describeWindowChats(window []ai.ChatMessageContext) string {
	if len(window) == 0 {
		return "-"
	}
	seen := make(map[string]bool, 4)
	labels := make([]string, 0, 4)
	for _, m := range window {
		label := strings.TrimSpace(m.Chat)
		if label == "" || seen[label] {
			continue
		}
		seen[label] = true
		labels = append(labels, label)
	}
	return strings.Join(labels, ",")
}
