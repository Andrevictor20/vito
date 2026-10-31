package service

import (
	"context"
	"sync"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// MemoryScopeGuard implementa domain.ScopeGuard com rastreamento thread-safe em memória.
type MemoryScopeGuard struct {
	mu           sync.RWMutex
	taintedTurns map[string][]string // turnID -> list of sources
}

// ScopeGuard é um alias de conveniência.
type ScopeGuard = MemoryScopeGuard

// NewMemoryScopeGuard inicializa o guardião de escopo e Taint Tracking.
func NewMemoryScopeGuard() *MemoryScopeGuard {
	return &MemoryScopeGuard{
		taintedTurns: make(map[string][]string),
	}
}

// NewScopeGuard é o construtor padrão canônico.
func NewScopeGuard() *MemoryScopeGuard {
	return NewMemoryScopeGuard()
}

// CanExecute avalia se uma operação pode rodar sem confirmação humana.
func (g *MemoryScopeGuard) CanExecute(ctx context.Context, execCtx *domain.ToolExecutionContext, operation string, isWrite bool) (bool, string) {
	if !isWrite {
		return true, "operação de leitura segura"
	}

	// Se a confirmação humana prévia já foi concedida (ex: clique no card ou "sim")
	if execCtx != nil && (execCtx.AutonomyLevel == "confirmed" || execCtx.AutonomyLevel == "autonomous_write") {
		return true, "autorizado por confirmação prévia explícita do usuário"
	}

	// Se o contexto foi contaminado por dados externos (web, terceiros), bloqueia escrita sumariamente
	if execCtx != nil && execCtx.TaintedByUntrustedInput {
		return false, "bloqueado por Taint Tracking: dados externos não confiáveis no contexto exigem confirmação explícita"
	}

	if execCtx != nil && g.IsTainted(ctx, execCtx.TurnID) {
		return false, "bloqueado por Taint Tracking: turno marcado como contaminado"
	}

	return false, "operações de escrita exigem aprovação prévia do usuário no Confirmation Gate"
}

// MarkTainted marca um turno como contaminado por uma fonte externa não confiável.
func (g *MemoryScopeGuard) MarkTainted(ctx context.Context, turnID string, source string) {
	if turnID == "" {
		return
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	g.taintedTurns[turnID] = append(g.taintedTurns[turnID], source)
}

// IsTainted verifica se o turno possui contaminação registrada.
func (g *MemoryScopeGuard) IsTainted(ctx context.Context, turnID string) bool {
	if turnID == "" {
		return false
	}
	g.mu.RLock()
	defer g.mu.RUnlock()
	sources, exists := g.taintedTurns[turnID]
	return exists && len(sources) > 0
}
