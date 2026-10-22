package service

import (
	"context"
	"fmt"
	"regexp"
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

// Relabel reetiqueta as conversas arquivadas (nomes dos chats @lid).
func (s *WhatsAppContextService) Relabel(ctx context.Context, userID string, labels map[string]string) (int64, error) {
	if s.repo == nil {
		return 0, nil
	}
	return s.repo.UpdateChatLabels(ctx, userID, labels)
}

// MessageByID devolve uma mensagem arquivada pelo id (resolve a citada).
func (s *WhatsAppContextService) MessageByID(ctx context.Context, userID, id string) (*domain.WhatsAppConversationMessage, error) {
	if s.repo == nil {
		return nil, nil
	}
	return s.repo.MessageByID(ctx, userID, id)
}

// SaveMediaText grava o que o Vito leu de uma mídia (transcrição ou descrição).
func (s *WhatsAppContextService) SaveMediaText(ctx context.Context, userID, id, text string) error {
	if s.repo == nil {
		return nil
	}
	return s.repo.UpdateMediaResult(ctx, userID, id, domain.WhatsAppMediaStatusDone, text)
}

// SaveMediaStatus grava o estado do enriquecimento (done/failed).
func (s *WhatsAppContextService) SaveMediaStatus(ctx context.Context, userID, id, status string) error {
	if s.repo == nil {
		return nil
	}
	return s.repo.UpdateMediaResult(ctx, userID, id, status, "")
}

// PendingMedia devolve as mídias ainda não analisadas (mais antigas primeiro).
func (s *WhatsAppContextService) PendingMedia(ctx context.Context, userID string, limit int, since time.Time) ([]domain.WhatsAppConversationMessage, error) {
	if s.repo == nil {
		return nil, nil
	}
	return s.repo.PendingMedia(ctx, userID, limit, since)
}

// SenderNames devolve o nome de perfil (pushName) mais recente de cada chat.
func (s *WhatsAppContextService) SenderNames(ctx context.Context, userID string, since time.Time) (map[string]string, error) {
	if s.repo == nil {
		return map[string]string{}, nil
	}
	return s.repo.SenderNamesByChat(ctx, userID, since)
}

// MediaStatus conta as mídias do usuário por estado de enriquecimento.
func (s *WhatsAppContextService) MediaStatus(ctx context.Context, userID string, since time.Time) (map[string]int64, error) {
	if s.repo == nil {
		return map[string]int64{}, nil
	}
	return s.repo.MediaStatus(ctx, userID, since)
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
			// Mensagem de mídia sem descrição ainda: entra só se o Vito já a leu
			// (media_text) — senão não há nada a dizer sobre ela.
			text = strings.TrimSpace(m.MediaText)
		}
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
			Quoted: TruncateContextText(quotedTextOf(&m), 160),
			Kind:   m.Kind,
		})
	}
	return window
}

// quotedTextOf devolve o conteúdo legível de uma mensagem citada.
//
// Uma imagem citada não tem texto: o que o Vito "viu" nela é a descrição
// (media_text). Sem ela, o bloco da citação sairia vazio e o Vito não
// entenderia a que a mensagem se refere.
func quotedTextOf(m *domain.WhatsAppConversationMessage) string {
	if m == nil {
		return ""
	}
	if media := strings.TrimSpace(m.MediaText); media != "" {
		label := "imagem"
		if m.MediaKind == domain.WhatsAppMediaKindAudio {
			label = "áudio"
		}
		return fmt.Sprintf("[%s] %s", label, media)
	}
	return strings.TrimSpace(m.Text)
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
