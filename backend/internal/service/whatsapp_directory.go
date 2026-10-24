package service

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// ErrChatNotFound é devolvido quando o nome informado não casa com nenhuma conversa.
type ErrChatNotFound struct {
	Query string
}

func (e *ErrChatNotFound) Error() string {
	return fmt.Sprintf("nenhuma conversa encontrada para %q", e.Query)
}

// ErrAmbiguousChat é devolvido quando o nome casa com mais de uma conversa.
type ErrAmbiguousChat struct {
	Query      string
	Candidates []string
}

func (e *ErrAmbiguousChat) Error() string {
	return fmt.Sprintf("%q corresponde a %d conversas: %s", e.Query, len(e.Candidates), strings.Join(e.Candidates, ", "))
}

// WhatsAppDirectoryService monta o diretório de contatos do WhatsApp e a lista
// de conversas que esperam resposta do usuário.
//
// Tudo é DERIVADO do shadow inbox — não há estado novo: uma conversa deixa de
// ser pendência no instante em que o usuário responde.
type WhatsAppDirectoryService struct {
	repo        domain.WhatsAppConversationRepository
	cfg         WhatsAppContextConfig
	contacts    *WhatsAppContactsCache
	contactRepo domain.SyncedContactRepository
}

// NewWhatsAppDirectoryService cria o serviço de diretório e pendências.
func NewWhatsAppDirectoryService(repo domain.WhatsAppConversationRepository, cfg WhatsAppContextConfig, contacts *WhatsAppContactsCache) *WhatsAppDirectoryService {
	return &WhatsAppDirectoryService{repo: repo, cfg: cfg, contacts: contacts}
}

// Chats devolve o resumo de todas as conversas recentes do usuário.
func (s *WhatsAppDirectoryService) Chats(ctx context.Context, userID string) ([]domain.WhatsAppChatSummary, error) {
	if s == nil || s.repo == nil {
		return nil, nil
	}
	since := time.Now().UTC().Add(-s.cfg.MaxAge)
	return s.repo.RecentChats(ctx, userID, since, 60)
}

// Pending devolve as conversas que esperam resposta do usuário.
//
// Regra: a última mensagem do chat NÃO foi enviada pelo usuário. Só conversas
// diretas entram (o que define uma pendência real de resposta).
func (s *WhatsAppDirectoryService) Pending(ctx context.Context, userID string) ([]domain.WhatsAppChatSummary, error) {
	chats, err := s.Chats(ctx, userID)
	if err != nil {
		return nil, err
	}
	pending := make([]domain.WhatsAppChatSummary, 0, len(chats))
	for _, c := range chats {
		if c.ChatKind != domain.WhatsAppChatKindDirect {
			continue
		}
		if c.ChatKind == domain.WhatsAppChatKindBroadcast || c.ChatKind == domain.WhatsAppChatKindNewsletter {
			continue
		}
		if strings.HasSuffix(c.ChatJID, "@broadcast") || strings.HasSuffix(c.ChatJID, "@newsletter") || c.ChatJID == "status@broadcast" {
			continue
		}
		if c.LastFromMe {
			continue
		}
		pending = append(pending, c)
	}
	return pending, nil
}

// Directory devolve o diretório de contatos no formato do prompt.
func (s *WhatsAppDirectoryService) Directory(ctx context.Context, userID string) ([]ai.ChatContactSummary, error) {
	chats, err := s.Chats(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]ai.ChatContactSummary, 0, len(chats))
	for _, c := range chats {
		label := s.labelOf(c)
		out = append(out, ai.ChatContactSummary{
			Name:    label,
			Alias:   s.aliasOf(c, label),
			Preview: TruncateContextText(c.LastText, 90),
			Age:     humanizeChatAge(c.LastAt),
		})
	}
	return out, nil
}

// aliasOf devolve o OUTRO nome do contato (o que não é o rótulo principal).
//
// Ex.: o contato está salvo como "isa" mas o perfil dela é "bella" — o Vito
// precisa entender as duas formas de chamar a mesma pessoa.
func (s *WhatsAppDirectoryService) aliasOf(c domain.WhatsAppChatSummary, label string) string {
	if s.contacts == nil {
		return ""
	}
	return s.contacts.Alias(c.ChatJID, label)
}

