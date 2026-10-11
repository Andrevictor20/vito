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
)

type mockBriefingRepoForHandler struct {
	settings *domain.BriefingSettings
}

func (m *mockBriefingRepoForHandler) GetSettings(userID string) (*domain.BriefingSettings, error) {
	if m.settings != nil {
		return m.settings, nil
	}
	return domain.DefaultBriefingSettings(userID), nil
}

func (m *mockBriefingRepoForHandler) UpsertSettings(s *domain.BriefingSettings) error {
	m.settings = s
	return nil
}

func (m *mockBriefingRepoForHandler) ListActiveSettings() ([]domain.BriefingSettings, error) {
	return []domain.BriefingSettings{}, nil
}

func (m *mockBriefingRepoForHandler) MarkSent(userID, dateStr string) error {
	return nil
}

func TestBriefingHandler_GetSettings(t *testing.T) {
	repo := &mockBriefingRepoForHandler{
		settings: &domain.BriefingSettings{
			UserID:           "user-456",
			Enabled:          true,
			ScheduledTime:    "07:45",
			WakeupAlarmEarly: true,
		},
	}
	h := handler.NewBriefingHandler(repo)

	req := httptest.NewRequest("GET", "/api/v1/users/briefing", nil)
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-456")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	h.GetSettings(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("esperava status 200, obteve %d", rr.Code)
	}

	var res domain.BriefingSettings
	if err := json.NewDecoder(rr.Body).Decode(&res); err != nil {
		t.Fatalf("falha ao decodificar resposta: %v", err)
	}
	if res.ScheduledTime != "07:45" {
		t.Errorf("esperava ScheduledTime 07:45, obteve %s", res.ScheduledTime)
	}
}

func TestBriefingHandler_UpdateSettings_Valid(t *testing.T) {
	repo := &mockBriefingRepoForHandler{}
	h := handler.NewBriefingHandler(repo)

	body := []byte(`{"enabled":false,"scheduled_time":"08:00","wakeup_alarm_early":false}`)
	req := httptest.NewRequest("PUT", "/api/v1/users/briefing", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-456")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	h.UpdateSettings(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("esperava status 200, obteve %d. Body: %s", rr.Code, rr.Body.String())
	}

	var res domain.BriefingSettings
	if err := json.NewDecoder(rr.Body).Decode(&res); err != nil {
		t.Fatalf("falha ao decodificar resposta: %v", err)
	}
	if res.Enabled != false {
		t.Errorf("esperava Enabled=false")
	}
	if res.ScheduledTime != "08:00" {
		t.Errorf("esperava ScheduledTime=08:00, obteve %s", res.ScheduledTime)
	}
}

func TestBriefingHandler_UpdateSettings_InvalidTime(t *testing.T) {
	repo := &mockBriefingRepoForHandler{}
	h := handler.NewBriefingHandler(repo)

	body := []byte(`{"enabled":true,"scheduled_time":"99:99"}`)
	req := httptest.NewRequest("PUT", "/api/v1/users/briefing", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-456")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	h.UpdateSettings(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("esperava status 400 Bad Request para horário inválido, obteve %d", rr.Code)
	}
}
