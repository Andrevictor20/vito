package repository

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/google/uuid"
)

// ContactRepositorySQLite gerencia a persistência de contatos sincronizados no SQLite.
type ContactRepositorySQLite struct {
	db *sql.DB
}

// NewContactRepository cria uma nova instância de ContactRepositorySQLite.
func NewContactRepository(db *sql.DB) *ContactRepositorySQLite {
	return &ContactRepositorySQLite{db: db}
}

// UpsertBatch grava ou atualiza um lote de contatos no banco.
func (r *ContactRepositorySQLite) UpsertBatch(ctx context.Context, contacts []domain.SyncedContact) (int64, error) {
	if len(contacts) == 0 {
		return 0, nil
	}

	var affected int64
	err := database.WithBusyRetry(5, func() error {
		tx, err := r.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		defer func() { _ = tx.Rollback() }()

		stmt, err := tx.PrepareContext(ctx, `
			INSERT INTO synced_contacts (
				id, user_id, phone, phone_digits, jid, lid, saved_name, profile_name, source, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(user_id, phone_digits) DO UPDATE SET
				saved_name   = excluded.saved_name,
				profile_name = CASE WHEN excluded.profile_name <> '' THEN excluded.profile_name ELSE synced_contacts.profile_name END,
				jid          = CASE WHEN excluded.jid <> '' THEN excluded.jid ELSE synced_contacts.jid END,
				lid          = CASE WHEN excluded.lid <> '' THEN excluded.lid ELSE synced_contacts.lid END,
				source       = CASE WHEN excluded.source <> '' THEN excluded.source ELSE synced_contacts.source END,
				updated_at   = excluded.updated_at;
		`)
		if err != nil {
			return err
		}
		defer stmt.Close()

		now := time.Now().UTC()
		for _, c := range contacts {
			if strings.TrimSpace(c.UserID) == "" || strings.TrimSpace(c.PhoneDigits) == "" {
				continue
			}
			id := c.ID
			if id == "" {
				id = uuid.NewString()
			}
			createdAt := c.CreatedAt
			if createdAt.IsZero() {
				createdAt = now
			}
			updatedAt := c.UpdatedAt
			if updatedAt.IsZero() {
				updatedAt = now
			}

			res, execErr := stmt.ExecContext(ctx,
				id,
				c.UserID,
				c.Phone,
				c.PhoneDigits,
				c.JID,
				c.LID,
				c.SavedName,
				c.ProfileName,
				c.Source,
				createdAt,
				updatedAt,
			)
			if execErr != nil {
				return execErr
			}
			if rows, _ := res.RowsAffected(); rows > 0 {
				affected++
			}
		}

		return tx.Commit()
	})

	return affected, err
}

const contactSelectCols = `id, user_id, phone, phone_digits, jid, lid, saved_name, profile_name, source, created_at, updated_at`

func scanContact(row interface{ Scan(...any) error }) (*domain.SyncedContact, error) {
	var c domain.SyncedContact
	err := row.Scan(
		&c.ID,
		&c.UserID,
		&c.Phone,
		&c.PhoneDigits,
		&c.JID,
		&c.LID,
		&c.SavedName,
		&c.ProfileName,
		&c.Source,
		&c.CreatedAt,
		&c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// ListByUserID lista todos os contatos sincronizados de um usuário.
func (r *ContactRepositorySQLite) ListByUserID(ctx context.Context, userID string) ([]domain.SyncedContact, error) {
	if strings.TrimSpace(userID) == "" {
		return []domain.SyncedContact{}, nil
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT `+contactSelectCols+`
		FROM synced_contacts
		WHERE user_id = ?
		ORDER BY saved_name COLLATE NOCASE ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var contacts []domain.SyncedContact
	for rows.Next() {
		c, err := scanContact(rows)
		if err != nil {
			return nil, err
		}
		contacts = append(contacts, *c)
	}
	return contacts, rows.Err()
}

// ListAll devolve todos os contatos sincronizados do banco (usado para hidratação de cache no boot).
func (r *ContactRepositorySQLite) ListAll(ctx context.Context) ([]domain.SyncedContact, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT `+contactSelectCols+`
		FROM synced_contacts
		ORDER BY user_id, saved_name COLLATE NOCASE ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var contacts []domain.SyncedContact
	for rows.Next() {
		c, err := scanContact(rows)
		if err != nil {
			return nil, err
		}
		contacts = append(contacts, *c)
	}
	return contacts, rows.Err()
}

// FindByNameOrPhone busca contatos por termo aproximado no nome salvo, nome de perfil ou dígitos do telefone.
func (r *ContactRepositorySQLite) FindByNameOrPhone(ctx context.Context, userID, query string) ([]domain.SyncedContact, error) {
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(query) == "" {
		return []domain.SyncedContact{}, nil
	}

	pattern := "%" + strings.TrimSpace(query) + "%"
	rows, err := r.db.QueryContext(ctx, `
		SELECT `+contactSelectCols+`
		FROM synced_contacts
		WHERE user_id = ?
		  AND (saved_name LIKE ? OR profile_name LIKE ? OR phone_digits LIKE ?)
		ORDER BY saved_name COLLATE NOCASE ASC
		LIMIT 20
	`, userID, pattern, pattern, pattern)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var contacts []domain.SyncedContact
	for rows.Next() {
		c, err := scanContact(rows)
		if err != nil {
			return nil, err
		}
		contacts = append(contacts, *c)
	}
	return contacts, rows.Err()
}

// GetByJIDOrLID busca um contato pelo identificador JID (@s.whatsapp.net) ou LID (@lid).
func (r *ContactRepositorySQLite) GetByJIDOrLID(ctx context.Context, userID, identifier string) (*domain.SyncedContact, error) {
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(identifier) == "" {
		return nil, nil
	}

	row := r.db.QueryRowContext(ctx, `
		SELECT `+contactSelectCols+`
		FROM synced_contacts
		WHERE user_id = ? AND (jid = ? OR lid = ?)
		LIMIT 1
	`, userID, identifier, identifier)

	c, err := scanContact(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return c, nil
}