// PendingSummaries devolve as pendências no formato do prompt.
func (s *WhatsAppDirectoryService) PendingSummaries(ctx context.Context, userID string) ([]ai.ChatContactSummary, error) {
	pending, err := s.Pending(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]ai.ChatContactSummary, 0, len(pending))
	for _, c := range pending {
		label := s.labelOf(c)
		out = append(out, ai.ChatContactSummary{
			Name:    label,
			Alias:   s.aliasOf(c, label),
			Preview: TruncateContextText(c.LastText, 90),
			Age:     humanizeChatAge(c.LastAt),
			Pending: true,
		})
	}
	return out, nil
}

// LabelOf devolve o rótulo legível da conversa (nome do contato quando existe).
func (s *WhatsAppDirectoryService) LabelOf(c *domain.WhatsAppChatSummary) string {
	if c == nil {
		return "Contato"
	}
	return s.labelOf(*c)
}

// labelOf devolve o rótulo legível da conversa (nome do contato quando existe).
//
// O nome SALVO pelo dono tem prioridade sobre o rótulo guardado no shadow
// inbox (que pode ser o nome de perfil vindo das mensagens antigas).
func (s *WhatsAppDirectoryService) labelOf(c domain.WhatsAppChatSummary) string {
	if s.contacts != nil {
		if name := s.contacts.Name(c.ChatJID); name != "" {
			return name
		}
	}
	if label := strings.TrimSpace(c.ChatLabel); label != "" && label != "Contato" {
		return label
	}
	if label := strings.TrimSpace(c.ChatLabel); label != "" {
		return label
	}
	return "Contato"
}

