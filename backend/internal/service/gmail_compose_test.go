package service_test

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/crypto"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

func TestGmailService_SendEmail_SuccessAndReactive401(t *testing.T) {
	encKey := "test-enc-key-32-chars-long-12345"
	repo := &MockGmailRepoForService{}

	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"access_token": "fresh-send-token",
			"expires_in":   3600,
		})
	}))
	defer tokenServer.Close()

	var receivedRaw string
	gmailServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/gmail/v1/users/me/messages/send" || r.Method != http.MethodPost {
			http.NotFound(w, r)
			return
		}
		if r.Header.Get("Authorization") != "Bearer fresh-send-token" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		var body struct {
			Raw string `json:"raw"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		receivedRaw = body.Raw

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"id": "sent-msg-999",
		})
	}))
	defer gmailServer.Close()

	svc := service.NewGmailService(repo, encKey, "client-id", "client-secret")
	svc.SetBaseURL(gmailServer.URL)
	svc.SetTokenURL(tokenServer.URL)

	credsPayload, _ := json.Marshal(map[string]interface{}{
		"access_token":  "revoked-token",
		"refresh_token": "valid-refresh",
		"expires_in":    3600,
		"updated_at":    time.Now().Unix(),
	})
	encCreds, _ := crypto.Encrypt(string(credsPayload), encKey)
	userID := "user-send-1"
	repo.integration = &domain.GmailIntegration{
		ID:                   "int-send-1",
		UserID:               userID,
		AccountEmail:         "andre@gmail.com",
		EncryptedCredentials: encCreds,
		Status:               domain.GmailStatusActive,
	}

	// Validação de destinatário inválido
	if _, err := svc.SendEmail(context.Background(), userID, "invalido", "Assunto", "Corpo"); err == nil {
		t.Fatal("esperava erro para destinatário sem @")
	}

	// Envio com recuperação reativa 401
	msgID, err := svc.SendEmail(context.Background(), userID, "cliente@empresa.com", "Proposta Comercial", "Segue proposta em anexo.")
	if err != nil {
		t.Fatalf("SendEmail falhou: %v", err)
	}
	if msgID != "sent-msg-999" {
		t.Errorf("esperava id 'sent-msg-999', obteve %q", msgID)
	}

	decodedBytes, err := base64.URLEncoding.DecodeString(receivedRaw)
	if err != nil {
		t.Fatalf("falha ao decodificar payload raw base64: %v", err)
	}
	decodedStr := string(decodedBytes)
	if !strings.Contains(decodedStr, "To: cliente@empresa.com") || !strings.Contains(decodedStr, "Segue proposta em anexo.") {
		t.Errorf("MIME decodificado inesperado: %s", decodedStr)
	}
}
