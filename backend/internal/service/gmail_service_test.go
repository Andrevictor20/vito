package service_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/crypto"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

type MockGmailRepoForService struct {
	integration *domain.GmailIntegration
}

func (m *MockGmailRepoForService) GetByUserID(ctx context.Context, userID string) (*domain.GmailIntegration, error) {
	if m.integration == nil || m.integration.UserID != userID {
		return nil, domain.ErrGmailNotConnected
	}
	return m.integration, nil
}

func (m *MockGmailRepoForService) Upsert(ctx context.Context, integ *domain.GmailIntegration) error {
	m.integration = integ
	return nil
}

func (m *MockGmailRepoForService) UpdateStatus(ctx context.Context, userID, status string) error {
	if m.integration != nil && m.integration.UserID == userID {
		m.integration.Status = status
		return nil
	}
	return domain.ErrGmailNotConnected
}

func (m *MockGmailRepoForService) UpdateLastScanned(ctx context.Context, userID, historyID string, scannedAt time.Time) error {
	if m.integration != nil && m.integration.UserID == userID {
		m.integration.HistoryID = historyID
		m.integration.LastScannedAt = &scannedAt
		return nil
	}
	return domain.ErrGmailNotConnected
}

func (m *MockGmailRepoForService) DeleteByUserID(ctx context.Context, userID string) error {
	m.integration = nil
	return nil
}

func TestGmailService_GetStatusAndDisconnect(t *testing.T) {
	encKey := "test-enc-key-32-chars-long-12345"
	repo := &MockGmailRepoForService{}
	svc := service.NewGmailService(repo, encKey, "client-id", "client-secret")

	ctx := context.Background()
	userID := "user-123"

	// 1. Desconectado
	status, err := svc.GetStatus(ctx, userID)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if status.Connected {
		t.Error("esperava Connected = false")
	}

	// 2. Conectado
	credsPayload, _ := json.Marshal(map[string]interface{}{
		"access_token":  "access-tok-1",
		"refresh_token": "refresh-tok-1",
		"expires_in":    3600,
	})
	encCreds, _ := crypto.Encrypt(string(credsPayload), encKey)
	now := time.Now().UTC()
	repo.integration = &domain.GmailIntegration{
		ID:                   "int-1",
		UserID:               userID,
		AccountEmail:         "andre@gmail.com",
		EncryptedCredentials: encCreds,
		Status:               domain.GmailStatusActive,
		LastScannedAt:        &now,
	}

	status, err = svc.GetStatus(ctx, userID)
	if err != nil {
		t.Fatalf("falha ao obter status: %v", err)
	}
	if !status.Connected || status.AccountEmail != "andre@gmail.com" || status.Status != domain.GmailStatusActive {
		t.Errorf("status retornado divergente: %+v", status)
	}

	// 3. Desconectar
	if err := svc.Disconnect(ctx, userID); err != nil {
		t.Fatalf("falha ao desconectar: %v", err)
	}
	status, _ = svc.GetStatus(ctx, userID)
	if status.Connected {
		t.Error("esperava desconectado após Disconnect")
	}
}

