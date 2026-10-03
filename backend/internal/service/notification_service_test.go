package service_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

type mockDeviceTokenRepo struct {
	tokens []domain.DeviceToken
}

func (m *mockDeviceTokenRepo) Save(dt *domain.DeviceToken) error {
	m.tokens = append(m.tokens, *dt)
	return nil
}

func (m *mockDeviceTokenRepo) FindByUserID(userID string) ([]domain.DeviceToken, error) {
	var result []domain.DeviceToken
	for _, t := range m.tokens {
		if t.UserID == userID {
			result = append(result, t)
		}
	}
	return result, nil
}

func (m *mockDeviceTokenRepo) Delete(userID, token string) error {
	var filtered []domain.DeviceToken
	for _, t := range m.tokens {
		if !(t.UserID == userID && t.Token == token) {
			filtered = append(filtered, t)
		}
	}
	m.tokens = filtered
	return nil
}

func TestNotificationService_RegisterDeviceToken(t *testing.T) {
	repo := &mockDeviceTokenRepo{}
	svc := service.NewNotificationService(repo)

	// Token vazio
	_, err := svc.RegisterDeviceToken("user-1", "   ", "expo")
	if err != service.ErrTokenEmpty {
		t.Fatalf("expected ErrTokenEmpty, got %v", err)
	}

	// Token válido
	dt, err := svc.RegisterDeviceToken("user-1", "ExponentPushToken[abc]", "android")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if dt.Token != "ExponentPushToken[abc]" {
		t.Errorf("expected token ExponentPushToken[abc], got %s", dt.Token)
	}
	if dt.Platform != "android" {
		t.Errorf("expected platform android, got %s", dt.Platform)
	}
}

func TestNotificationService_SendPushToUser(t *testing.T) {
	repo := &mockDeviceTokenRepo{
		tokens: []domain.DeviceToken{
			{
				ID:        "1",
				UserID:    "user-1",
				Token:     "ExponentPushToken[123]",
				Platform:  "expo",
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
		},
	}

	var receivedMessages []service.PushMessage
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		var msgs []service.PushMessage
		if err := json.NewDecoder(r.Body).Decode(&msgs); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		receivedMessages = msgs
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"data":[{"status":"ok"}]}`))
	}))
	defer ts.Close()

	svc := service.NewNotificationService(repo, ts.Client())
	svc.SetExpoAPIURL(ts.URL)

	// Enviar notificação wakeup
	count, err := svc.SendPushToUser("user-1", "Alerta Crítico", "Compromisso importante", "wakeup", map[string]interface{}{"eventId": "e-1"})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if count != 1 {
		t.Errorf("expected 1 message sent, got %d", count)
	}
	if len(receivedMessages) != 1 {
		t.Fatalf("expected 1 received message on server, got %d", len(receivedMessages))
	}
	if receivedMessages[0].ChannelID != "vito_wakeup" {
		t.Errorf("expected channel vito_wakeup, got %s", receivedMessages[0].ChannelID)
	}
	if receivedMessages[0].Priority != "high" {
		t.Errorf("expected priority high, got %s", receivedMessages[0].Priority)
	}

	// Usuário sem tokens
	countZero, err := svc.SendPushToUser("user-sem-token", "Teste", "Msg", "default", nil)
	if err != nil {
		t.Fatalf("expected nil error for user without tokens, got %v", err)
	}
	if countZero != 0 {
		t.Errorf("expected 0 messages sent, got %d", countZero)
	}
}
