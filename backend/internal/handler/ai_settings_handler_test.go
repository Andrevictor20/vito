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

type mockAISettingsRepoForHandler struct {
	settings *domain.AISettings
}

func (m *mockAISettingsRepoForHandler) GetSettings(userID string) (*domain.AISettings, error) {
	if m.settings != nil {
		return m.settings, nil
	}
	return domain.DefaultAISettings(userID), nil
}

func (m *mockAISettingsRepoForHandler) UpsertSettings(s *domain.AISettings) error {
	m.settings = s
	return nil
}

func TestAISettingsHandler_GetSettings(t *testing.T) {
	repo := &mockAISettingsRepoForHandler{
		settings: &domain.AISettings{
			UserID:          "user-ai-1",
			AutonomyMode:    domain.AutonomyModeProactive,
			AutoFocusBlocks: true,
		},
	}
	h := handler.NewAISettingsHandler(repo)

	req := httptest.NewRequest("GET", "/api/v1/users/ai-settings", nil)
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-ai-1")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	h.GetSettings(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("esperava status 200, obteve %d", rr.Code)
	}

	var res domain.AISettings
	if err := json.NewDecoder(rr.Body).Decode(&res); err != nil {
		t.Fatalf("falha ao decodificar JSON: %v", err)
	}
	if res.AutonomyMode != domain.AutonomyModeProactive {
		t.Errorf("esperava 'proactive', obteve %s", res.AutonomyMode)
	}
	if !res.AutoFocusBlocks {
		t.Errorf("esperava AutoFocusBlocks true")
	}
}

func TestAISettingsHandler_UpdateSettings_Valid(t *testing.T) {
	repo := &mockAISettingsRepoForHandler{}
	h := handler.NewAISettingsHandler(repo)

	body := []byte(`{"autonomy_mode":"proactive","auto_focus_blocks":true}`)
	req := httptest.NewRequest("PUT", "/api/v1/users/ai-settings", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-ai-1")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	h.UpdateSettings(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("esperava status 200, obteve %d. Body: %s", rr.Code, rr.Body.String())
	}

	var res domain.AISettings
	if err := json.NewDecoder(rr.Body).Decode(&res); err != nil {
		t.Fatalf("falha ao decodificar JSON: %v", err)
	}
	if res.AutonomyMode != domain.AutonomyModeProactive {
		t.Errorf("esperava 'proactive', obteve %s", res.AutonomyMode)
	}
	if !res.AutoFocusBlocks {
		t.Errorf("esperava AutoFocusBlocks true")
	}
}

func TestAISettingsHandler_UpdateSettings_InvalidMode(t *testing.T) {
	repo := &mockAISettingsRepoForHandler{}
	h := handler.NewAISettingsHandler(repo)

	body := []byte(`{"autonomy_mode":"invalid_ultra_mode"}`)
	req := httptest.NewRequest("PUT", "/api/v1/users/ai-settings", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-ai-1")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	h.UpdateSettings(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("esperava status 400 Bad Request para modo inválido, obteve %d", rr.Code)
	}
}
