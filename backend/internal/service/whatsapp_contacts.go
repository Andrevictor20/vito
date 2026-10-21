package service

import (
	"context"
	"log"
	"strings"
	"sync"
	"time"
)

// WhatsAppContactsCache guarda o nome de cada contato do WhatsApp (JID -> nome).
//
// Por que existe: os chats "@lid" (padrão novo do WhatsApp/Evolution v2) chegam
// sem `pushName`, e o rótulo caía no genérico "Contato". Sem o nome, o Vito não
// consegue dizer "a Ana te espera" nem resolver "as mensagens da Ana".
//
// O TTL de 1 h evita uma chamada HTTP por mensagem; a renovação é feita em
// background e o cache miss nunca bloqueia o caminho quente.
type WhatsAppContactsCache struct {
	client EvolutionAPIClient
	ttl    time.Duration

	mu         sync.RWMutex
	byJID      map[string]string
	fetchedAt  time.Time
	refreshing bool
}

// NewWhatsAppContactsCache cria o cache de nomes de contato.
func NewWhatsAppContactsCache(client EvolutionAPIClient, ttl time.Duration) *WhatsAppContactsCache {
	if ttl <= 0 {
		ttl = time.Hour
	}
	return &WhatsAppContactsCache{
		client: client,
		ttl:    ttl,
		byJID:  make(map[string]string),
	}
}

// Name devolve o nome conhecido do contato (vazio se desconhecido).
func (c *WhatsAppContactsCache) Name(jid string) string {
	if c == nil || jid == "" {
		return ""
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.byJID[jid]
}

// Set registra o nome de um contato.
func (c *WhatsAppContactsCache) Set(jid, name string) {
	if c == nil || jid == "" || strings.TrimSpace(name) == "" {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.byJID[jid] = strings.TrimSpace(name)
}

// Names devolve a cópia do mapa de nomes (usada para reetiquetar o histórico).
func (c *WhatsAppContactsCache) Names() map[string]string {
	if c == nil {
		return nil
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	out := make(map[string]string, len(c.byJID))
	for jid, name := range c.byJID {
		out[jid] = name
	}
	return out
}

// Ensure agenda a atualização do cache em background (nunca bloqueia o webhook).
func (c *WhatsAppContactsCache) Ensure(ctx context.Context, instanceName string) {
	if c == nil || c.client == nil || instanceName == "" {
		return
	}
	c.mu.RLock()
	fresh := !c.fetchedAt.IsZero() && time.Since(c.fetchedAt) < c.ttl
	refreshing := c.refreshing
	c.mu.RUnlock()
	if fresh || refreshing {
		return
	}

	c.mu.Lock()
	if c.refreshing {
		c.mu.Unlock()
		return
	}
	c.refreshing = true
	c.mu.Unlock()

	go func() {
		defer func() {
			c.mu.Lock()
			c.refreshing = false
			c.mu.Unlock()
		}()

		base := context.WithoutCancel(ctx)
		timeout, cancel := context.WithTimeout(base, 20*time.Second)
		defer cancel()

		if _, err := c.Fetch(timeout, instanceName); err != nil {
			log.Printf("⚠️ [WhatsAppContactsCache] falha ao buscar contatos: %v", err)
		}
	}()
}

// Fetch busca os contatos da instância de forma síncrona e preenche o cache.
// Devolve quantos nomes foram resolvidos.
func (c *WhatsAppContactsCache) Fetch(ctx context.Context, instanceName string) (int, error) {
	if c == nil || c.client == nil {
		return 0, nil
	}
	contacts, err := c.client.FindContacts(ctx, instanceName)
	if err != nil {
		return 0, err
	}

	resolved := 0
	c.mu.Lock()
	for _, contact := range contacts {
		name := strings.TrimSpace(contact.PushName)
		if name == "" {
			name = strings.TrimSpace(contact.Name)
		}
		if name == "" {
			name = strings.TrimSpace(contact.Number)
		}
		if contact.ID == "" || name == "" {
			continue
		}
		c.byJID[contact.ID] = name
		resolved++
	}
	c.fetchedAt = time.Now()
	c.mu.Unlock()
	return resolved, nil
}
