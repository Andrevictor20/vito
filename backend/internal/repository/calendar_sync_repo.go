package repository

import (
	"database/sql"
	"errors"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// CalendarSyncRepositorySQLite implementa domain.CalendarSyncRepository usando SQLite.
type CalendarSyncRepositorySQLite struct {
	db *sql.DB
}

// NewCalendarSyncRepository cria uma nova instância do repositório SQLite.
func NewCalendarSyncRepository(db *sql.DB) *CalendarSyncRepositorySQLite {
	return &CalendarSyncRepositorySQLite{db: db}
}

// UpsertIntegration insere ou atualiza os parâmetros de uma integração de calendário.
func (r *CalendarSyncRepositorySQLite) UpsertIntegration(i *domain.CalendarIntegration) error {
	query := `
		INSERT INTO calendar_integrations (
			id, user_id, provider, account_email, encrypted_credentials,
			calendar_id, calendar_name, sync_token, channel_id, channel_expiration,
			status, last_synced_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id, provider, account_email) DO UPDATE SET
			encrypted_credentials = excluded.encrypted_credentials,
			calendar_id = excluded.calendar_id,
			calendar_name = excluded.calendar_name,
			sync_token = excluded.sync_token,
			channel_id = excluded.channel_id,
			channel_expiration = excluded.channel_expiration,
			status = excluded.status,
			last_synced_at = excluded.last_synced_at,
			updated_at = excluded.updated_at
	`
	_, err := r.db.Exec(query,
		i.ID, i.UserID, i.Provider, i.AccountEmail, i.EncryptedCredentials,
		i.CalendarID, i.CalendarName, i.SyncToken, i.ChannelID, i.ChannelExpiration,
		i.Status, i.LastSyncedAt, i.CreatedAt, i.UpdatedAt,
	)
	return err
}

// GetIntegration busca uma integração específica por usuário e provedor.
func (r *CalendarSyncRepositorySQLite) GetIntegration(userID, provider string) (*domain.CalendarIntegration, error) {
	query := `
		SELECT id, user_id, provider, account_email, encrypted_credentials,
		       calendar_id, calendar_name, sync_token, channel_id, channel_expiration,
		       status, last_synced_at, created_at, updated_at
		FROM calendar_integrations
		WHERE user_id = ? AND provider = ?
		LIMIT 1
	`
	var i domain.CalendarIntegration
	var lastSyncedAt sql.NullTime
	var channelExpiration sql.NullTime
	var syncToken, channelID, calName sql.NullString

	err := r.db.QueryRow(query, userID, provider).Scan(
		&i.ID, &i.UserID, &i.Provider, &i.AccountEmail, &i.EncryptedCredentials,
		&i.CalendarID, &calName, &syncToken, &channelID, &channelExpiration,
		&i.Status, &lastSyncedAt, &i.CreatedAt, &i.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrIntegrationNotFound
		}
		return nil, err
	}

	if calName.Valid {
		i.CalendarName = calName.String
	}
	if syncToken.Valid {
		i.SyncToken = syncToken.String
	}
	if channelID.Valid {
		i.ChannelID = channelID.String
	}
	if channelExpiration.Valid {
		t := channelExpiration.Time
		i.ChannelExpiration = &t
	}
	if lastSyncedAt.Valid {
		t := lastSyncedAt.Time
		i.LastSyncedAt = &t
	}

	return &i, nil
}

// ListIntegrationsByUser lista todas as integrações ativas de um usuário.
func (r *CalendarSyncRepositorySQLite) ListIntegrationsByUser(userID string) ([]domain.CalendarIntegration, error) {
	query := `
		SELECT id, user_id, provider, account_email, encrypted_credentials,
		       calendar_id, calendar_name, sync_token, channel_id, channel_expiration,
		       status, last_synced_at, created_at, updated_at
		FROM calendar_integrations
		WHERE user_id = ?
		ORDER BY created_at ASC
	`
	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domain.CalendarIntegration
	for rows.Next() {
		var i domain.CalendarIntegration
		var lastSyncedAt sql.NullTime
		var channelExpiration sql.NullTime
		var syncToken, channelID, calName sql.NullString

		if err := rows.Scan(
			&i.ID, &i.UserID, &i.Provider, &i.AccountEmail, &i.EncryptedCredentials,
			&i.CalendarID, &calName, &syncToken, &channelID, &channelExpiration,
			&i.Status, &lastSyncedAt, &i.CreatedAt, &i.UpdatedAt,
		); err != nil {
			return nil, err
		}

		if calName.Valid {
			i.CalendarName = calName.String
		}
		if syncToken.Valid {
			i.SyncToken = syncToken.String
		}
		if channelID.Valid {
			i.ChannelID = channelID.String
		}
		if channelExpiration.Valid {
			t := channelExpiration.Time
			i.ChannelExpiration = &t
		}
		if lastSyncedAt.Valid {
			t := lastSyncedAt.Time
			i.LastSyncedAt = &t
		}

		list = append(list, i)
	}

	return list, rows.Err()
}

