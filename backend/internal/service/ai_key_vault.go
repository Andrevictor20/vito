package service

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"

	"github.com/andrevmp/vito/backend/internal/platform/crypto"
	"github.com/andrevmp/vito/backend/internal/domain"
)

const aiKeyVaultHKDFInfo = "vito-byok-ai-provider-vault-v1"

var (
	ErrVaultEmptyInput = errors.New("userID, providerKey e chave não podem ser vazios")
)

// AIKeyVault cifra e decifra chaves de API de provedores externos vinculadas ao par (userID, providerKey).
type AIKeyVault struct {
	encKey string
}

// NewAIKeyVault cria um cofre de chaves usando DATA_ENCRYPTION_KEY.
func NewAIKeyVault(encKey string) *AIKeyVault {
	return &AIKeyVault{encKey: encKey}
}

// Seal cifra uma API key usando AES-256-GCM com chave derivada via HKDF e AAD vinculada a userID:providerKey.
func (v *AIKeyVault) Seal(userID string, providerKey domain.ProviderKey, plaintext string) (string, error) {
	if strings.TrimSpace(v.encKey) == "" {
		return "", crypto.ErrInvalidKey
	}
	if strings.TrimSpace(userID) == "" || !domain.IsBYOKProviderKey(providerKey) || strings.TrimSpace(plaintext) == "" {
		return "", ErrVaultEmptyInput
	}

	aad := vaultContext(userID, providerKey)
	blockKey, err := crypto.DeriveKeyHKDF(v.encKey, aad, aiKeyVaultHKDFInfo, 32)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(blockKey)
	if err != nil {
		return "", fmt.Errorf("falha ao inicializar cifra AES do cofre: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("falha ao inicializar GCM do cofre: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("falha ao gerar nonce do cofre: %w", err)
	}

	sealed := gcm.Seal(nonce, nonce, []byte(plaintext), aad)
	return base64.RawURLEncoding.EncodeToString(sealed), nil
}

// Open decifra uma API key verificando autenticidade contra userID:providerKey.
func (v *AIKeyVault) Open(userID string, providerKey domain.ProviderKey, ciphertext string) (string, error) {
	if strings.TrimSpace(v.encKey) == "" {
		return "", crypto.ErrInvalidKey
	}
	if strings.TrimSpace(userID) == "" || !domain.IsBYOKProviderKey(providerKey) || strings.TrimSpace(ciphertext) == "" {
		return "", crypto.ErrDecryptionFailed
	}

	raw, err := base64.RawURLEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", crypto.ErrDecryptionFailed
	}

	aad := vaultContext(userID, providerKey)
	blockKey, err := crypto.DeriveKeyHKDF(v.encKey, aad, aiKeyVaultHKDFInfo, 32)
	if err != nil {
		return "", crypto.ErrDecryptionFailed
	}

	block, err := aes.NewCipher(blockKey)
	if err != nil {
		return "", crypto.ErrDecryptionFailed
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", crypto.ErrDecryptionFailed
	}

	nonceSize := gcm.NonceSize()
	if len(raw) < nonceSize {
		return "", crypto.ErrDecryptionFailed
	}

	nonce, payload := raw[:nonceSize], raw[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, payload, aad)
	if err != nil {
		return "", crypto.ErrDecryptionFailed
	}
	return string(plaintext), nil
}

func vaultContext(userID string, providerKey domain.ProviderKey) []byte {
	return []byte(userID + ":" + string(providerKey))
}

// Last4 retorna os últimos 4 caracteres visíveis da chave para exibição segura na UI.
func Last4(apiKey string) string {
	trimmed := strings.TrimSpace(apiKey)
	if len(trimmed) <= 4 {
		return trimmed
	}
	return trimmed[len(trimmed)-4:]
}

type providerValidationMeta struct {
	displayName string
	prefix      string
}

var providerValidationCatalog = map[domain.ProviderKey]providerValidationMeta{
	domain.ProviderKeyAnthropic:  {displayName: "Claude", prefix: "sk-ant-"},
	domain.ProviderKeyGoogle:     {displayName: "Gemini", prefix: "AIza"},
	domain.ProviderKeyOpenAI:     {displayName: "OpenAI", prefix: "sk-"},
	domain.ProviderKeyGroq:       {displayName: "Groq", prefix: "gsk_"},
	domain.ProviderKeyOpenRouter: {displayName: "OpenRouter", prefix: "sk-or-"},
}

// ValidateProviderKeyFormat valida campos vazios, URL do endpoint custom e prefixos de chave (§2).
func ValidateProviderKeyFormat(providerKey domain.ProviderKey, apiKey, baseURL string) error {
	if !domain.IsBYOKProviderKey(providerKey) {
		return domain.ErrInvalidProviderKey
	}

	trimmedKey := strings.TrimSpace(apiKey)
	trimmedURL := strings.TrimSpace(baseURL)

	if providerKey == domain.ProviderKeyCustom {
		if trimmedURL == "" || trimmedKey == "" {
			return errors.New("Preencha o endereço e a chave.")
		}
		lowerURL := strings.ToLower(trimmedURL)
		if !strings.HasPrefix(lowerURL, "http://") && !strings.HasPrefix(lowerURL, "https://") {
			return errors.New("O endereço precisa começar com http:// ou https://.")
		}
		parsed, err := url.Parse(trimmedURL)
		if err != nil || parsed.Host == "" {
			return errors.New("O endereço precisa começar com http:// ou https://.")
		}
		return nil
	}

	if trimmedKey == "" {
		return errors.New("Preencha a chave.")
	}

	if providerKey == domain.ProviderKeyOpenAI {
		if strings.HasPrefix(trimmedKey, "sk-ant-") || strings.HasPrefix(trimmedKey, "sk-or-") {
			return errors.New("Esta chave parece ser de outro provedor.")
		}
	}

	meta, ok := providerValidationCatalog[providerKey]
	if ok && !strings.HasPrefix(trimmedKey, meta.prefix) {
		return fmt.Errorf("Esta chave não parece ser do %s. Ela deve começar com %s.", meta.displayName, meta.prefix)
	}
	return nil
}