// ResolveChat resolve o nome informado (pelo usuário ou pela IA) em uma conversa.
//
// Prioridade: nome exato > nome do contato (cache) > JID exato > contém.
// Ambiguidade é devolvida como erro para a IA pedir desambiguação.
func (s *WhatsAppDirectoryService) ResolveChat(ctx context.Context, userID, name string) (*domain.WhatsAppChatSummary, error) {
	query := strings.TrimSpace(name)
	if query == "" {
		return nil, &ErrChatNotFound{Query: query}
	}
	chats, err := s.Chats(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(chats) == 0 {
		return s.resolveFromSyncedContacts(ctx, userID, query)
	}

	// 1) JID exato.
	for i := range chats {
		if chats[i].ChatJID == query {
			return &chats[i], nil
		}
	}
	// 2) Rótulo exato (sem diferenciar caixa) e nomes salvos no cache de contatos.
	//    Contatos reais (salvos no contato/agenda ou no ChatLabel) SEMPRE têm
	//    precedência sobre apelidos aprendidos.
	exact := make([]domain.WhatsAppChatSummary, 0, 2)
	for i := range chats {
		label := strings.TrimSpace(chats[i].ChatLabel)
		if label != "" && label != "Contato" && contactNameMatches(label, query) {
			exact = append(exact, chats[i])
		}
	}
	if len(exact) == 0 && s.contacts != nil {
		for i := range chats {
			if contactNameMatches(s.contacts.Name(chats[i].ChatJID), query) ||
				contactNameMatches(s.contacts.ProfileName(chats[i].ChatJID), query) {
				exact = append(exact, chats[i])
			}
		}
	}
	switch len(exact) {
	case 1:
		// Limpa qualquer alias espúrio pré-existente cujo nome colida com este contato real.
		if s.repo != nil {
			_ = s.repo.DeleteAliasesByName(ctx, userID, query)
		}
		return &exact[0], nil
	case 0:
		// segue para os apelidos aprendidos
	default:
		return nil, s.ambiguousError(query, exact)
	}

	// 3) Apelido aprendido: o nome que o dono usa para o contato ("isa"),
	//    aprendido quando ele confirmou desambiguação em consulta anterior.
	if aliased, err := s.aliasChats(ctx, userID, query); err == nil && len(aliased) == 1 {
		return &aliased[0], nil
	} else if err == nil && len(aliased) > 1 {
		return nil, s.ambiguousError(query, aliased)
	}

	// 4) Contém (prefixo do nome também vale) — com acento e caixa normalizados.
	matches := make([]domain.WhatsAppChatSummary, 0, 2)
	for i := range chats {
		label := strings.TrimSpace(chats[i].ChatLabel)
		if label == "" {
			continue
		}
		normalizedLabel := normalizeContactName(label)
		normalizedQuery := normalizeContactName(query)
		if strings.Contains(normalizedLabel, normalizedQuery) {
			matches = append(matches, chats[i])
			continue
		}
		if s.contacts != nil {
			if contactNameMatches(s.contacts.Name(chats[i].ChatJID), query) ||
				contactNameMatches(s.contacts.ProfileName(chats[i].ChatJID), query) {
				matches = append(matches, chats[i])
			}
		}
	}
	switch len(matches) {
	case 1:
		return &matches[0], nil
	case 0:
		return s.resolveFromSyncedContacts(ctx, userID, query)
	default:
		return nil, s.ambiguousError(query, matches)
	}
}

// contactNameMatches compara um nome de contato com o termo pedido, ignorando
// caixa e acentos ("Isa" ≈ "isa", "José" ≈ "jose").
func contactNameMatches(name, query string) bool {
	name = strings.TrimSpace(name)
	query = strings.TrimSpace(query)
	if name == "" || query == "" {
		return false
	}
	if strings.EqualFold(name, query) {
		return true
	}
	return normalizeContactName(name) == normalizeContactName(query)
}

// normalizeContactName normaliza um nome para comparação: minúsculas e sem
// acentos (o conjunto de acentos do português).
func normalizeContactName(name string) string {
	lower := strings.ToLower(strings.TrimSpace(name))
	var b strings.Builder
	b.Grow(len(lower))
	for _, r := range lower {
		if repl, ok := contactAccents[r]; ok {
			b.WriteRune(repl)
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

// contactAccents mapeia os acentos do português para a letra base.
var contactAccents = map[rune]rune{
	'á': 'a', 'à': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a',
	'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
	'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
	'ó': 'o', 'ò': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
	'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
	'ç': 'c', 'ñ': 'n',
}

// IsRealContactName verifica se o nome coincide com algum contato real (agenda ou rótulo de conversa).
func (s *WhatsAppDirectoryService) IsRealContactName(ctx context.Context, userID, name string) bool {
	name = strings.TrimSpace(name)
	if name == "" {
		return false
	}
	if s.contacts != nil && (s.contacts.HasSavedName(name) || s.contacts.HasContactNamed(name)) {
		return true
	}
	chats, err := s.Chats(ctx, userID)
	if err != nil || len(chats) == 0 {
		return false
	}
	for _, c := range chats {
		label := strings.TrimSpace(c.ChatLabel)
		if label != "" && label != "Contato" && contactNameMatches(label, name) {
			return true
		}
		if s.contacts != nil {
			if contactNameMatches(s.contacts.Name(c.ChatJID), name) ||
				contactNameMatches(s.contacts.ProfileName(c.ChatJID), name) {
				return true
			}
		}
	}
	return false
}

// SaveAlias grava um apelido aprendido (o nome que o dono usa para o contato).
func (s *WhatsAppDirectoryService) SaveAlias(ctx context.Context, userID, chatJID, alias string) error {
	if s == nil || s.repo == nil {
		return nil
	}
	alias = strings.TrimSpace(alias)
	if alias == "" {
		return nil
	}
	// NUNCA grava um apelido cujo nome já coincida com o nome salvo de outro contato real.
	if s.IsRealContactName(ctx, userID, alias) {
		return nil
	}
	return s.repo.SaveAlias(ctx, userID, chatJID, alias)
}

// aliasChats devolve as conversas que respondem a um apelido aprendido.
func (s *WhatsAppDirectoryService) aliasChats(ctx context.Context, userID, alias string) ([]domain.WhatsAppChatSummary, error) {
	if s.repo == nil {
		return nil, nil
	}
	alias = strings.TrimSpace(alias)
	if alias == "" {
		return nil, nil
	}
	// Se o apelido bate com o nome exato de um contato real já existente,
	// limpe e filtre do banco para nunca desviar consultas para contatos errados.
	if s.IsRealContactName(ctx, userID, alias) {
		_ = s.repo.DeleteAliasesByName(ctx, userID, alias)
		return nil, nil
	}
	jids, err := s.repo.AliasesByName(ctx, userID, alias)
	if err != nil || len(jids) == 0 {
		return nil, err
	}
	chats, err := s.Chats(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]domain.WhatsAppChatSummary, 0, len(jids))
	for _, jid := range jids {
		for i := range chats {
			if chats[i].ChatJID == jid {
				out = append(out, chats[i])
				break
			}
		}
	}
	return out, nil
}

// ambiguousError monta o erro de ambiguidade com os nomes dos candidatos.
func (s *WhatsAppDirectoryService) ambiguousError(query string, matches []domain.WhatsAppChatSummary) *ErrAmbiguousChat {
	names := make([]string, 0, len(matches))
	for i := range matches {
		names = append(names, s.labelOf(matches[i]))
	}
	sort.Strings(names)
	return &ErrAmbiguousChat{Query: query, Candidates: names}
}

// MessagesOf devolve as últimas mensagens de uma conversa (a partir do shadow inbox).
func (s *WhatsAppDirectoryService) MessagesOf(ctx context.Context, userID, chatJID string, limit int) ([]domain.WhatsAppConversationMessage, error) {
	if s == nil || s.repo == nil {
		return nil, nil
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	since := time.Now().UTC().Add(-s.cfg.MaxAge)
	return s.repo.RecentMessages(ctx, userID, chatJID, limit, since)
}

// SearchMessages busca no histórico do WhatsApp por conteúdo (texto + descrição
// de mídia). É o que responde a "aquela mensagem da Ana sobre o contrato".
func (s *WhatsAppDirectoryService) SearchMessages(ctx context.Context, userID, query string, limit int) ([]domain.WhatsAppConversationMessage, error) {
	if s == nil || s.repo == nil {
		return nil, nil
	}
	if limit <= 0 || limit > 30 {
		limit = 8
	}
	return s.repo.SearchMessages(ctx, userID, query, limit)
}

// WhatsAppDirectoryPreview é o diretório de contatos + as pendências de resposta,
// no formato que a tela do app consome.
type WhatsAppDirectoryPreview struct {
	Contacts []ai.ChatContactSummary `json:"contacts"`
	Pending  []ai.ChatContactSummary `json:"pending"`
}

// Preview monta o diretório e as pendências para a tela do Perfil.
func (s *WhatsAppDirectoryService) Preview(ctx context.Context, userID string) (*WhatsAppDirectoryPreview, error) {
	contacts, err := s.Directory(ctx, userID)
	if err != nil {
		return nil, err
	}
	pending, err := s.PendingSummaries(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &WhatsAppDirectoryPreview{Contacts: contacts, Pending: pending}, nil
}

// PendingState devolve o estado de cobrança de uma pendência (nil se nunca cobrada).
func (s *WhatsAppDirectoryService) PendingState(ctx context.Context, userID, chatJID string) (*domain.WhatsAppPendingState, error) {
	if s == nil || s.repo == nil {
		return nil, nil
	}
	return s.repo.GetPendingState(ctx, userID, chatJID)
}

// SavePendingState grava o estado de cobrança de uma pendência.
func (s *WhatsAppDirectoryService) SavePendingState(ctx context.Context, state *domain.WhatsAppPendingState) error {
	if s == nil || s.repo == nil {
		return nil
	}
	return s.repo.SavePendingState(ctx, state)
}

// Relabel reetiqueta as conversas já arquivadas com os nomes do cache de contatos
// (os chats @lid arquivados antes ficaram com o rótulo genérico "Contato").
func (s *WhatsAppDirectoryService) Relabel(ctx context.Context, userID string) (int64, error) {
	if s == nil || s.repo == nil || s.contacts == nil {
		return 0, nil
	}
	names := s.contacts.Names()
	if len(names) == 0 {
		return 0, nil
	}
	labels := make(map[string]string, len(names))
	for jid, name := range names {
		labels[jid] = name
	}
	return s.repo.UpdateChatLabels(ctx, userID, labels)
}

// humanizeChatAge formata a idade da última mensagem de um jeito legível.
func humanizeChatAge(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	diff := time.Since(t)
	switch {
	case diff < 2*time.Minute:
		return "agora"
	case diff < time.Hour:
		return fmt.Sprintf("há %dmin", int(diff.Minutes()))
	case diff < 24*time.Hour:
		return fmt.Sprintf("há %dh", int(diff.Hours()))
	case diff < 48*time.Hour:
		return "ontem"
	default:
		return fmt.Sprintf("há %dd", int(diff.Hours()/24))
	}
}
