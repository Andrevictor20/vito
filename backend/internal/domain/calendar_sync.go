package domain

import (
	"errors"
	"time"
)

var (
	ErrIntegrationNotFound = errors.New("integração de calendário não encontrada")
	ErrMappingNotFound     = errors.New("mapeamento de evento externo não encontrado")
	ErrInvalidProvider     = errors.New("provedor de calendário inválido")
)

const (
	ProviderGoogle      = "google"
	ProviderAppleCalDAV = "apple_caldav"
	ProviderAppleNative = "apple_native"

	IntegrationStatusActive         = "active"
	IntegrationStatusReauthRequired = "reauth_required"
	IntegrationStatusError          = "error"
)

// CalendarIntegration armazena o estado, tokens e parâmetros da conta sincronizada.
type CalendarIntegration struct {
	ID                   string     `json:"id"`
	UserID               string     `json:"user_id"`
	Provider             string     `json:"provider"`
	AccountEmail         string     `json:"account_email"`
	EncryptedCredentials string     `json:"-"` // Oculto de saídas JSON da API por segurança
	CalendarID           string     `json:"calendar_id"`
	CalendarName         string     `json:"calendar_name"`
	SyncToken            string     `json:"sync_token,omitempty"`
	ChannelID            string     `json:"channel_id,omitempty"`
	ChannelExpiration    *time.Time `json:"channel_expiration,omitempty"`
	Status               string     `json:"status"`
	LastSyncedAt         *time.Time `json:"last_synced_at,omitempty"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

// ExternalEventMapping relaciona eventos do Vito a eventos remotos com controle de hash para anti-eco.
type ExternalEventMapping struct {
	ID              string    `json:"id"`
	EventID         string    `json:"event_id"`
	UserID          string    `json:"user_id"`
	Provider        string    `json:"provider"`
	ExternalEventID string    `json:"external_event_id"`
	ExternalETag    string    `json:"external_etag,omitempty"`
	ContentHash     string    `json:"content_hash"`
	LastSyncedAt    time.Time `json:"last_synced_at"`
	Status          string    `json:"status"`
}

// CalendarTombstone registra exclusões no Vito para sincronização assíncrona com a nuvem.
type CalendarTombstone struct {
	ID              string    `json:"id"`
	UserID          string    `json:"user_id"`
	Provider        string    `json:"provider"`
	ExternalEventID string    `json:"external_event_id"`
	DeletedAt       time.Time `json:"deleted_at"`
}

// CalendarSyncRepository define o contrato de persistência para as integrações de calendário.
type CalendarSyncRepository interface {
	UpsertIntegration(integration *CalendarIntegration) error
	GetIntegration(userID, provider string) (*CalendarIntegration, error)
	ListIntegrationsByUser(userID string) ([]CalendarIntegration, error)
	DeleteIntegration(userID, provider string) error

	UpsertMapping(mapping *ExternalEventMapping) error
	GetMappingByExternalID(userID, provider, externalID string) (*ExternalEventMapping, error)
	GetMappingByEventID(eventID, provider string) (*ExternalEventMapping, error)
	DeleteMapping(id string) error

	CreateTombstone(tombstone *CalendarTombstone) error
	ListTombstones(userID, provider string) ([]CalendarTombstone, error)
	DeleteTombstone(id string) error
}
