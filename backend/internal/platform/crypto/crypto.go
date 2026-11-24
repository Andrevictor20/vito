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

	"golang.org/x/crypto/hkdf"
)

var (
	ErrDecryptionFailed = errors.New("falha na descriptografia: dados corrompidos ou chave inválida")
	ErrInvalidKey       = errors.New("chave de criptografia inválida")
)

const hkdfInfoString = "vito-aes-256-gcm-data-encryption"

// deriveKey gera uma chave de 32 bytes (AES-256) usando HKDF-SHA256 (RFC 5869).
func deriveKey(key string) ([]byte, error) {
	if key == "" {
		return nil, ErrInvalidKey
	}
	kdf := hkdf.New(sha256.New, []byte(key), nil, []byte(hkdfInfoString))
	out := make([]byte, 32)
	if _, err := io.ReadFull(kdf, out); err != nil {
		return nil, fmt.Errorf("falha ao derivar chave HKDF: %w", err)
	}
	return out, nil
}

// deriveLegacyKey gera a chave legada de 32 bytes via SHA-256 direto (para migração sem downtime).
func deriveLegacyKey(key string) []byte {
	hash := sha256.Sum256([]byte(key))
	return hash[:]
}

// DeriveKeyHKDF deriva explicitamente uma chave de comprimento arbitrário usando HKDF-SHA256 (RFC 5869).
func DeriveKeyHKDF(secret string, salt []byte, info string, length int) ([]byte, error) {
	if secret == "" {
		return nil, ErrInvalidKey
	}
	if length <= 0 {
		length = 32
	}
	kdf := hkdf.New(sha256.New, []byte(secret), salt, []byte(info))
	out := make([]byte, length)
	if _, err := io.ReadFull(kdf, out); err != nil {
		return nil, fmt.Errorf("falha ao derivar chave HKDF: %w", err)
	}
	return out, nil
}

// Encrypt cifra uma string em texto plano usando AES-256-GCM e chave derivada via HKDF-SHA256.
func Encrypt(plaintext, key string) (string, error) {
	if key == "" {
		return "", ErrInvalidKey
	}

	blockKey, err := deriveKey(key)
	if err != nil {
		return "", err
	}

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

// Decrypt decifra uma string Base64 cifrada com Encrypt usando AES-256-GCM (suporta HKDF e fallback transparente legado).
func Decrypt(ciphertextBase64, key string) (string, error) {
	if key == "" {
		return "", ErrInvalidKey
	}

	rawCiphertext, err := base64.RawURLEncoding.DecodeString(ciphertextBase64)
	if err != nil {
		return "", ErrDecryptionFailed
	}

	// 1. Tenta decifrar com a chave HKDF-SHA256 moderna
	blockKey, err := deriveKey(key)
	if err == nil {
		if pt, decErr := decryptWithKey(rawCiphertext, blockKey); decErr == nil {
			return pt, nil
		}
	}

	// 2. Fallback resiliente para chave legada SHA-256 direta (garante zero perda de dados de credenciais existentes)
	legacyBlockKey := deriveLegacyKey(key)
	if pt, decErr := decryptWithKey(rawCiphertext, legacyBlockKey); decErr == nil {
		return pt, nil
	}

	return "", ErrDecryptionFailed
}

func decryptWithKey(rawCiphertext, blockKey []byte) (string, error) {
	block, err := aes.NewCipher(blockKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
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
