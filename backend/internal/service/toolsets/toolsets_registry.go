package toolsets

import (
	"sync"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// ToolsetsRegistry gerencia o registro e descoberta das 8 Macro-Ferramentas.
type ToolsetsRegistry struct {
	mu       sync.RWMutex
	toolsets map[domain.ToolsetName]domain.DomainToolset
}

// NewToolsetsRegistry cria um novo registro vazio.
func NewToolsetsRegistry() *ToolsetsRegistry {
	return &ToolsetsRegistry{
		toolsets: make(map[domain.ToolsetName]domain.DomainToolset),
	}
}

// Register adiciona uma macro-ferramenta ao registro.
func (r *ToolsetsRegistry) Register(t domain.DomainToolset) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.toolsets[t.Name()] = t
}

// Get obtém uma ferramenta pelo nome.
func (r *ToolsetsRegistry) Get(name domain.ToolsetName) (domain.DomainToolset, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	t, exists := r.toolsets[name]
	return t, exists
}

// All retorna todas as ferramentas registradas.
func (r *ToolsetsRegistry) All() []domain.DomainToolset {
	r.mu.RLock()
	defer r.mu.RUnlock()
	list := make([]domain.DomainToolset, 0, len(r.toolsets))
	for _, t := range r.toolsets {
		list = append(list, t)
	}
	return list
}

// Definitions exporta as definições no formato ai.ToolDefinition para os provedores.
func (r *ToolsetsRegistry) Definitions() []ai.ToolDefinition {
	r.mu.RLock()
	defer r.mu.RUnlock()
	defs := make([]ai.ToolDefinition, 0, len(r.toolsets))
	for _, t := range r.toolsets {
		defs = append(defs, ai.ToolDefinition{
			Name:        string(t.Name()),
			Description: t.Description(),
			Parameters:  t.JSONSchema(),
		})
	}
	return defs
}

// DefinitionsForContext exporta apenas as definições permitidas para o ToolExecutionContext (AC-04).
// Quando BotID == "" e não há AllowedToolsets/AllowedOperations configurados, retorna todas as definições.
func (r *ToolsetsRegistry) DefinitionsForContext(execCtx *domain.ToolExecutionContext) []ai.ToolDefinition {
	if execCtx == nil || (execCtx.BotID == "" && len(execCtx.AllowedToolsets) == 0 && len(execCtx.AllowedOperations) == 0) {
		return r.Definitions()
	}

	allowed := make(map[domain.ToolsetName]bool, len(execCtx.AllowedToolsets)+len(execCtx.AllowedOperations))
	for _, tsName := range execCtx.AllowedToolsets {
		allowed[tsName] = true
	}
	for tsName, ops := range execCtx.AllowedOperations {
		if len(ops) > 0 {
			allowed[tsName] = true
		}
	}

	r.mu.RLock()
	defer r.mu.RUnlock()
	defs := make([]ai.ToolDefinition, 0, len(allowed))
	for _, t := range r.toolsets {
		if !allowed[t.Name()] {
			continue
		}
		defs = append(defs, ai.ToolDefinition{
			Name:        string(t.Name()),
			Description: t.Description(),
			Parameters:  t.JSONSchema(),
		})
	}
	return defs
}

// BotActionSpecs agrega todas as especificações BotActionSpec declaradas por toolsets que implementam BotCapableToolset.
func (r *ToolsetsRegistry) BotActionSpecs() []domain.BotActionSpec {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var specs []domain.BotActionSpec
	for _, t := range r.toolsets {
		if bc, ok := t.(domain.BotCapableToolset); ok {
			specs = append(specs, bc.BotActions()...)
		}
	}
	return specs
}
