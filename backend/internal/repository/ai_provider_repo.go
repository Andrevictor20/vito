package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/google/uuid"
)

// AIProviderRepositorySQLite implementa domain.AIProviderRepository sobre SQLite.
type AIProviderRepositorySQLite struct {
	db *sql.DB
}

// NewAIProviderRepository instancia o repositório de provedores BYOK de IA.
func NewAIProviderRepository(db *sql.DB) *AIProviderRepositorySQLite {
	return &AIProviderRepositorySQLite{db: db}
}

// Upsert insere ou atualiza um provedor BYOK do usuário via DefaultWriterQueue.
func (r *AIProviderRepositorySQLite) Upsert(ctx context.Context, p *domain.UserAIProvider) error {
	if p == nil || !domain.IsBYOKProviderKey(p.ProviderKey) {
		return domain.ErrInvalidProviderKey
	}
	now := time.Now().UTC()
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	if p.Status == "" {
		p.Status = domain.ProviderStatusOK
	}
	if p.CreatedAt.IsZero() {
		p.CreatedAt = now
	}
	p.UpdatedAt = now

	modelsJSON := p.ModelsJSON
	if len(p.Models) > 0 {
		raw, err := json.Marshal(p.Models)
		if err != nil {
			return err
		}
		modelsJSON = string(raw)
	}
	if modelsJSON == "" {
		modelsJSON = "[]"
	}
	p.ModelsJSON = modelsJSON

	const query = `
		INSERT INTO user_ai_providers (
			id, user_id, provider_key, base_url, key_ciphertext, key_last4,
			status, verified_at, models_json, models_fetched_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id, provider_key) DO UPDATE SET
			base_url = excluded.base_url,
			key_ciphertext = excluded.key_ciphertext,
			key_last4 = excluded.key_last4,
			status = excluded.status,
			verified_at = excluded.verified_at,
			models_json = excluded.models_json,
			models_fetched_at = excluded.models_fetched_at,
			updated_at = excluded.updated_at
	`
	return ExecuteQueuedWrite(ctx, func() error {
		_, err := r.db.ExecContext(
			ctx, query,
			p.ID, p.UserID, string(p.ProviderKey), p.BaseURL, p.KeyCiphertext, p.KeyLast4,
			p.Status, p.VerifiedAt, modelsJSON, p.ModelsFetchedAt, p.CreatedAt, p.UpdatedAt,
		)
		return err
	})
}

// GetByUserAndKey retorna o registro completo (com KeyCiphertext) para uso interno do cofre.
func (r *AIProviderRepositorySQLite) GetByUserAndKey(ctx context.Context, userID string, key domain.ProviderKey) (*domain.UserAIProvider, error) {
	if !domain.IsBYOKProviderKey(key) {
		return nil, domain.ErrInvalidProviderKey
	}
	const query = `
		SELECT id, user_id, provider_key, base_url, key_ciphertext, key_last4,
		       status, verified_at, models_json, models_fetched_at, created_at, updated_at
		FROM user_ai_providers
		WHERE user_id = ? AND provider_key = ?
	`
	var p domain.UserAIProvider
	var keyStr string
	var verifiedAt, fetchedAt sql.NullTime
	err := r.db.QueryRowContext(ctx, query, userID, string(key)).Scan(
		&p.ID, &p.UserID, &keyStr, &p.BaseURL, &p.KeyCiphertext, &p.KeyLast4,
		&p.Status, &verifiedAt, &p.ModelsJSON, &fetchedAt, &p.CreatedAt, &p.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrAIProviderNotFound
	}
	if err != nil {
		return nil, err
	}
	p.ProviderKey = domain.ProviderKey(keyStr)
	if verifiedAt.Valid {
		t := verifiedAt.Time
		p.VerifiedAt = &t
	}
	if fetchedAt.Valid {
		t := fetchedAt.Time
		p.ModelsFetchedAt = &t
	}
	p.Models = decodeProviderModels(p.ModelsJSON)
	return &p, nil
}

