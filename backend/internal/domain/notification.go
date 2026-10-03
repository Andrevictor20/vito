package domain

import (
	"errors"
	"time"
)

var (
	ErrDeviceTokenInvalid = errors.New("token de dispositivo inválido")
)

// DeviceToken armazena tokens push vinculados a um usuário.
type DeviceToken struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Token     string    `json:"token"`
	Platform  string    `json:"platform"` // "expo", "ios", "android"
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// DeviceTokenRepository define as operações de persistência de tokens push.
type DeviceTokenRepository interface {
	Save(dt *DeviceToken) error
	FindByUserID(userID string) ([]DeviceToken, error)
	Delete(userID, token string) error
}
