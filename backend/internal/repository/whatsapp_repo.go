package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// WhatsAppRepositorySQLite implementa domain.WhatsAppRepository usando SQLite.
type WhatsAppRepositorySQLite struct {
	db *sql.DB
}

// NewWhatsAppRepository cria uma nova instância do repositório SQLite para WhatsApp.
func NewWhatsAppRepository(db *sql.DB) *WhatsAppRepositorySQLite {
	return &WhatsAppRepositorySQLite{db: db}
}

// GetByUserID busca a integração ativa pelo ID do usuário.
func (r *WhatsAppRepositorySQLite) GetByUserID(ctx context.Context, userID string) (*domain.WhatsAppIntegration, error) {
	query := `
		SELECT id, user_id, instance_name, phone, status, pairing_code, last_connected_at, created_at, updated_at
		FROM whatsapp_integrations
		WHERE user_id = ?
		LIMIT 1
	`
	var w domain.WhatsAppIntegration
	var phone, pairingCode sql.NullString
	var lastConnectedAt sql.NullTime

	err := r.db.QueryRowContext(ctx, query, userID).Scan(
		&w.ID,
		&w.UserID,
		&w.InstanceName,
		&phone,
		&w.Status,
		&pairingCode,
		&lastConnectedAt,
		&w.CreatedAt,
		&w.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrWhatsAppIntegrationNotFound
		}
		return nil, err
	}

	if phone.Valid {
		w.Phone = phone.String
	}
	if pairingCode.Valid {
		w.PairingCode = pairingCode.String
	}
	if lastConnectedAt.Valid {
		t := lastConnectedAt.Time
		w.LastConnectedAt = &t
	}

	return &w, nil
}

// GetByInstanceName busca a integração pelo nome da instância na Evolution API.
func (r *WhatsAppRepositorySQLite) GetByInstanceName(ctx context.Context, instanceName string) (*domain.WhatsAppIntegration, error) {
	query := `
		SELECT id, user_id, instance_name, phone, status, pairing_code, last_connected_at, created_at, updated_at
		FROM whatsapp_integrations
		WHERE instance_name = ?
		LIMIT 1
	`
	var w domain.WhatsAppIntegration
	var phone, pairingCode sql.NullString
	var lastConnectedAt sql.NullTime

	err := r.db.QueryRowContext(ctx, query, instanceName).Scan(
		&w.ID,
		&w.UserID,
		&w.InstanceName,
		&phone,
		&w.Status,
		&pairingCode,
		&lastConnectedAt,
		&w.CreatedAt,
		&w.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrWhatsAppIntegrationNotFound
		}
		return nil, err
	}

	if phone.Valid {
		w.Phone = phone.String
	}
	if pairingCode.Valid {
		w.PairingCode = pairingCode.String
	}
	if lastConnectedAt.Valid {
		t := lastConnectedAt.Time
		w.LastConnectedAt = &t
	}

	return &w, nil
}

// GetByPhone busca a integração pelo número de telefone cadastrado.
func (r *WhatsAppRepositorySQLite) GetByPhone(ctx context.Context, phone string) (*domain.WhatsAppIntegration, error) {
	query := `
		SELECT id, user_id, instance_name, phone, status, pairing_code, last_connected_at, created_at, updated_at
		FROM whatsapp_integrations
		WHERE phone = ?
		LIMIT 1
	`
	var w domain.WhatsAppIntegration
	var phoneCol, pairingCode sql.NullString
	var lastConnectedAt sql.NullTime

	err := r.db.QueryRowContext(ctx, query, phone).Scan(
		&w.ID,
		&w.UserID,
		&w.InstanceName,
		&phoneCol,
		&w.Status,
		&pairingCode,
		&lastConnectedAt,
		&w.CreatedAt,
		&w.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrWhatsAppIntegrationNotFound
		}
		return nil, err
	}

	if phoneCol.Valid {
		w.Phone = phoneCol.String
	}
	if pairingCode.Valid {
		w.PairingCode = pairingCode.String
	}
	if lastConnectedAt.Valid {
		t := lastConnectedAt.Time
		w.LastConnectedAt = &t
	}

	return &w, nil
}