// DeleteIntegration remove uma integração de calendário de um usuário.
func (r *CalendarSyncRepositorySQLite) DeleteIntegration(userID, provider string) error {
	query := `DELETE FROM calendar_integrations WHERE user_id = ? AND provider = ?`
	_, err := r.db.Exec(query, userID, provider)
	return err
}

// UpsertMapping insere ou atualiza um mapeamento de evento entre o Vito e o calendário externo.
func (r *CalendarSyncRepositorySQLite) UpsertMapping(m *domain.ExternalEventMapping) error {
	query := `
		INSERT INTO external_event_mappings (
			id, event_id, user_id, provider, external_event_id,
			external_etag, content_hash, last_synced_at, status
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id, provider, external_event_id) DO UPDATE SET
			event_id = excluded.event_id,
			external_etag = excluded.external_etag,
			content_hash = excluded.content_hash,
			last_synced_at = excluded.last_synced_at,
			status = excluded.status
	`
	_, err := r.db.Exec(query,
		m.ID, m.EventID, m.UserID, m.Provider, m.ExternalEventID,
		m.ExternalETag, m.ContentHash, m.LastSyncedAt, m.Status,
	)
	return err
}

// GetMappingByExternalID localiza o mapeamento correspondente a um ID externo.
func (r *CalendarSyncRepositorySQLite) GetMappingByExternalID(userID, provider, externalID string) (*domain.ExternalEventMapping, error) {
	query := `
		SELECT id, event_id, user_id, provider, external_event_id, external_etag, content_hash, last_synced_at, status
		FROM external_event_mappings
		WHERE user_id = ? AND provider = ? AND external_event_id = ?
		LIMIT 1
	`
	var m domain.ExternalEventMapping
	var etag sql.NullString

	err := r.db.QueryRow(query, userID, provider, externalID).Scan(
		&m.ID, &m.EventID, &m.UserID, &m.Provider, &m.ExternalEventID, &etag, &m.ContentHash, &m.LastSyncedAt, &m.Status,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrMappingNotFound
		}
		return nil, err
	}

	if etag.Valid {
		m.ExternalETag = etag.String
	}
	return &m, nil
}

// GetMappingByEventID localiza o mapeamento correspondente a um evento do Vito.
func (r *CalendarSyncRepositorySQLite) GetMappingByEventID(eventID, provider string) (*domain.ExternalEventMapping, error) {
	query := `
		SELECT id, event_id, user_id, provider, external_event_id, external_etag, content_hash, last_synced_at, status
		FROM external_event_mappings
		WHERE event_id = ? AND provider = ?
		LIMIT 1
	`
	var m domain.ExternalEventMapping
	var etag sql.NullString

	err := r.db.QueryRow(query, eventID, provider).Scan(
		&m.ID, &m.EventID, &m.UserID, &m.Provider, &m.ExternalEventID, &etag, &m.ContentHash, &m.LastSyncedAt, &m.Status,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrMappingNotFound
		}
		return nil, err
	}

	if etag.Valid {
		m.ExternalETag = etag.String
	}
	return &m, nil
}

// DeleteMapping remove um mapeamento por ID.
func (r *CalendarSyncRepositorySQLite) DeleteMapping(id string) error {
	query := `DELETE FROM external_event_mappings WHERE id = ?`
	_, err := r.db.Exec(query, id)
	return err
}

// CreateTombstone registra um tombstone para exclusão remota posterior.
func (r *CalendarSyncRepositorySQLite) CreateTombstone(t *domain.CalendarTombstone) error {
	query := `
		INSERT INTO calendar_tombstones (id, user_id, provider, external_event_id, deleted_at)
		VALUES (?, ?, ?, ?, ?)
	`
	_, err := r.db.Exec(query, t.ID, t.UserID, t.Provider, t.ExternalEventID, t.DeletedAt)
	return err
}

// ListTombstones lista todos os tombstones pendentes para um usuário e provedor.
func (r *CalendarSyncRepositorySQLite) ListTombstones(userID, provider string) ([]domain.CalendarTombstone, error) {
	query := `
		SELECT id, user_id, provider, external_event_id, deleted_at
		FROM calendar_tombstones
		WHERE user_id = ? AND provider = ?
		ORDER BY deleted_at ASC
	`
	rows, err := r.db.Query(query, userID, provider)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domain.CalendarTombstone
	for rows.Next() {
		var t domain.CalendarTombstone
		if err := rows.Scan(&t.ID, &t.UserID, &t.Provider, &t.ExternalEventID, &t.DeletedAt); err != nil {
			return nil, err
		}
		list = append(list, t)
	}
	return list, rows.Err()
}

// DeleteTombstone remove um tombstone após sua propagação concluída.
func (r *CalendarSyncRepositorySQLite) DeleteTombstone(id string) error {
	query := `DELETE FROM calendar_tombstones WHERE id = ?`
	_, err := r.db.Exec(query, id)
	return err
}
