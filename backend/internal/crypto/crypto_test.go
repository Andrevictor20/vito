package crypto_test

import (
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

	tampered := ciphertext[:len(ciphertext)-1] + "X"

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
