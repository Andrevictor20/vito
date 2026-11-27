package domain

import (
	"context"
	"time"
)

// EntityLink representa uma entidade unificada (pessoa, projeto ou organização) entre múltiplos canais.
type EntityLink struct {
	ID            string            `json:"id"`
	UserID        string            `json:"user_id"`
	CanonicalName string            `json:"canonical_name"`
	EntityType    string            `json:"entity_type"` // 'person', 'project', 'organization'
	WhatsAppJID   string            `json:"whatsapp_jid"`
	Email         string            `json:"email"`
	Phone         string            `json:"phone"`
	Aliases       []string          `json:"aliases"`
	ExternalIDs   map[string]string `json:"external_ids"`
	Confidence    float64           `json:"confidence"`
	CreatedAt     time.Time         `json:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at"`
}

// EntityLinkResolver resolve entidades cruzadas (nome/apelido -> e-mail/WhatsApp/telefone).
type EntityLinkResolver interface {
	Resolve(ctx context.Context, userID, query string) ([]EntityLink, error)
}
