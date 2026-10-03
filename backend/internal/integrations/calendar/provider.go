package calendar

import (
	"context"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// SyncItem representa um evento normalizado retornado por um provedor remoto.
type SyncItem struct {
	ExternalID  string
	ETag        string
	Title       string
	Description string
	Location    string
	StartAt     time.Time
	EndAt       time.Time
	Status      string // "confirmed", "cancelled"
	IsAllDay    bool
}

// SyncResult encapsula os eventos sincronizados e os metadados de sync incremental.
type SyncResult struct {
	Items        []SyncItem
	NewSyncToken string
	FullSyncReq  bool // true se o syncToken expirou (HTTP 410) e necessita resync completo
}

// Provider define o contrato para comunicação com provedores de calendário (Google, Apple, etc).
type Provider interface {
	Name() string
	FetchEvents(ctx context.Context, credentials, calendarID, syncToken string, from, to time.Time) (*SyncResult, error)
	CreateEvent(ctx context.Context, credentials, calendarID string, event *domain.Event) (*SyncItem, error)
	UpdateEvent(ctx context.Context, credentials, calendarID, externalID string, event *domain.Event) (*SyncItem, error)
	DeleteEvent(ctx context.Context, credentials, calendarID, externalID string) error
	RefreshToken(ctx context.Context, credentials string) (newCredentials string, err error)
}
