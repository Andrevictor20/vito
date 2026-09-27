package repository

import (
	"database/sql"
	"errors"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// MemoryRepositorySQLite implementa domain.MemoryRepository usando SQLite.
type MemoryRepositorySQLite struct {
	db *sql.DB
}

// NewMemoryRepository instancia um repositório de memórias de longo prazo.
func NewMemoryRepository(db *sql.DB) *MemoryRepositorySQLite {
	return &MemoryRepositorySQLite{db: db}
}

func (r *MemoryRepositorySQLite) Create(m *domain.Memory) error {
	query := `
		INSERT INTO memories (id, user_id, category, content, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.Exec(query, m.ID, m.UserID, m.Category, m.Content, m.CreatedAt, m.UpdatedAt)
	return err
}

func (r *MemoryRepositorySQLite) GetByID(id, userID string) (*domain.Memory, error) {
	query := `
		SELECT id, user_id, category, content, created_at, updated_at
		FROM memories
		WHERE id = ? AND user_id = ?
	`
	var m domain.Memory
	err := r.db.QueryRow(query, id, userID).Scan(
		&m.ID, &m.UserID, &m.Category, &m.Content, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrMemoryNotFound
		}
		return nil, err
	}
	return &m, nil
}

func (r *MemoryRepositorySQLite) ListByUser(userID string, limit int) ([]domain.Memory, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	query := `
		SELECT id, user_id, category, content, created_at, updated_at
		FROM memories
		WHERE user_id = ?
		ORDER BY created_at DESC
		LIMIT ?
	`
	rows, err := r.db.Query(query, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var memories []domain.Memory
	for rows.Next() {
		var m domain.Memory
		if err := rows.Scan(&m.ID, &m.UserID, &m.Category, &m.Content, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		memories = append(memories, m)
	}

	return memories, rows.Err()
}

func (r *MemoryRepositorySQLite) Delete(id, userID string) error {
	query := `DELETE FROM memories WHERE id = ? AND user_id = ?`
	res, err := r.db.Exec(query, id, userID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return domain.ErrMemoryNotFound
	}
	return nil
}
