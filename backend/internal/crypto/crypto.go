package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
)

var (
	ErrDecryptionFailed = errors.New("falha na descriptografia: dados corrompidos ou chave inválida")
	ErrInvalidKey       = errors.New("chave de criptografia inválida")
)

// deriveKey gera uma chave de 32 bytes (AES-256) a partir de qualquer string informada.
func deriveKey(key string) []byte {
	hash := sha256.Sum256([]byte(key))
	return hash[:]
}

// Encrypt cifra uma string em texto plano usando AES-256-GCM e retorna uma string codificada em Base64 URL-safe.
func Encrypt(plaintext, key string) (string, error) {
	if key == "" {
		return "", ErrInvalidKey
	}

	blockKey := deriveKey(key)
	block, err := aes.NewCipher(blockKey)
	if err != nil {
		return "", fmt.Errorf("falha ao inicializar cifra AES: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("falha ao inicializar modo GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("falha ao gerar nonce aleatório: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.RawURLEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decifra uma string Base64 cifrada com Encrypt usando AES-256-GCM.
func Decrypt(ciphertextBase64, key string) (string, error) {
	if key == "" {
		return "", ErrInvalidKey
	}

	rawCiphertext, err := base64.RawURLEncoding.DecodeString(ciphertextBase64)
	if err != nil {
		return "", ErrDecryptionFailed
	}

	blockKey := deriveKey(key)
	block, err := aes.NewCipher(blockKey)
	if err != nil {
		return "", fmt.Errorf("falha ao inicializar cifra AES: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("falha ao inicializar modo GCM: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(rawCiphertext) < nonceSize {
		return "", ErrDecryptionFailed
	}

	nonce, actualCiphertext := rawCiphertext[:nonceSize], rawCiphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, actualCiphertext, nil)
	if err != nil {
		return "", ErrDecryptionFailed
	}

	return string(plaintext), nil
}
