package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/crypto"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func setupGmailHandlerTest(t *testing.T) (*handler.GmailHandler, *repository.GmailRepositorySQLite, *service.GmailService, string) {
	tmpDir := t.TempDir()
	db, err := database.Open(filepath.Join(tmpDir, "test_gmail_handler.db"))
	if err != nil {
		t.Fatalf("falha ao abrir test db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	userRepo := repository.NewUserRepository(db)
	user := &domain.User{
		ID:           "user-gh-1",
		Name:         "User Gmail Handler",
		Email:        "usergh@example.com",
		PasswordHash: "secret",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("falha ao criar user: %v", err)
	}

	encKey := "test-enc-key-32-chars-long-12345"
	repo := repository.NewGmailRepository(db)
	svc := service.NewGmailService(repo, encKey, "cid", "csec")
	h := handler.NewGmailHandler(svc)

	return h, repo, svc, user.ID
}

func TestGmailHandler_GetStatusAndDisconnect(t *testing.T) {
	h, repo, _, userID := setupGmailHandlerTest(t)

	// 1. GetStatus desconectado
	req := httptest.NewRequest(http.MethodGet, "/api/v1/integrations/gmail/status", nil)
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.GetStatus(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("esperava status 200, obteve %d", w.Code)
	}

	var resp struct {
		Data service.GmailStatusResponse `json:"data"`
	}
	_ = json.NewDecoder(w.Body).Decode(&resp)
	if resp.Data.Connected {
		t.Error("esperava connected = false")
	}

	// 2. Conecta
	_ = repo.Upsert(context.Background(), &domain.GmailIntegration{
		ID:                   "g-1",
		UserID:               userID,
		AccountEmail:         "andre@gmail.com",
		EncryptedCredentials: "enc",
		Status:               domain.GmailStatusActive,
	})

	w2 := httptest.NewRecorder()
	h.GetStatus(w2, req)
	_ = json.NewDecoder(w2.Body).Decode(&resp)
	if !resp.Data.Connected || resp.Data.AccountEmail != "andre@gmail.com" {
		t.Errorf("status inesperado: %+v", resp.Data)
	}

	// 3. Disconnect
	reqDel := httptest.NewRequest(http.MethodDelete, "/api/v1/integrations/gmail/disconnect", nil).WithContext(ctx)
	wDel := httptest.NewRecorder()
	h.Disconnect(wDel, reqDel)

	if wDel.Code != http.StatusOK {
		t.Fatalf("esperava status 200 no disconnect, obteve %d", wDel.Code)
	}

	w3 := httptest.NewRecorder()
	h.GetStatus(w3, req)
	_ = json.NewDecoder(w3.Body).Decode(&resp)
	if resp.Data.Connected {
		t.Error("esperava desconectado após delete")
	}
}

func TestGmailHandler_ScanEmails(t *testing.T) {
	h, repo, svc, userID := setupGmailHandlerTest(t)

	// Mock do servidor Gmail API
	mockGmail := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/gmail/v1/users/me/messages":
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"messages": []map[string]string{
					{"id": "msg-1"},
				},
			})
		case "/gmail/v1/users/me/messages/msg-1":
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"id":      "msg-1",
				"snippet": "Sua fatura de R$ 120,50 vence em 28/10/2026. Linha digitável: 12345678901234567890123456789012345678901234",
				"payload": map[string]interface{}{
					"headers": []map[string]string{
						{"name": "Subject", "value": "Fatura do Cartão"},
						{"name": "From", "value": "Banco Inter <fatura@bancointer.com.br>"},
					},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer mockGmail.Close()

	svc.SetBaseURL(mockGmail.URL)

	credsPayload, _ := json.Marshal(map[string]interface{}{
		"access_token": "valid-token",
	})
	encKey := "test-enc-key-32-chars-long-12345"
	encCreds, _ := crypto.Encrypt(string(credsPayload), encKey)

	_ = repo.Upsert(context.Background(), &domain.GmailIntegration{
		ID:                   "g-scan",
		UserID:               userID,
		AccountEmail:         "andre@gmail.com",
		EncryptedCredentials: encCreds,
		Status:               domain.GmailStatusActive,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/integrations/gmail/scan", nil)
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.ScanEmails(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("esperava status 200, obteve %d (%s)", w.Code, w.Body.String())
	}

	var resp struct {
		Data domain.GmailScanResult `json:"data"`
	}
	_ = json.NewDecoder(w.Body).Decode(&resp)

	if resp.Data.MessagesRead != 1 {
		t.Errorf("esperava 1 mensagem lida, obteve %d", resp.Data.MessagesRead)
	}
	if len(resp.Data.Bills) != 1 {
		t.Fatalf("esperava 1 boleto identificado, obteve %d", len(resp.Data.Bills))
	}
	if resp.Data.Bills[0].AmountBRL != 120.50 {
		t.Errorf("valor esperado 120.50, obteve %.2f", resp.Data.Bills[0].AmountBRL)
	}
}

func TestGmailHandler_CreateDraft(t *testing.T) {
	h, repo, svc, userID := setupGmailHandlerTest(t)

	mockGmail := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"id": "draft-12345",
		})
	}))
	defer mockGmail.Close()

	svc.SetBaseURL(mockGmail.URL)

	credsPayload, _ := json.Marshal(map[string]interface{}{
		"access_token": "valid-token",
	})
	encKey := "test-enc-key-32-chars-long-12345"
	encCreds, _ := crypto.Encrypt(string(credsPayload), encKey)

	_ = repo.Upsert(context.Background(), &domain.GmailIntegration{
		ID:                   "g-draft",
		UserID:               userID,
		AccountEmail:         "andre@gmail.com",
		EncryptedCredentials: encCreds,
		Status:               domain.GmailStatusActive,
	})

	bodyJSON := `{"to": "dest@example.com", "subject": "Teste Rascunho", "body": "Olá mundo"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/integrations/gmail/draft", bytes.NewBufferString(bodyJSON))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.CreateDraft(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("esperava status 200, obteve %d (%s)", w.Code, w.Body.String())
	}

	var resp struct {
		Data map[string]string `json:"data"`
	}
	_ = json.NewDecoder(w.Body).Decode(&resp)
	if resp.Data["draft_id"] != "draft-12345" {
		t.Errorf("draft_id esperado 'draft-12345', obteve '%s'", resp.Data["draft_id"])
	}
}
