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

// User representa a entidade de usuário no Kito.
type User struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// UserRepository define o contrato de persistência para usuários.
type UserRepository interface {
	Create(user *User) error
	GetByID(id string) (*User, error)
	GetByEmail(email string) (*User, error)
}
