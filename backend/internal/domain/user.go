package domain

import (
	"errors"
	"time"
)

var (
	ErrUserNotFound      = errors.New("usuário não encontrado")
	ErrUserAlreadyExists = errors.New("usuário com este email já existe")
	ErrInvalidPassword   = errors.New("senha inválida")
	ErrInvalidEmail      = errors.New("email inválido")
)

// User representa a entidade de usuário no Vito.
type User struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	Phone        *string   `json:"phone,omitempty"`
	PasswordHash string    `json:"-"`
	TokenVersion int       `json:"token_version"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// UserRepository define o contrato de persistência para usuários.
type UserRepository interface {
	Create(user *User) error
	GetByID(id string) (*User, error)
	GetByEmail(email string) (*User, error)
	GetByPhone(phone string) (*User, error)
	UpdatePhone(id, phone string) error
	IncrementTokenVersion(id string) error
	ListAll() ([]User, error)
}

