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
	isTainted := execCtx != nil && (execCtx.TaintedByUntrustedInput || g.IsTainted(ctx, execCtx.TurnID))

	// Política específica de Bot (Plano 04 §6 Fase 1)
	if execCtx != nil && execCtx.BotID != "" {
		if pol, ok := resolveBotOperationPolicy(execCtx.ActionPolicies, operation); ok {
			if pol == domain.ActionPolicyOff {
				return false, "ação desligada na política deste bot"
			}
			if isAlwaysAskOperation(operation) && execCtx.AutonomyLevel != "confirmed" {
				return false, "ação sempre exige aprovação do usuário (ALWAYS)"
			}
			if isWrite && isTainted && execCtx.AutonomyLevel != "confirmed" {
				return false, "bloqueado por Taint Tracking: dados externos não confiáveis no contexto exigem confirmação explícita"
			}
			if pol == domain.ActionPolicyAsk && execCtx.AutonomyLevel != "confirmed" {
				return false, "ação configurada para pedir aprovação antes (ask)"
			}
			if pol == domain.ActionPolicyAuto {
				return true, "autorizado pela política automática do bot"
			}
		}
	}

	if !isWrite {
		return true, "operação de leitura segura"
	}

	// Se o contexto foi contaminado por dados externos (Pix, web, terceiros), bloqueia escrita autônoma
	// Somente a confirmação humana explícita pontual ("confirmed") pode liberar
	if isTainted {
		if execCtx != nil && execCtx.AutonomyLevel == "confirmed" {
			return true, "autorizado por confirmação pontual explícita do usuário"
		}
		return false, "bloqueado por Taint Tracking: dados externos não confiáveis no contexto exigem confirmação explícita"
	}

	// Operações sensíveis ou destrutivas exigem confirmação explícita pontual mesmo no modo proativo.
	if isAlwaysAskOperation(operation) && (execCtx == nil || execCtx.AutonomyLevel != "confirmed") {
		return false, "ação sensível ou destrutiva exige confirmação explícita do usuário"
	}

	// Se não está contaminado e a confirmação humana ou autonomia prévia já foi concedida
	if execCtx != nil && (execCtx.AutonomyLevel == "confirmed" || execCtx.AutonomyLevel == "autonomous_write") {
		return true, "autorizado por confirmação prévia explícita do usuário"
	}

	return false, "operações de escrita exigem aprovação prévia do usuário no Confirmation Gate"
}

func isAlwaysAskOperation(op string) bool {
	switch op {
	case "send_message", "send_email", "delete_event", "delete_todo", "delete_trigger", "delete_bot":
		return true
	default:
		return false
	}
}

func resolveBotOperationPolicy(policies map[string]domain.ActionPolicy, operation string) (domain.ActionPolicy, bool) {
	if len(policies) == 0 {
		return "", false
	}
	if p, ok := policies[operation]; ok {
		return p, true
	}
	opToKeys := map[string][]string{
		"list_events":     {"free", "gcal:free", "cal:list"},
		"check_conflicts": {"free", "gcal:free", "cal:list"},
		"create_event":    {"evt", "gcal:evt", "cal:create"},
		"create_todo":     {"task", "vito:task", "todo:create"},
		"list_todos":      {"task", "vito:task", "todo:list"},
		"search_messages": {"waread", "wa:waread"},
		"recent_chats":    {"waread", "wa:waread"},
		"send_message":    {"wasend", "wa:wasend"},
		"search_emails":   {"mailr", "gmail:mailr"},
		"scan_emails":     {"mailr", "gmail:mailr"},
		"create_draft":    {"draft", "gmail:draft"},
		"send_email":      {"mailsend", "gmail:mailsend"},
		"search":          {"search", "web:search"},
		"read_page":       {"search", "web:search", "web:read"},
		"get_summary":     {"spend", "fin:spend", "fin:summary"},
	}
	for _, k := range opToKeys[operation] {
		if p, ok := policies[k]; ok {
			return p, true
		}
	}
	return "", false
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
