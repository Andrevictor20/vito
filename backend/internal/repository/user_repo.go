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
		INSERT INTO users (id, name, email, password_hash, token_version, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.Exec(query, u.ID, u.Name, u.Email, u.PasswordHash, u.TokenVersion, u.CreatedAt, u.UpdatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return domain.ErrUserAlreadyExists
		}
		return err
	}
	return nil
}

func (r *UserRepositorySQLite) GetByID(id string) (*domain.User, error) {
	query := `
		SELECT id, name, email, password_hash, token_version, created_at, updated_at
		FROM users
		WHERE id = ?
	`
	var u domain.User
	err := r.db.QueryRow(query, id).Scan(
		&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.TokenVersion, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrUserNotFound
		}
		return nil, err
	}
	return &u, nil
}

func (r *UserRepositorySQLite) GetByEmail(email string) (*domain.User, error) {
	query := `
		SELECT id, name, email, password_hash, token_version, created_at, updated_at
		FROM users
		WHERE email = ?
	`
	var u domain.User
	err := r.db.QueryRow(query, email).Scan(
		&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.TokenVersion, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrUserNotFound
		}
		return nil, err
	}
	return &u, nil
}

// IncrementTokenVersion incrementa a versão de token do usuário, revogando instantaneamente todas as sessões ativas.
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

