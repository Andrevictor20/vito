package service

import (
	"context"
	"log"
	"sync"
	"time"
)

// WhatsAppOwnerCache guarda o JID do dono (número realmente pareado) de cada
// instância do WhatsApp.
//
// Por que existe: o telefone cadastrado na conta Vito pode ser DIFERENTE do
// número do WhatsApp pareado (ex.: celular pessoal no cadastro + chip empresarial
// pareado na Evolution). Só o JID do owner identifica com segurança o chat "Você"
// (note-to-self) — e é ele que habilita o contexto cross-chat.
//
// O TTL de 1 h evita uma chamada HTTP por mensagem; em cache miss o chamador
// agenda a renovação em background e segue com o fallback conservador.
type WhatsAppOwnerCache struct {
	client EvolutionAPIClient
	ttl    time.Duration

	mu         sync.RWMutex
	byInstance map[string]whatsappOwnerInfo
	refreshing map[string]bool
}

type whatsappOwnerInfo struct {
	jid       string
	fetchedAt time.Time
}

// NewWhatsAppOwnerCache cria o cache de JID do owner.
func NewWhatsAppOwnerCache(client EvolutionAPIClient, ttl time.Duration) *WhatsAppOwnerCache {
	if ttl <= 0 {
		ttl = time.Hour
	}
	return &WhatsAppOwnerCache{
		client:     client,
		ttl:        ttl,
		byInstance: make(map[string]whatsappOwnerInfo),
		refreshing: make(map[string]bool),
	}
}

// JID devolve o JID do owner da instância e se o dado é fresco.
func (o *WhatsAppOwnerCache) JID(instanceName string) (string, bool) {
	if o == nil || instanceName == "" {
		return "", false
	}
	o.mu.RLock()
	info, ok := o.byInstance[instanceName]
	o.mu.RUnlock()
	if !ok || info.jid == "" {
		return "", false
	}
	if time.Since(info.fetchedAt) > o.ttl {
		return "", false
	}
	return info.jid, true
}

// Set registra o JID do owner conhecido (usado pelo backfill e pelos testes).
func (o *WhatsAppOwnerCache) Set(instanceName, jid string) {
	if o == nil || instanceName == "" || jid == "" {
		return
	}
	o.mu.Lock()
	defer o.mu.Unlock()
	o.byInstance[instanceName] = whatsappOwnerInfo{jid: jid, fetchedAt: time.Now()}
}

// Fetch busca o JID do owner de forma síncrona (usado no backfill, em background).
func (o *WhatsAppOwnerCache) Fetch(ctx context.Context, instanceName string) (string, error) {
	if o == nil || o.client == nil || instanceName == "" {
		return "", nil
	}
	jid, err := o.client.FindOwnerJID(ctx, instanceName)
	if err != nil {
		return "", err
	}
	o.Set(instanceName, jid)
	return jid, nil
}

// Ensure agenda a busca do JID do owner em background (nunca bloqueia o hot path).
func (o *WhatsAppOwnerCache) Ensure(ctx context.Context, instanceName string) {
	if o == nil || o.client == nil || instanceName == "" {
		return
	}
	if _, fresh := o.JID(instanceName); fresh {
		return
	}

	o.mu.Lock()
	if o.refreshing[instanceName] {
		o.mu.Unlock()
		return
	}
	o.refreshing[instanceName] = true
	o.mu.Unlock()

	go func() {
		defer func() {
			o.mu.Lock()
			delete(o.refreshing, instanceName)
			o.mu.Unlock()
		}()

		base := context.WithoutCancel(ctx)
		timeout, cancel := context.WithTimeout(base, 10*time.Second)
		defer cancel()

		jid, err := o.Fetch(timeout, instanceName)
		if err != nil {
			log.Printf("⚠️ [WhatsAppOwnerCache] falha ao buscar o owner da instância %s: %v", instanceName, err)
			return
		}
		if jid != "" {
			log.Printf("🧭 [WhatsAppOwnerCache] owner da instância %s: %s", instanceName, jid)
		}
	}()
}
