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
