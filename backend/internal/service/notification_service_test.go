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

	// Enviar notificação urgente
	count, err := svc.SendPushToUser("user-1", "Alerta Urgente", "Compromisso importante", "urgent", map[string]interface{}{"eventId": "e-1"})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if count != 1 {
		t.Errorf("expected 1 message sent, got %d", count)
	}
	if len(receivedMessages) != 1 {
		t.Fatalf("expected 1 received message on server, got %d", len(receivedMessages))
	}
	if receivedMessages[0].ChannelID != "vito_urgent" {
		t.Errorf("expected channel vito_urgent, got %s", receivedMessages[0].ChannelID)
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

func TestNotificationService_SendPushToUser_PrunesInvalidTokens(t *testing.T) {
	staleToken := "ExponentPushToken[stale-123]"
	repo := &mockDeviceTokenRepo{
		tokens: []domain.DeviceToken{
			{
				ID:       "dt-1",
				UserID:   "user-stale",
				Token:    staleToken,
				Platform: "android",
			},
		},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"data": [
				{
					"status": "error",
					"message": "DeviceNotRegistered",
					"details": {
						"error": "DeviceNotRegistered"
					}
				}
			]
		}`))
	}))
	defer ts.Close()

	svc := service.NewNotificationService(repo, ts.Client())
	svc.SetExpoAPIURL(ts.URL)

	count, err := svc.SendPushToUser("user-stale", "Teste", "Mensagem", "high", map[string]interface{}{"type": "meeting_vote"})
	if err != nil {
		t.Fatalf("não esperava erro HTTP: %v", err)
	}
	if count != 1 {
		t.Errorf("esperava 1 tentativa despachada, obteve %d", count)
	}

	// Verifica se o token inválido foi removido do repositório
	tokens, _ := repo.FindByUserID("user-stale")
	if len(tokens) != 0 {
		t.Errorf("esperava que token 'DeviceNotRegistered' fosse removido do repositório, mas ainda existem %d tokens", len(tokens))
	}
}

func TestNotificationService_DomainChannelsSubtitlesAndCategories(t *testing.T) {
	repo := &mockDeviceTokenRepo{
		tokens: []domain.DeviceToken{
			{ID: "dt-v5", UserID: "user-v5", Token: "ExponentPushToken[v5-test]", Platform: "android"},
		},
	}

	var last []service.PushMessage
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var msgs []service.PushMessage
		_ = json.NewDecoder(r.Body).Decode(&msgs)
		last = msgs
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"data":[{"status":"ok"}]}`))
	}))
	defer ts.Close()

	svc := service.NewNotificationService(repo, ts.Client())
	svc.SetExpoAPIURL(ts.URL)

	cases := []struct {
		name     string
		dataType string
		wantChan string
		wantSub  string
		wantCat  string
	}{
		{"bots", "bot_alert", "vito_bots", "Bots", "vito_bot"},
		{"finance", "finance_alert", "vito_finance", "Finanças", "vito_finance"},
		{"events", "event_reminder", "vito_events", "Agenda", "vito_event"},
		{"todos", "todo_due", "vito_todos", "Tarefas", "vito_todo"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := svc.SendPushToUser("user-v5", "Título", "Corpo", "default", map[string]interface{}{"type": tc.dataType})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(last) != 1 {
				t.Fatalf("expected 1 push, got %d", len(last))
			}
			if last[0].ChannelID != tc.wantChan {
				t.Errorf("channelId = %q, want %q", last[0].ChannelID, tc.wantChan)
			}
			if last[0].Subtitle != tc.wantSub {
				t.Errorf("subtitle = %q, want %q", last[0].Subtitle, tc.wantSub)
			}
			if last[0].CategoryID != tc.wantCat {
				t.Errorf("categoryId = %q, want %q", last[0].CategoryID, tc.wantCat)
			}
		})
	}
}
