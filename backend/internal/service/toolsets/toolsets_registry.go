package toolsets

import (
	"sync"

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