// FindConnectedInstance busca a integração de WhatsApp mais recente que esteja conectada ("connected").
func (r *WhatsAppRepositorySQLite) FindConnectedInstance(ctx context.Context) (*domain.WhatsAppIntegration, error) {
	query := `
		SELECT id, user_id, instance_name, phone, status, pairing_code, last_connected_at, created_at, updated_at
		FROM whatsapp_integrations
		WHERE status = 'connected'
		ORDER BY COALESCE(last_connected_at, updated_at) DESC
		LIMIT 1
	`
	var w domain.WhatsAppIntegration
	var phoneCol, pairingCode sql.NullString
	var lastConnectedAt sql.NullTime

	err := r.db.QueryRowContext(ctx, query).Scan(
		&w.ID,
		&w.UserID,
		&w.InstanceName,
		&phoneCol,
		&w.Status,
		&pairingCode,
		&lastConnectedAt,
		&w.CreatedAt,
		&w.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrWhatsAppIntegrationNotFound
		}
		return nil, err
	}

	if phoneCol.Valid {
		w.Phone = phoneCol.String
	}
	if pairingCode.Valid {
		w.PairingCode = pairingCode.String
	}
	if lastConnectedAt.Valid {
		t := lastConnectedAt.Time
		w.LastConnectedAt = &t
	}

	return &w, nil
}

// ListAll retorna todas as integrações do WhatsApp (usado pelo backfill de contexto).
func (r *WhatsAppRepositorySQLite) ListAll(ctx context.Context) ([]domain.WhatsAppIntegration, error) {
	query := `
		SELECT id, user_id, instance_name, phone, status, pairing_code, last_connected_at, created_at, updated_at
		FROM whatsapp_integrations
		ORDER BY COALESCE(last_connected_at, updated_at) DESC
	`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]domain.WhatsAppIntegration, 0, 4)
	for rows.Next() {
		var w domain.WhatsAppIntegration
		var phoneCol, pairingCode sql.NullString
		var lastConnectedAt sql.NullTime
		if err := rows.Scan(
			&w.ID, &w.UserID, &w.InstanceName, &phoneCol, &w.Status,
			&pairingCode, &lastConnectedAt, &w.CreatedAt, &w.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if phoneCol.Valid {
			w.Phone = phoneCol.String
		}
		if pairingCode.Valid {
			w.PairingCode = pairingCode.String
		}
		if lastConnectedAt.Valid {
			w.LastConnectedAt = &lastConnectedAt.Time
		}
		result = append(result, w)
	}
	return result, rows.Err()
}

// Upsert salva ou atualiza o registro de integração do WhatsApp.
func (r *WhatsAppRepositorySQLite) Upsert(ctx context.Context, i *domain.WhatsAppIntegration) error {
	now := time.Now().UTC()
	if i.CreatedAt.IsZero() {
		i.CreatedAt = now
	}
	i.UpdatedAt = now

	query := `
		INSERT INTO whatsapp_integrations (
			id, user_id, instance_name, phone, status, pairing_code, last_connected_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			instance_name = excluded.instance_name,
			phone = excluded.phone,
			status = excluded.status,
			pairing_code = excluded.pairing_code,
			last_connected_at = excluded.last_connected_at,
			updated_at = excluded.updated_at
	`
	_, err := r.db.ExecContext(ctx, query,
		i.ID,
		i.UserID,
		i.InstanceName,
		i.Phone,
		i.Status,
		i.PairingCode,
		i.LastConnectedAt,
		i.CreatedAt,
		i.UpdatedAt,
	)
	return err
}

// UpdateStatus atualiza apenas o estado de conexão e timestamp.
func (r *WhatsAppRepositorySQLite) UpdateStatus(ctx context.Context, id string, status string, lastConnectedAt *time.Time) error {
	query := `
		UPDATE whatsapp_integrations
		SET status = ?, last_connected_at = ?, updated_at = ?
		WHERE id = ?
	`
	_, err := r.db.ExecContext(ctx, query, status, lastConnectedAt, time.Now().UTC(), id)
	return err
}

// Delete remove a integração pelo userID.
func (r *WhatsAppRepositorySQLite) Delete(ctx context.Context, userID string) error {
	query := `DELETE FROM whatsapp_integrations WHERE user_id = ?`
	_, err := r.db.ExecContext(ctx, query, userID)
	return err
}