// ListByUser retorna os resumos públicos dos provedores conectados (nunca consulta key_ciphertext).
func (r *AIProviderRepositorySQLite) ListByUser(ctx context.Context, userID string) ([]domain.UserAIProviderSummary, error) {
	const query = `
		SELECT id, provider_key, base_url, key_last4, status,
		       verified_at, models_json, models_fetched_at
		FROM user_ai_providers
		WHERE user_id = ?
		ORDER BY created_at ASC
	`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var summaries []domain.UserAIProviderSummary
	for rows.Next() {
		var s domain.UserAIProviderSummary
		var keyStr, modelsJSON string
		var verifiedAt, fetchedAt sql.NullTime
		if err := rows.Scan(
			&s.ID, &keyStr, &s.BaseURL, &s.KeyLast4, &s.Status,
			&verifiedAt, &modelsJSON, &fetchedAt,
		); err != nil {
			return nil, err
		}
		s.ProviderKey = domain.ProviderKey(keyStr)
		s.Connected = true
		if verifiedAt.Valid {
			t := verifiedAt.Time
			s.VerifiedAt = &t
		}
		if fetchedAt.Valid {
			t := fetchedAt.Time
			s.ModelsFetchedAt = &t
		}
		s.Models = decodeProviderModels(modelsJSON)
		s.ModelCount = len(s.Models)
		summaries = append(summaries, s)
	}
	return summaries, rows.Err()
}

// UpdateStatus atualiza o status ('ok' | 'invalid') do provedor conectado.
func (r *AIProviderRepositorySQLite) UpdateStatus(ctx context.Context, userID string, key domain.ProviderKey, status string) error {
	if !domain.IsBYOKProviderKey(key) {
		return domain.ErrInvalidProviderKey
	}
	if status != domain.ProviderStatusOK && status != domain.ProviderStatusInvalid {
		return errors.New("status de provedor inválido")
	}
	const query = `
		UPDATE user_ai_providers
		SET status = ?, updated_at = ?
		WHERE user_id = ? AND provider_key = ?
	`
	n, err := ExecuteQueuedWriteRows(ctx, func() (sql.Result, error) {
		return r.db.ExecContext(ctx, query, status, time.Now().UTC(), userID, string(key))
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return domain.ErrAIProviderNotFound
	}
	return nil
}

// UpdateModels atualiza o cache de modelos disponíveis e o timestamp de busca.
func (r *AIProviderRepositorySQLite) UpdateModels(ctx context.Context, userID string, key domain.ProviderKey, models []domain.ProviderModelInfo, fetchedAt time.Time) error {
	if !domain.IsBYOKProviderKey(key) {
		return domain.ErrInvalidProviderKey
	}
	raw, err := json.Marshal(models)
	if err != nil {
		return err
	}
	if fetchedAt.IsZero() {
		fetchedAt = time.Now().UTC()
	}
	const query = `
		UPDATE user_ai_providers
		SET models_json = ?, models_fetched_at = ?, updated_at = ?
		WHERE user_id = ? AND provider_key = ?
	`
	n, err := ExecuteQueuedWriteRows(ctx, func() (sql.Result, error) {
		return r.db.ExecContext(ctx, query, string(raw), fetchedAt.UTC(), time.Now().UTC(), userID, string(key))
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return domain.ErrAIProviderNotFound
	}
	return nil
}

// Delete remove um provedor conectado do usuário.
func (r *AIProviderRepositorySQLite) Delete(ctx context.Context, userID string, key domain.ProviderKey) error {
	if !domain.IsBYOKProviderKey(key) {
		return domain.ErrInvalidProviderKey
	}
	const query = `DELETE FROM user_ai_providers WHERE user_id = ? AND provider_key = ?`
	n, err := ExecuteQueuedWriteRows(ctx, func() (sql.Result, error) {
		return r.db.ExecContext(ctx, query, userID, string(key))
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return domain.ErrAIProviderNotFound
	}
	return nil
}

func decodeProviderModels(raw string) []domain.ProviderModelInfo {
	if raw == "" || raw == "[]" {
		return nil
	}
	var models []domain.ProviderModelInfo
	if err := json.Unmarshal([]byte(raw), &models); err != nil {
		return nil
	}
	return models
}
