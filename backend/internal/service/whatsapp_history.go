package service

import (
	"sync"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
)

const (
	defaultMaxHistoryTurns = 8
	defaultHistoryTTL      = 45 * time.Minute
)

type chatTurn struct {
	Sender    string // "user" ou "vito"
	Text      string
	Timestamp time.Time
}

// WhatsAppConversationMemory armazena de forma thread-safe o histórico recente de diálogos do WhatsApp.
type WhatsAppConversationMemory struct {
	mu       sync.RWMutex
	turns    map[string][]chatTurn
	maxTurns int
	ttl      time.Duration
}

// NewWhatsAppConversationMemory cria um novo gerenciador de histórico para sessões do WhatsApp.
func NewWhatsAppConversationMemory() *WhatsAppConversationMemory {
	return &WhatsAppConversationMemory{
		turns:    make(map[string][]chatTurn),
		maxTurns: defaultMaxHistoryTurns,
		ttl:      defaultHistoryTTL,
	}
}

// GetHistory recupera as mensagens recentes não expiradas para montar o contexto multi-turn do LLM.
func (m *WhatsAppConversationMemory) GetHistory(conversationKey string) []ai.ChatMessageContext {
	if m == nil {
		return nil
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	entries, ok := m.turns[conversationKey]
	if !ok || len(entries) == 0 {
		return nil
	}

	cutoff := time.Now().Add(-m.ttl)
	valid := make([]chatTurn, 0, len(entries))
	for _, entry := range entries {
		if entry.Timestamp.After(cutoff) {
			valid = append(valid, entry)
		}
	}

	if len(valid) == 0 {
		delete(m.turns, conversationKey)
		return nil
	}

	m.turns[conversationKey] = valid

	result := make([]ai.ChatMessageContext, len(valid))
	for i, entry := range valid {
		result[i] = ai.ChatMessageContext{
			Sender: entry.Sender,
			Text:   entry.Text,
		}
	}
	return result
}

// AddMessage registra uma nova fala (do usuário ou do Vito) na memória da conversa.
func (m *WhatsAppConversationMemory) AddMessage(conversationKey, sender, text string) {
	if m == nil || conversationKey == "" || text == "" {
		return
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	entries := m.turns[conversationKey]
	cutoff := time.Now().Add(-m.ttl)

	// Filtra mensagens expiradas
	filtered := make([]chatTurn, 0, len(entries)+1)
	for _, entry := range entries {
		if entry.Timestamp.After(cutoff) {
			filtered = append(filtered, entry)
		}
	}

	filtered = append(filtered, chatTurn{
		Sender:    sender,
		Text:      text,
		Timestamp: time.Now(),
	})

	if len(filtered) > m.maxTurns {
		filtered = filtered[len(filtered)-m.maxTurns:]
	}

	m.turns[conversationKey] = filtered
}

// Clear remove o histórico associado a uma chave de conversa.
func (m *WhatsAppConversationMemory) Clear(conversationKey string) {
	if m == nil {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.turns, conversationKey)
}