func TestGmailService_ScanEmails_ParsesBillsAndFlights(t *testing.T) {
	encKey := "test-enc-key-32-chars-long-12345"
	repo := &MockGmailRepoForService{}

	// Mock server simulando a API REST do Gmail
	gmailServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/gmail/v1/users/me/messages":
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"messages": []map[string]string{
					{"id": "msg-bill-1", "threadId": "th-1"},
					{"id": "msg-flight-1", "threadId": "th-2"},
				},
				"resultSizeEstimate": 2,
			})
		case "/gmail/v1/users/me/messages/msg-bill-1":
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"id":      "msg-bill-1",
				"snippet": "Sua fatura Nubank fechou no valor de R$ 450,20 com vencimento em 25/10/2026. Linha digitável: 26091.12345 00000.123456 78900.123456 1 98760000045020",
				"payload": map[string]interface{}{
					"headers": []map[string]string{
						{"name": "Subject", "value": "Sua fatura Nubank fechou"},
						{"name": "From", "value": "Nubank <fatura@nubank.com.br>"},
						{"name": "Date", "value": "Fri, 17 Oct 2026 14:00:00 -0300"},
					},
				},
			})
		case "/gmail/v1/users/me/messages/msg-flight-1":
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"id":      "msg-flight-1",
				"snippet": "Confirmação de reserva de voo LATAM LA3456. Localizador: XYZ123. Partida: GRU para SDU no dia 22/10/2026 às 10:30.",
				"payload": map[string]interface{}{
					"headers": []map[string]string{
						{"name": "Subject", "value": "Confirmação de Reserva - Voo LA3456"},
						{"name": "From", "value": "LATAM Airlines <reserva@latam.com>"},
						{"name": "Date", "value": "Fri, 17 Oct 2026 15:30:00 -0300"},
					},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer gmailServer.Close()

	svc := service.NewGmailService(repo, encKey, "client-id", "client-secret")
	svc.SetBaseURL(gmailServer.URL)

	credsPayload, _ := json.Marshal(map[string]interface{}{
		"access_token":  "valid-mock-token",
		"refresh_token": "valid-mock-refresh",
		"expires_in":    3600,
	})
	encCreds, _ := crypto.Encrypt(string(credsPayload), encKey)
	userID := "user-scan-1"
	repo.integration = &domain.GmailIntegration{
		ID:                   "int-scan-1",
		UserID:               userID,
		AccountEmail:         "usuario@gmail.com",
		EncryptedCredentials: encCreds,
		Status:               domain.GmailStatusActive,
	}

	result, err := svc.ScanEmails(context.Background(), userID)
	if err != nil {
		t.Fatalf("falha no ScanEmails: %v", err)
	}

	if result.MessagesRead != 2 {
		t.Errorf("esperava 2 mensagens lidas, obteve %d", result.MessagesRead)
	}

	// Valida Boleto / Fatura
	if len(result.Bills) != 1 {
		t.Fatalf("esperava 1 fatura identificada, obteve %d", len(result.Bills))
	}
	bill := result.Bills[0]
	if bill.AmountBRL != 450.20 {
		t.Errorf("valor da fatura esperado 450.20, obteve %.2f", bill.AmountBRL)
	}
	if bill.Barcode == "" {
		t.Error("esperava linha digitável extraída do boleto")
	}

	// Valida Voo
	if len(result.Flights) != 1 {
		t.Fatalf("esperava 1 voo identificado, obteve %d", len(result.Flights))
	}
	flight := result.Flights[0]
	if flight.BookingCode != "XYZ123" {
		t.Errorf("código localizador esperado 'XYZ123', obteve '%s'", flight.BookingCode)
	}
	if flight.Origin != "GRU" || flight.Destination != "SDU" {
		t.Errorf("rota esperada GRU -> SDU, obteve %s -> %s", flight.Origin, flight.Destination)
	}

	// Valida E-mails Urgentes
	if len(result.UrgentEmails) != 2 {
		t.Errorf("esperava 2 e-mails na lista urgente, obteve %d", len(result.UrgentEmails))
	}
}

func TestGmailService_BuildGmailQuery(t *testing.T) {
	tests := []struct {
		name     string
		opts     service.ScanOptions
		expected string
	}{
		{
			name:     "Padrão vazio vai para Caixa Principal",
			opts:     service.ScanOptions{},
			expected: "in:inbox category:primary",
		},
		{
			name:     "Pasta primária explícita",
			opts:     service.ScanOptions{Folder: "primary"},
			expected: "in:inbox category:primary",
		},
		{
			name:     "Caixa Principal com não lidos apenas",
			opts:     service.ScanOptions{Folder: "primary", UnreadOnly: true},
			expected: "in:inbox category:primary is:unread",
		},
		{
			name:     "Pasta Spam explicitamente solicitada",
			opts:     service.ScanOptions{Folder: "spam"},
			expected: "in:spam",
		},
		{
			name:     "Pasta Lixeira explicitamente solicitada",
			opts:     service.ScanOptions{Folder: "lixeira"},
			expected: "in:trash",
		},
		{
			name:     "Pasta Promoções explicitamente solicitada",
			opts:     service.ScanOptions{Folder: "promoções"},
			expected: "category:promotions",
		},
		{
			name:     "Pasta Social explicitamente solicitada",
			opts:     service.ScanOptions{Folder: "social"},
			expected: "category:social",
		},
		{
			name:     "Pasta Atualizações explicitamente solicitada",
			opts:     service.ScanOptions{Folder: "atualizações"},
			expected: "category:updates",
		},
		{
			name:     "Todas as caixas",
			opts:     service.ScanOptions{Folder: "all"},
			expected: "in:anywhere -in:spam -in:trash",
		},
		{
			name:     "Query customizada tem precedência",
			opts:     service.ScanOptions{Query: "from:suporte@banco.com is:starred"},
			expected: "from:suporte@banco.com is:starred",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := service.BuildGmailQuery(tc.opts)
			if got != tc.expected {
				t.Errorf("query gerada divergente: esperava %q, obteve %q", tc.expected, got)
			}
		})
	}
}

