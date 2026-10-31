package service

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
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
	lid       string
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
// Quando o TTL expira, ainda retorna o último JID conhecido com fresh=false
// (stale-while-revalidate) para evitar perda de reconhecimento do chat "Você".
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
		return info.jid, false
	}
	return info.jid, true
}

// Set registra o JID do owner conhecido (usado pelo backfill, webhook e testes).
func (o *WhatsAppOwnerCache) Set(instanceName, jid string) {
	if o == nil || instanceName == "" || jid == "" {
		return
	}
	o.mu.Lock()
	defer o.mu.Unlock()
	prev := o.byInstance[instanceName]
	prev.jid = jid
	prev.fetchedAt = time.Now()
	o.byInstance[instanceName] = prev
}

// SetLID registra o JID @lid do próprio dono da instância (aprendido quando
// fromMe=true traz participant=@lid).
func (o *WhatsAppOwnerCache) SetLID(instanceName, lid string) {
	if o == nil || instanceName == "" || lid == "" {
		return
	}
	o.mu.Lock()
	defer o.mu.Unlock()
	prev := o.byInstance[instanceName]
	prev.lid = lid
	o.byInstance[instanceName] = prev
}

// LID devolve o JID @lid conhecido do dono da instância.
func (o *WhatsAppOwnerCache) LID(instanceName string) string {
	if o == nil || instanceName == "" {
		return ""
	}
	o.mu.RLock()
	defer o.mu.RUnlock()
	return o.byInstance[instanceName].lid
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

// ResolveWhatsAppWebhookBaseURL prefere a rede interna do Docker (http://backend:<port>)
// quando a Evolution API roda no mesmo compose (evolution-api), evitando que os
// webhooks saiam pela internet pública e passem pelo Cloudflare Tunnel.
func ResolveWhatsAppWebhookBaseURL(publicBaseURL, evolutionAPIURL, port string) string {
	if strings.Contains(strings.ToLower(evolutionAPIURL), "evolution-api") {
		p := strings.TrimSpace(port)
		if p == "" {
			p = "8180"
		}
		return "http://backend:" + p
	}
	return publicBaseURL
}

// SyncConnectedWebhooks reaplica a URL de webhook em todas as instâncias cadastradas
// no boot do servidor com retry progressivo para aguardar a inicialização do container Evolution API.
func (s *WhatsAppService) SyncConnectedWebhooks(ctx context.Context) {
	if s == nil || s.repo == nil || s.client == nil || strings.TrimSpace(s.cfg.WebhookBaseURL) == "" {
		return
	}

	webhookURL := fmt.Sprintf("%s/api/v1/integrations/whatsapp/webhook", strings.TrimRight(s.cfg.WebhookBaseURL, "/"))
	backoffs := []time.Duration{0, 5 * time.Second, 15 * time.Second, 30 * time.Second, 60 * time.Second}

	for attempt, delay := range backoffs {
		if delay > 0 {
			select {
			case <-ctx.Done():
				return
			case <-time.After(delay):
			}
		}

		timeoutCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
		integrations, err := s.repo.ListAll(timeoutCtx)
		if err != nil {
			cancel()
			continue
		}

		allSuccess := true
		for _, integ := range integrations {
			if strings.TrimSpace(integ.InstanceName) == "" {
				continue
			}

			// Auto-cura de status: se a Evolution já estiver conectada ('open'), atualiza localmente
			state, stateErr := s.client.GetConnectionState(timeoutCtx, integ.InstanceName)
			if stateErr == nil && strings.EqualFold(state, "open") && integ.Status != domain.WhatsAppStatusConnected {
				now := time.Now().UTC()
				_ = s.repo.UpdateStatus(timeoutCtx, integ.ID, domain.WhatsAppStatusConnected, &now)
				log.Printf("🔄 [WhatsAppService] Status da instância %s auto-curado para 'connected'", integ.InstanceName)
			}

			if err := s.client.SetWebhook(timeoutCtx, integ.InstanceName, webhookURL); err != nil {
				allSuccess = false
				log.Printf("⚠️ [WhatsAppService] Tentativa %d/%d falhou ao configurar webhook de %s: %v", attempt+1, len(backoffs), integ.InstanceName, err)
			} else {
				log.Printf("🔗 [WhatsAppService] Webhook sincronizado com sucesso para %s -> %s", integ.InstanceName, webhookURL)
			}
		}
		cancel()

		if allSuccess && len(integrations) > 0 {
			log.Printf("✅ [WhatsAppService] Todos os webhooks foram sincronizados com sucesso na tentativa %d", attempt+1)
			return
		}
	}
}
