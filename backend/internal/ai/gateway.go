package ai

import (
	"context"
	"errors"
	"fmt"
	"log"
)

// Gateway orquestra múltiplos provedores de IA aplicando failover em cascata.
type Gateway struct {
	providers []Provider
}

// NewGateway instancia o Gateway com uma lista ordenada de provedores por prioridade.
func NewGateway(providers ...Provider) *Gateway {
	active := make([]Provider, 0, len(providers))
	for _, p := range providers {
		if p != nil {
			active = append(active, p)
		}
	}
	return &Gateway{providers: active}
}

// ParseIntent tenta analisar a intenção percorrendo os provedores até obter sucesso.
func (g *Gateway) ParseIntent(ctx context.Context, input UserInput) (*ParsedIntent, error) {
	if len(g.providers) == 0 {
		return nil, errors.New("nenhum provedor de IA configurado no gateway")
	}

	var lastErr error
	for _, provider := range g.providers {
		intent, err := provider.ParseIntent(ctx, input)
		if err == nil && intent != nil {
			intent.ProviderUsed = provider.Name()
			return intent, nil
		}

		lastErr = err
		log.Printf("⚠️ [AI Gateway] Provedor '%s' falhou: %v. Tentando próximo da cascata...", provider.Name(), err)
	}

	return nil, fmt.Errorf("todos os provedores de IA falharam (último erro: %w)", lastErr)
}
