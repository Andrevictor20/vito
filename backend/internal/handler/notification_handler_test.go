package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

type mockTokenRepo struct {
	tokens []domain.DeviceToken
}

func (m *mockTokenRepo) Save(dt *domain.DeviceToken) error {
	m.tokens = append(m.tokens, *dt)
	return nil
}

func (m *mockTokenRepo) FindByUserID(userID string) ([]domain.DeviceToken, error) {
	var res []domain.DeviceToken
	for _, t := range m.tokens {
		if t.UserID == userID {
			res = append(res, t)
		}
	}
	return res, nil
}

func (m *mockTokenRepo) Delete(userID, token string) error {
	return nil
}

func TestNotificationHandler_RegisterDeviceToken(t *testing.T) {
	repo := &mockTokenRepo{}
	svc := service.NewNotificationService(repo)
	h := handler.NewNotificationHandler(svc)

	// Sem autenticação -> 401
	reqUnauth := httptest.NewRequest(http.MethodPost, "/notifications/device-token", bytes.NewBufferString(`{"token":"abc"}`))
	rrUnauth := httptest.NewRecorder()
	h.RegisterDeviceToken(rrUnauth, reqUnauth)
	if rrUnauth.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated request, got %d", rrUnauth.Code)
	}

	// Com autenticação e token válido -> 200
	body, _ := json.Marshal(map[string]string{
		"token":    "ExponentPushToken[xyz123]",
		"platform": "expo",
	})
	req := httptest.NewRequest(http.MethodPost, "/notifications/device-token", bytes.NewReader(body))
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-test-123")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	h.RegisterDeviceToken(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rr.Code, rr.Body.String())
	}

	var res map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if res["status"] != "registered" {
		t.Errorf("expected status registered, got %v", res["status"])
	}

	// Com token vazio -> 400
	reqEmpty := httptest.NewRequest(http.MethodPost, "/notifications/device-token", bytes.NewBufferString(`{"token":"   "}`))
	reqEmpty = reqEmpty.WithContext(ctx)
	rrEmpty := httptest.NewRecorder()
	h.RegisterDeviceToken(rrEmpty, reqEmpty)
	if rrEmpty.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for empty token, got %d", rrEmpty.Code)
	}
}

func TestNotificationHandler_SendTestNotification(t *testing.T) {
	repo := &mockTokenRepo{}
	svc := service.NewNotificationService(repo)
	h := handler.NewNotificationHandler(svc)

	body, _ := json.Marshal(map[string]string{
		"priority": "wakeup",
	})
	req := httptest.NewRequest(http.MethodPost, "/notifications/test", bytes.NewReader(body))
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-test-123")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	h.SendTestNotification(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestNotificationHandler_UnregisterDeviceToken(t *testing.T) {
	repo := &mockTokenRepo{}
	svc := service.NewNotificationService(repo)
	h := handler.NewNotificationHandler(svc)

	ctx := context.WithValue(context.Background(), middleware.UserIDKey, "user-test-123")

	// 1. Sucesso via JSON body
	body, _ := json.Marshal(map[string]string{
		"token": "ExponentPushToken[to-unregister-xyz]",
	})
	req := httptest.NewRequest(http.MethodDelete, "/notifications/device-token", bytes.NewReader(body))
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	h.UnregisterDeviceToken(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rr.Code, rr.Body.String())
	}

	var res map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if res["status"] != "unregistered" {
		t.Errorf("expected status unregistered, got %v", res["status"])
	}

	// 2. Não autorizado se sem userID no contexto
	reqUnauth := httptest.NewRequest(http.MethodDelete, "/notifications/device-token", bytes.NewReader(body))
	rrUnauth := httptest.NewRecorder()
	h.UnregisterDeviceToken(rrUnauth, reqUnauth)
	if rrUnauth.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", rrUnauth.Code)
	}

	// 3. Token vazio -> 400
	emptyBody, _ := json.Marshal(map[string]string{"token": "   "})
	reqEmpty := httptest.NewRequest(http.MethodDelete, "/notifications/device-token", bytes.NewReader(emptyBody))
	reqEmpty = reqEmpty.WithContext(ctx)
	rrEmpty := httptest.NewRecorder()
	h.UnregisterDeviceToken(rrEmpty, reqEmpty)
	if rrEmpty.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request, got %d", rrEmpty.Code)
	}
}

