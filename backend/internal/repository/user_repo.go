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

const userByPhoneQuery = `
	SELECT id, name, email, phone, password_hash, token_version, created_at, updated_at
	FROM users
	WHERE phone = ?
	LIMIT 1
`

const userByPhoneSuffixQuery = `
	SELECT id, name, email, phone, password_hash, token_version, created_at, updated_at
	FROM users
	WHERE phone IS NOT NULL AND phone <> ''
		AND REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '-', '') LIKE '%' || ?
	LIMIT 25
`

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

// Delete remove o usuário do banco. Usado pela limpeza de contas placeholder órfãs
// (contas @vito.local sem sessão ativa e sem qualquer dado do usuário).
func (r *UserRepositorySQLite) Delete(id string) error {
	res, err := r.db.Exec(`DELETE FROM users WHERE id = ?`, id)
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
	clean := strings.TrimSpace(phone)
	if clean == "" {
		return nil, domain.ErrUserNotFound
	}

	// 1) Correspondência exata e variantes equivalentes do mesmo número
	//    (E.164, apenas dígitos e a variante brasileira de 8 dígitos).
	for _, variant := range domain.PhoneVariants(clean) {
		u, err := r.scanUser(r.db.QueryRow(userByPhoneQuery, variant))
		if err == nil && u != nil {
			return u, nil
		}
	}

	// 2) Fallback tolerante: candidatos cujo sufixo de 8 dígitos bate, comparados de forma canônica.
	digits := domain.PhoneDigits(clean)
	if len(digits) >= 8 {
		suffix := digits[len(digits)-8:]
		rows, err := r.db.Query(userByPhoneSuffixQuery, suffix)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				u, scanErr := r.scanUser(rows)
				if scanErr != nil || u == nil || u.Phone == nil {
					continue
				}
				if domain.PhonesMatch(*u.Phone, clean) {
					return u, nil
				}
			}
		}
	}

	return nil, domain.ErrUserNotFound
}

func (r *UserRepositorySQLite) UpdatePhone(id, phone string) error {
	var phoneVal interface{}
	// Persistência canônica: o telefone é sempre gravado em E.164, evitando que o mesmo
	// número exista em formatos diferentes (ex.: "5598984417165" e "+5598984417165").
	if normalized := domain.NormalizePhone(phone); normalized != "" {
		phoneVal = normalized
	}
	query := `UPDATE users SET phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
	res, err := r.db.Exec(query, phoneVal, id)
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
