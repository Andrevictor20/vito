package domain

import (
	"context"
	"time"
)

// SyncedContact representa um contato sincronizado da agenda telefônica ou do WhatsApp.
//
// O nome salvo pelo dono ("isa") vive no celular e deve persistir no banco SQLite,
// sobrevivendo a reinicializações de contêiner ou deploys, sem depender apenas da
// existência de mensagens prévias no shadow inbox.
type SyncedContact struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Phone       string    `json:"phone"`
	PhoneDigits string    `json:"phone_digits"`
	JID         string    `json:"jid,omitempty"`
	LID         string    `json:"lid,omitempty"`
	SavedName   string    `json:"saved_name"`
	ProfileName string    `json:"profile_name,omitempty"`
	Source      string    `json:"source"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// SyncedContactRepository define o contrato de persistência dos contatos sincronizados.
type SyncedContactRepository interface {
	UpsertBatch(ctx context.Context, contacts []SyncedContact) (int64, error)
	ListByUserID(ctx context.Context, userID string) ([]SyncedContact, error)
	ListAll(ctx context.Context) ([]SyncedContact, error)
	FindByNameOrPhone(ctx context.Context, userID, query string) ([]SyncedContact, error)
	GetByJIDOrLID(ctx context.Context, userID, identifier string) (*SyncedContact, error)
}
