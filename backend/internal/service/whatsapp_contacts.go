package service

import (
	"context"
	"log"
	"strings"
	"sync"
	"time"
)

// WhatsAppContactNames guarda os DOIS nomes de um contato:
//
//   - Saved:   o nome que o DONO salvou na agenda do WhatsApp ("isa")
//   - Profile: o nome de perfil que a pessoa escolheu no WhatsApp ("bella")
//
// Os dois importam: o usuário chama a pessoa pelo nome que salvou, mas o
// WhatsApp mostra (e traz no webhook) o nome de perfil. Sem guardar os dois,
// o Vito reconhecia "bella" e ignorava "isa" — o nome que o dono usa.
type WhatsAppContactNames struct {
	Saved   string `json:"saved,omitempty"`
	Profile string `json:"profile,omitempty"`
}

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
	byJID      map[string]WhatsAppContactNames
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
		byJID:  make(map[string]WhatsAppContactNames),
	}
}

// Name devolve o nome principal do contato: o salvo pelo dono, com o nome de
// perfil como fallback.
//
// O nome salvo tem prioridade porque é o nome pelo qual o usuário fala da
// pessoa ("isa"). O fallback numérico evita rótulos feios como "559884097322"
// (contatos salvos só pelo telefone).
func (c *WhatsAppContactsCache) Name(jid string) string {
	if c == nil || jid == "" {
		return ""
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	names := c.byJID[jid]
	if saved := strings.TrimSpace(names.Saved); saved != "" && !looksLikePhone(saved) {
		return saved
	}
	if profile := strings.TrimSpace(names.Profile); profile != "" {
		return profile
	}
	if saved := strings.TrimSpace(names.Saved); saved != "" {
		return saved
	}
	return ""
}

// ProfileName devolve o nome de perfil escolhido pela pessoa no WhatsApp.
func (c *WhatsAppContactsCache) ProfileName(jid string) string {
	if c == nil || jid == "" {
		return ""
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	return strings.TrimSpace(c.byJID[jid].Profile)
}

// Alias devolve o OUTRO nome do contato (o que não é o principal), para o Vito
// entender "isa" e "bella" como a mesma pessoa.
func (c *WhatsAppContactsCache) Alias(jid, principal string) string {
	if c == nil || jid == "" {
		return ""
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	names := c.byJID[jid]
	saved := strings.TrimSpace(names.Saved)
	profile := strings.TrimSpace(names.Profile)
	if !strings.EqualFold(principal, saved) && saved != "" && !looksLikePhone(saved) {
		return saved
	}
	if !strings.EqualFold(principal, profile) && profile != "" {
		return profile
	}
	return ""
}

// Set registra os nomes de um contato.
func (c *WhatsAppContactsCache) Set(jid, saved, profile string) {
	if c == nil || jid == "" {
		return
	}
	saved = strings.TrimSpace(saved)
	profile = strings.TrimSpace(profile)
	if saved == "" && profile == "" {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	names := c.byJID[jid]
	names.Saved = saved
	names.Profile = profile
	c.byJID[jid] = names
}

// SetProfile registra o nome de PERFIL de um contato (o que a pessoa escolheu
// no WhatsApp), sem tocar no nome salvo.
//
// O pushName chega em toda mensagem recebida — é uma fonte mais confiável que
// o `findContacts` (que às vezes devolve o pushName vazio).
func (c *WhatsAppContactsCache) SetProfile(jid, profile string) {
	if c == nil || jid == "" {
		return
	}
	profile = strings.TrimSpace(profile)
	if profile == "" {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	names := c.byJID[jid]
	if names.Profile == "" {
		names.Profile = profile
	}
	c.byJID[jid] = names
}

// SetProfiles registra o nome de perfil (pushName) de vários contatos de uma vez.
func (c *WhatsAppContactsCache) SetProfiles(profiles map[string]string) {
	if c == nil || len(profiles) == 0 {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	for jid, profile := range profiles {
		profile = strings.TrimSpace(profile)
		if jid == "" || profile == "" {
			continue
		}
		names := c.byJID[jid]
		if names.Profile == "" {
			names.Profile = profile
		}
		c.byJID[jid] = names
	}
}

// Names devolve a cópia do mapa de nomes (usada para reetiquetar o histórico).
func (c *WhatsAppContactsCache) Names() map[string]string {
	if c == nil {
		return nil
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	out := make(map[string]string, len(c.byJID))
	for jid, names := range c.byJID {
		saved := strings.TrimSpace(names.Saved)
		profile := strings.TrimSpace(names.Profile)
		switch {
		case saved != "" && !looksLikePhone(saved):
			out[jid] = saved
		case profile != "":
			out[jid] = profile
		case saved != "":
			out[jid] = saved
		}
	}
	return out
}

// looksLikePhone informa se o texto parece um telefone.
//
// Muitos contatos são salvos só pelo número ("559884097322"). Usar isso como
// nome no prompt é ilegível — nesses casos o nome de perfil é o melhor rótulo.
func looksLikePhone(name string) bool {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return false
	}
	digits, letters := 0, 0
	for _, r := range trimmed {
		switch {
		case r >= '0' && r <= '9':
			digits++
		case (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z'):
			letters++
		}
	}
	return digits >= 8 && letters <= 3
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
		saved := strings.TrimSpace(contact.Name)
		profile := strings.TrimSpace(contact.PushName)
		if saved == "" && profile == "" {
			saved = strings.TrimSpace(contact.Number)
		}
		if contact.ID == "" || (saved == "" && profile == "") {
			continue
		}
		c.byJID[contact.ID] = WhatsAppContactNames{Saved: saved, Profile: profile}
		resolved++
	}
	c.fetchedAt = time.Now()
	c.mu.Unlock()
	return resolved, nil
}
