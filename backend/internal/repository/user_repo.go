package repository

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// UserRepositorySQLite implementa domain.UserRepository usando SQLite.
type UserRepositorySQLite struct {
	db *sql.DB
}

// NewUserRepository instancia um repositório de usuários SQLite.
func NewUserRepository(db *sql.DB) *UserRepositorySQLite {
	return &UserRepositorySQLite{db: db}
}

func (r *UserRepositorySQLite) Create(u *domain.User) error {
	if u.TokenVersion <= 0 {
		u.TokenVersion = 1
	}
	query := `
		INSERT INTO users (id, name, email, phone, password_hash, token_version, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.Exec(query, u.ID, u.Name, u.Email, u.Phone, u.PasswordHash, u.TokenVersion, u.CreatedAt, u.UpdatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return domain.ErrUserAlreadyExists
		}
		return err
	}
	return nil
}

func (r *UserRepositorySQLite) scanUser(row interface{ Scan(dest ...any) error }) (*domain.User, error) {
	var u domain.User
	var phone sql.NullString
	err := row.Scan(
		&u.ID, &u.Name, &u.Email, &phone, &u.PasswordHash, &u.TokenVersion, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrUserNotFound
		}
		return nil, err
	}
	if phone.Valid {
		u.Phone = &phone.String
	}
	return &u, nil
}

func (r *UserRepositorySQLite) GetByID(id string) (*domain.User, error) {
	query := `
		SELECT id, name, email, phone, password_hash, token_version, created_at, updated_at
		FROM users
		WHERE id = ?
	`
	return r.scanUser(r.db.QueryRow(query, id))
}

func (r *UserRepositorySQLite) GetByEmail(email string) (*domain.User, error) {
	query := `
		SELECT id, name, email, phone, password_hash, token_version, created_at, updated_at
		FROM users
		WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))
	`
	return r.scanUser(r.db.QueryRow(query, email))
}

func (r *UserRepositorySQLite) GetByPhone(phone string) (*domain.User, error) {
	query := `
		SELECT id, name, email, phone, password_hash, token_version, created_at, updated_at
		FROM users
		WHERE phone = ?
	`
	return r.scanUser(r.db.QueryRow(query, phone))
}

func (r *UserRepositorySQLite) UpdatePhone(id, phone string) error {
	query := `UPDATE users SET phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
	res, err := r.db.Exec(query, phone, id)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return domain.ErrUserAlreadyExists
		}
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return domain.ErrUserNotFound
	}
	return nil
}

// IncrementTokenVersion incrementa a versão de token do usuário, revogando instantaneamente todas as sessões ativas.
// ListIDs retorna todos os IDs (uso do BehavioralWorker; fora da interface).
func (r *UserRepositorySQLite) ListIDs() ([]string, error) {
	rows, err := r.db.Query(`SELECT id FROM users`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}
	return ids, rows.Err()
}

func (r *UserRepositorySQLite) IncrementTokenVersion(id string) error {
	query := `UPDATE users SET token_version = token_version + 1 WHERE id = ?`
	res, err := r.db.Exec(query, id)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return domain.ErrUserNotFound
	}
	return nil
}

func (r *UserRepositorySQLite) ListAll() ([]domain.User, error) {
	query := `SELECT id, name, email, phone, password_hash, token_version, created_at, updated_at FROM users`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []domain.User
	for rows.Next() {
		var u domain.User
		var phone sql.NullString
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &phone, &u.PasswordHash, &u.TokenVersion, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		if phone.Valid {
			u.Phone = &phone.String
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

