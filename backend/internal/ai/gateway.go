package ai

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// attemptCtx isola cada tentativa com timeout próprio (bug §8.7/10): um ctx
// expirado pelo provedor anterior não aborta os próximos instantaneamente.
func attemptCtx(parent context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.WithoutCancel(parent), 15*time.Second)
}

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

// getOrderedProviders filtra e prioriza provedores conforme o tipo de entrada (imagem, áudio ou texto).
func (g *Gateway) getOrderedProviders(input UserInput) []Provider {
	if input.ImageB64 != "" {
		var visionProviders []Provider
		for _, p := range g.providers {
			if vc, ok := p.(VisionCapable); ok && vc.SupportsVision() {
				visionProviders = append(visionProviders, p)
			}
		}
		if len(visionProviders) > 0 {
			return visionProviders
		}
	}

	if input.AudioB64 != "" {
		var audioProviders []Provider
		for _, p := range g.providers {
			if ac, ok := p.(AudioCapable); ok && ac.SupportsAudio() {
				audioProviders = append(audioProviders, p)
			}
		}
		if len(audioProviders) > 0 {
			return audioProviders
		}
	}

	return g.providers
}

// ParseIntent tenta analisar a intenção percorrendo os provedores até obter sucesso.
func (g *Gateway) ParseIntent(ctx context.Context, input UserInput) (*ParsedIntent, error) {
	candidates := g.getOrderedProviders(input)
	if len(candidates) == 0 {
		return nil, errors.New("nenhum provedor de IA compatível configurado no gateway")
	}

	var lastErr error
	for _, provider := range candidates {
		attempt, cancel := attemptCtx(ctx)
		intent, err := provider.ParseIntent(attempt, input)
		cancel()
		// Resposta vazia com err == nil conta como falha (bug §8.7/9).
		if err == nil && intent.IsEmpty() {
			err = errors.New("resposta vazia do provedor (sem mensagem nem ações)")
		}
		if err == nil && intent != nil {
			intent.ProviderUsed = provider.Name()
			intent.LocalizeTimes(input.Timezone)
			return intent, nil
		}

		lastErr = err
		log.Printf("⚠️ [AI Gateway] Provedor '%s' falhou: %v. Tentando próximo da cascata...", provider.Name(), err)
	}

	return nil, fmt.Errorf("todos os provedores de IA falharam (último erro: %w)", lastErr)
}

// EvaluateTrigger avalia um radar/vigília percorrendo os provedores com failover em cascata.
func (g *Gateway) EvaluateTrigger(ctx context.Context, t *domain.Trigger) (*domain.TriggerTestResult, error) {
	if len(g.providers) == 0 {
		return nil, errors.New("nenhum provedor configurado no gateway")
	}

	var lastErr error
	for _, p := range g.providers {
		if ep, ok := p.(TriggerEvaluatorProvider); ok {
			attempt, cancel := attemptCtx(ctx)
			res, err := ep.EvaluateTrigger(attempt, t)
			cancel()
			if err == nil && res != nil {
				res.EnforceConfidenceGate()
				return res, nil
			}
			lastErr = err
			log.Printf("⚠️ [AI Gateway] Avaliação de vigília falhou no provedor '%s': %v. Tentando próximo da cascata...", p.Name(), err)
		}
	}

	return nil, fmt.Errorf("todos os provedores falharam na avaliação do radar (último erro: %w)", lastErr)
}

// GenerateText sintetiza resumos executivos ou textos percorrendo os provedores com failover em cascata.
func (g *Gateway) GenerateText(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	if len(g.providers) == 0 {
		return "", errors.New("nenhum provedor configurado no gateway")
	}

	var lastErr error
	for _, p := range g.providers {
		if tg, ok := p.(TextGeneratorProvider); ok {
			attempt, cancel := attemptCtx(ctx)
			text, err := tg.GenerateText(attempt, systemPrompt, userPrompt)
			cancel()
			if err == nil && strings.TrimSpace(text) != "" {
				return text, nil
			}
			lastErr = err
			log.Printf("⚠️ [AI Gateway] Síntese de texto falhou no provedor '%s': %v. Tentando próximo da cascata...", p.Name(), err)
		}
	}

	return "", fmt.Errorf("todos os provedores falharam na síntese de texto (último erro: %w)", lastErr)
}
