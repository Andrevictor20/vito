package handler_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/server"
	"github.com/andrevmp/vito/backend/internal/service"
)

func TestAuthSessionEndpoints_Flow(t *testing.T) {
	tmpDir := t.TempDir()
	db, err := database.Open(filepath.Join(tmpDir, "sessions_http.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	sessionRepo := repository.NewSessionRepository(db)
	authSvc := service.NewAuthService(userRepo, "test-jwt-secret-sprint13")
	authSvc.SetSessionRepository(sessionRepo)
	authHandler := handler.NewAuthHandler(authSvc, userRepo)

	srv := server.New(server.Config{
		AuthHandler: authHandler,
		AuthSvc:     authSvc,
	})
	ts := httptest.NewServer(srv.Router())
	defer ts.Close()

	// 1. POST /api/v1/auth/register
	regBody := `{"name":"André","email":"andre@vito.ai","password":"Password123","device_name":"Galaxy S24"}`
	resp, err := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewBufferString(regBody))
	if err != nil || resp.StatusCode != http.StatusCreated {
		t.Fatalf("register failed: status=%v err=%v", resp.StatusCode, err)
	}
	var regData struct {
		Token        string `json:"token"`
		RefreshToken string `json:"refresh_token"`
		SessionID    string `json:"session_id"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&regData)
	resp.Body.Close()

	if regData.Token == "" || regData.RefreshToken == "" || regData.SessionID == "" {
		t.Fatalf("esperava token, refresh_token e session_id no registro, obteve: %+v", regData)
	}

	// 2. GET /api/v1/auth/sessions
	reqSessions, _ := http.NewRequest("GET", ts.URL+"/api/v1/auth/sessions", nil)
	reqSessions.Header.Set("Authorization", "Bearer "+regData.Token)
	respSessions, err := http.DefaultClient.Do(reqSessions)
	if err != nil || respSessions.StatusCode != http.StatusOK {
		t.Fatalf("list sessions failed: status=%v err=%v", respSessions.StatusCode, err)
	}
	var sessPayload struct {
		Sessions []struct {
			ID         string `json:"id"`
			DeviceName string `json:"device_name"`
			IsCurrent  bool   `json:"is_current"`
		} `json:"sessions"`
	}
	_ = json.NewDecoder(respSessions.Body).Decode(&sessPayload)
	respSessions.Body.Close()
	if len(sessPayload.Sessions) != 1 || !sessPayload.Sessions[0].IsCurrent {
		t.Fatalf("esperava 1 sessão ativa marcada como IsCurrent, obteve: %+v", sessPayload.Sessions)
	}

	// 3. POST /api/v1/auth/refresh
	refBody := `{"refresh_token":"` + regData.RefreshToken + `"}`
	respRef, err := http.Post(ts.URL+"/api/v1/auth/refresh", "application/json", bytes.NewBufferString(refBody))
	if err != nil || respRef.StatusCode != http.StatusOK {
		t.Fatalf("refresh failed: status=%v err=%v", respRef.StatusCode, err)
	}
	var refData struct {
		Token        string `json:"token"`
		RefreshToken string `json:"refresh_token"`
	}
	_ = json.NewDecoder(respRef.Body).Decode(&refData)
	respRef.Body.Close()
	if refData.RefreshToken == "" || refData.RefreshToken == regData.RefreshToken {
		t.Fatal("esperava novo refresh_token rotacionado")
	}

	// 4. DELETE /api/v1/auth/sessions/{id} revoga a sessão e bloqueia próximas chamadas
	reqDel, _ := http.NewRequest("DELETE", ts.URL+"/api/v1/auth/sessions/"+regData.SessionID, nil)
	reqDel.Header.Set("Authorization", "Bearer "+refData.Token)
	respDel, err := http.DefaultClient.Do(reqDel)
	if err != nil || respDel.StatusCode != http.StatusOK {
		t.Fatalf("revoke session failed: status=%v err=%v", respDel.StatusCode, err)
	}
	respDel.Body.Close()

	// Chamada subsequente a /api/v1/auth/me com o token da sessão revogada deve retornar 401
	reqMe, _ := http.NewRequest("GET", ts.URL+"/api/v1/auth/me", nil)
	reqMe.Header.Set("Authorization", "Bearer "+refData.Token)
	respMe, err := http.DefaultClient.Do(reqMe)
	if err != nil {
		t.Fatalf("me request err: %v", err)
	}
	respMe.Body.Close()
	if respMe.StatusCode != http.StatusUnauthorized {
		t.Errorf("esperava 401 Unauthorized após revogar a sessão do dispositivo, obteve %d", respMe.StatusCode)
	}
}
