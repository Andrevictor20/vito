package crypto_test

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"io"
	"testing"

	"github.com/andrevmp/vito/backend/internal/crypto"
)

func TestEncryptDecrypt_Success(t *testing.T) {
	key := "secret-master-key-vito-secure-32b"
	plaintext := "google_refresh_token_1234567890_abcdef"

	ciphertext, err := crypto.Encrypt(plaintext, key)
	if err != nil {
		t.Fatalf("falha ao criptografar: %v", err)
	}

	if ciphertext == plaintext {
		t.Fatalf("ciphertext não deve ser igual ao plaintext")
	}

	decrypted, err := crypto.Decrypt(ciphertext, key)
	if err != nil {
		t.Fatalf("falha ao descriptografar: %v", err)
	}

	if decrypted != plaintext {
		t.Fatalf("esperado %q, obtido %q", plaintext, decrypted)
	}
}

func TestEncrypt_UniqueCiphertextEachCall(t *testing.T) {
	key := "my-secret-key-that-is-32-bytes!!"
	plaintext := "apple_app_specific_password_xyz"

	c1, err1 := crypto.Encrypt(plaintext, key)
	c2, err2 := crypto.Encrypt(plaintext, key)

	if err1 != nil || err2 != nil {
		t.Fatalf("erros na criptografia: %v, %v", err1, err2)
	}

	if c1 == c2 {
		t.Fatalf("cifra deve usar nonce aleatório e gerar resultados diferentes a cada chamada")
	}
}

func TestDecrypt_TamperedCiphertextFails(t *testing.T) {
	key := "encryption-key-for-calendar-sync"
	plaintext := "token_sensitive_payload"

	ciphertext, err := crypto.Encrypt(plaintext, key)
	if err != nil {
		t.Fatalf("falha ao criptografar: %v", err)
	}

	lastChar := ciphertext[len(ciphertext)-1]
	replacement := "X"
	if lastChar == 'X' {
		replacement = "Y"
	}
	tampered := ciphertext[:len(ciphertext)-1] + replacement

	_, err = crypto.Decrypt(tampered, key)
	if err == nil {
		t.Fatalf("esperava erro ao descriptografar ciphertext adulterado, mas obteve nil")
	}
}

func TestDecrypt_WrongKeyFails(t *testing.T) {
	key1 := "key-number-one-must-be-secure-32"
	key2 := "key-number-two-must-be-secure-32"
	plaintext := "some_payload"

	ciphertext, err := crypto.Encrypt(plaintext, key1)
	if err != nil {
		t.Fatalf("falha ao criptografar: %v", err)
	}

	_, err = crypto.Decrypt(ciphertext, key2)
	if err == nil {
		t.Fatalf("esperava erro ao descriptografar com chave diferente, mas obteve nil")
	}
}

func TestEncryptDecrypt_EmptyPlaintext(t *testing.T) {
	key := "test-key-32-bytes-long-string!!"
	ciphertext, err := crypto.Encrypt("", key)
	if err != nil {
		t.Fatalf("falha ao criptografar string vazia: %v", err)
	}

	decrypted, err := crypto.Decrypt(ciphertext, key)
	if err != nil {
		t.Fatalf("falha ao descriptografar string vazia: %v", err)
	}

	if decrypted != "" {
		t.Fatalf("esperava string vazia, obteve %q", decrypted)
	}
}

func TestDeriveKeyHKDF_DeterminismAndLength(t *testing.T) {
	secret := "master-secret-input-key-12345678"
	salt := []byte("vito-random-salt-16b")
	info := "vito-hkdf-test-info"

	k1, err1 := crypto.DeriveKeyHKDF(secret, salt, info, 32)
	k2, err2 := crypto.DeriveKeyHKDF(secret, salt, info, 32)

	if err1 != nil || err2 != nil {
		t.Fatalf("erros na derivação HKDF: %v, %v", err1, err2)
	}

	if len(k1) != 32 || len(k2) != 32 {
		t.Fatalf("comprimento esperado 32 bytes, obtido k1=%d, k2=%d", len(k1), len(k2))
	}

	for i := range k1 {
		if k1[i] != k2[i] {
			t.Fatalf("derivação HKDF deve ser determinística para mesma entrada")
		}
	}
}

func TestDecrypt_LegacyCiphertextCompatibility(t *testing.T) {
	// Cria cifra usando o algoritmo legado diretamente (SHA-256 puro como chave AES)
	key := "my-legacy-secret-encryption-key"
	plaintext := "token_legado_armazenado_no_banco"

	hash := sha256.Sum256([]byte(key))
	block, err := aes.NewCipher(hash[:])
	if err != nil {
		t.Fatalf("falha ao criar cifra legada: %v", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		t.Fatalf("falha ao criar GCM legado: %v", err)
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		t.Fatalf("falha ao ler nonce: %v", err)
	}
	legacyCiphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	legacyB64 := base64.RawURLEncoding.EncodeToString(legacyCiphertext)

	// crypto.Decrypt deve decifrar com sucesso mesmo sendo legado
	decrypted, err := crypto.Decrypt(legacyB64, key)
	if err != nil {
		t.Fatalf("Decrypt deve ser retrocompatível com cifras legadas: %v", err)
	}

	if decrypted != plaintext {
		t.Fatalf("esperado %q, obtido %q", plaintext, decrypted)
	}
}

