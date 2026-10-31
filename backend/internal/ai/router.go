package ai

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"
)

var (
	ErrNoProviderAvailable = errors.New("nenhum provedor de IA disponível para esta categoria de tarefa")
	ErrTierTooLowForWriting = errors.New("provedores de Tier 1 não têm permissão para executar operações de escrita")
)

type stickyEntry struct {
	providerName string
	expiresAt    time.Time
}

// ModelRouter gerencia a seleção de provedor com piso de qualidade e retenção de fio fixado (Sticky Thread).
type ModelRouter struct {
	mu           sync.RWMutex
	providers    []AgentProvider
	stickyMap    map[string]stickyEntry
	stickyTTL    time.Duration
}

// NewModelRouter cria um roteador com os provedores fornecidos.
func NewModelRouter(providers ...AgentProvider) *ModelRouter {
	return &ModelRouter{
		providers: providers,
		stickyMap: make(map[string]stickyEntry),
		stickyTTL: 15 * time.Minute,
	}
}

// AddProvider registra um provedor no roteador.
func (r *ModelRouter) AddProvider(p AgentProvider) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.providers = append(r.providers, p)
}

// SetStickyTTL configura a duração de fixação da thread.
func (r *ModelRouter) SetStickyTTL(ttl time.Duration) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.stickyTTL = ttl
}

// SelectProvider escolhe o provedor ideal baseado na tarefa, ferramentas e fio fixado.
func (r *ModelRouter) SelectProvider(ctx context.Context, req AgentChatRequest) (AgentProvider, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()

	// 1. Verifica se há Sticky Thread ativa
	if req.ThreadID != "" {
		if entry, exists := r.stickyMap[req.ThreadID]; exists {
			if now.Before(entry.expiresAt) {
				// Busca o provedor fixado
				for _, p := range r.providers {
					if p.Name() == entry.providerName {
						// Se a requisição exige tools, verifica se o provedor suporta
						if req.RequireTools && !p.SupportsTools() {
							break // Quebra para buscar um compatível
						}
						// Renova o tempo da thread ativa
						entry.expiresAt = now.Add(r.stickyTTL)
						r.stickyMap[req.ThreadID] = entry
						return p, nil
					}
				}
			} else {
				delete(r.stickyMap, req.ThreadID)
			}
		}
	}

	// 2. Determina o piso de qualidade exigido
	minTier := r.requiredMinTier(req)

	// 3. Procura o melhor provedor que satisfaça os requisitos
	var chosen AgentProvider
	for _, p := range r.providers {
		if p.QualityTier() < minTier {
			continue
		}
		if req.RequireTools && !p.SupportsTools() {
			continue
		}
		if chosen == nil || p.QualityTier() > chosen.QualityTier() {
			chosen = p
		}
	}

	if chosen == nil {
		return nil, fmt.Errorf("%w: task=%s minTier=%d requireTools=%v", ErrNoProviderAvailable, req.Task, minTier, req.RequireTools)
	}

	// 4. Se o provedor escolhido for Tier >= 2 e a thread usa ferramentas, fixa a thread
	if req.ThreadID != "" && chosen.QualityTier() >= 2 && (req.RequireTools || len(req.Tools) > 0) {
		r.stickyMap[req.ThreadID] = stickyEntry{
			providerName: chosen.Name(),
			expiresAt:    now.Add(r.stickyTTL),
		}
	}

	return chosen, nil
}

// SetStickyThread fixa explicitamente uma thread a um provedor.
func (r *ModelRouter) SetStickyThread(threadID, providerName string, duration time.Duration) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if duration <= 0 {
		duration = r.stickyTTL
	}
	r.stickyMap[threadID] = stickyEntry{
		providerName: providerName,
		expiresAt:    time.Now().Add(duration),
	}
}

// ClearStickyThread remove a fixação de uma thread.
func (r *ModelRouter) ClearStickyThread(threadID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.stickyMap, threadID)
}

// IsSticky retorna se uma thread está fixada e qual o provedor.
func (r *ModelRouter) IsSticky(threadID string) (bool, string) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	entry, exists := r.stickyMap[threadID]
	if !exists || time.Now().After(entry.expiresAt) {
		return false, ""
	}
	return true, entry.providerName
}

func (r *ModelRouter) requiredMinTier(req AgentChatRequest) int {
	switch req.Task {
	case TaskToolUse:
		return 2 // Ferramentas exigem pelo menos Tier 2
	case TaskGrounding:
		return 2
	case TaskMemoryConsolid:
		return 2
	case TaskVision:
		return 2
	default:
		// Chat puro e classificação toleram Tier 1
		return 1
	}
}