func TestGmailService_AutoRefreshToken_Proactive(t *testing.T) {
	encKey := "test-enc-key-32-chars-long-12345"
	repo := &MockGmailRepoForService{}

	tokenHitCount := 0
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tokenHitCount++
		if err := r.ParseForm(); err != nil {
			t.Fatalf("falha ao parsear form: %v", err)
		}
		if r.Form.Get("grant_type") != "refresh_token" {
			t.Errorf("esperava grant_type=refresh_token, obteve %s", r.Form.Get("grant_type"))
		}
		if r.Form.Get("refresh_token") != "secret-refresh-123" {
			t.Errorf("refresh_token divergente: %s", r.Form.Get("refresh_token"))
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"access_token": "fresh-access-token-999",
			"expires_in":   3600,
		})
	}))
	defer tokenServer.Close()

	svc := service.NewGmailService(repo, encKey, "client-id", "client-secret")
	svc.SetTokenURL(tokenServer.URL)

	// Token expirado há 2 horas
	expiredUpdatedAt := time.Now().Unix() - 7200
	credsPayload, _ := json.Marshal(map[string]interface{}{
		"access_token":  "stale-access-token",
		"refresh_token": "secret-refresh-123",
		"expires_in":    3600,
		"updated_at":    expiredUpdatedAt,
	})
	encCreds, _ := crypto.Encrypt(string(credsPayload), encKey)
	userID := "user-token-refresh"
	repo.integration = &domain.GmailIntegration{
		ID:                   "int-refresh-1",
		UserID:               userID,
		AccountEmail:         "andre@gmail.com",
		EncryptedCredentials: encCreds,
		Status:               domain.GmailStatusActive,
	}

	tok, err := svc.GetValidAccessToken(context.Background(), userID)
	if err != nil {
		t.Fatalf("GetValidAccessToken falhou: %v", err)
	}

	if tok != "fresh-access-token-999" {
		t.Errorf("esperava novo token renovado 'fresh-access-token-999', obteve %q", tok)
	}
	if tokenHitCount != 1 {
		t.Errorf("esperava 1 chamada ao token endpoint, obteve %d", tokenHitCount)
	}

	// Verifica se persistiu as credenciais atualizadas no repositório
	decrypted, _ := crypto.Decrypt(repo.integration.EncryptedCredentials, encKey)
	var stored map[string]interface{}
	_ = json.Unmarshal([]byte(decrypted), &stored)
	if stored["access_token"] != "fresh-access-token-999" {
		t.Errorf("access_token não foi persistido no banco: %+v", stored)
	}
	if stored["refresh_token"] != "secret-refresh-123" {
		t.Errorf("refresh_token foi perdido após renovação: %+v", stored)
	}
}

func TestGmailService_AutoRefreshToken_Reactive401(t *testing.T) {
	encKey := "test-enc-key-32-chars-long-12345"
	repo := &MockGmailRepoForService{}

	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"access_token": "fresh-token-after-401",
			"expires_in":   3600,
		})
	}))
	defer tokenServer.Close()

	gmailHits := 0
	gmailServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gmailHits++
		authHeader := r.Header.Get("Authorization")
		if authHeader != "Bearer fresh-token-after-401" {
			// Simula token rejeitado pelo Google na 1ª tentativa
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":{"code":401,"message":"Invalid Credentials"}}`))
			return
		}

		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/gmail/v1/users/me/messages" {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"messages": []map[string]string{
					{"id": "msg-reactive-1"},
				},
			})
			return
		}
		if r.URL.Path == "/gmail/v1/users/me/messages/msg-reactive-1" {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"id":       "msg-reactive-1",
				"snippet":  "Reunião de alinhamento amanhã",
				"labelIds": []string{"INBOX", "UNREAD", "CATEGORY_PERSONAL"},
				"payload": map[string]interface{}{
					"headers": []map[string]string{
						{"name": "Subject", "value": "Alinhamento"},
						{"name": "From", "value": "chefe@empresa.com"},
						{"name": "Date", "value": "Sat, 18 Oct 2026 10:00:00 -0300"},
					},
				},
			})
			return
		}
		http.NotFound(w, r)
	}))
	defer gmailServer.Close()

	svc := service.NewGmailService(repo, encKey, "client-id", "client-secret")
	svc.SetBaseURL(gmailServer.URL)
	svc.SetTokenURL(tokenServer.URL)

	credsPayload, _ := json.Marshal(map[string]interface{}{
		"access_token":  "token-that-google-revoked",
		"refresh_token": "valid-refresh-for-retry",
		"expires_in":    3600,
		"updated_at":    time.Now().Unix(), // parece válido localmente mas Google rejeitou
	})
	encCreds, _ := crypto.Encrypt(string(credsPayload), encKey)
	userID := "user-reactive-401"
	repo.integration = &domain.GmailIntegration{
		ID:                   "int-reactive-1",
		UserID:               userID,
		AccountEmail:         "andre@gmail.com",
		EncryptedCredentials: encCreds,
		Status:               domain.GmailStatusActive,
	}

	result, err := svc.ScanEmails(context.Background(), userID)
	if err != nil {
		t.Fatalf("ScanEmails falhou mesmo com token refresh disponível: %v", err)
	}

	if result.MessagesRead != 1 {
		t.Errorf("esperava 1 mensagem lida, obteve %d", result.MessagesRead)
	}
	if len(result.UrgentEmails) != 1 || !result.UrgentEmails[0].IsUnread {
		t.Errorf("esperava mensagem com IsUnread = true, obteve %+v", result.UrgentEmails)
	}
	if repo.integration.Status != domain.GmailStatusActive {
		t.Errorf("esperava status active após recuperação, obteve %s", repo.integration.Status)
	}
}

