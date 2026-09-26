package server_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/server"
	"github.com/andrevmp/vito/backend/internal/service"
)

func setupFullServer(t *testing.T) (*httptest.Server, string) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_integration.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	jwtSecret := "integration-test-secret"
	userRepo := repository.NewUserRepository(db)
	eventRepo := repository.NewEventRepository(db)
	todoRepo := repository.NewTodoRepository(db)

	authSvc := service.NewAuthService(userRepo, jwtSecret)
	calSvc := service.NewCalendarService(eventRepo)
	todoSvc := service.NewTodoService(todoRepo)

	authHandler := handler.NewAuthHandler(authSvc, userRepo)
	calHandler := handler.NewCalendarHandler(calSvc)
	todoHandler := handler.NewTodoHandler(todoSvc)

	srv := server.New(server.Config{
		AuthHandler: authHandler,
		CalHandler:  calHandler,
		TodoHandler: todoHandler,
		AuthSvc:     authSvc,
	})

	ts := httptest.NewServer(srv.Router())
	t.Cleanup(func() { ts.Close() })

	return ts, jwtSecret
}

func TestIntegration_Auth_Calendar_Todos(t *testing.T) {
	ts, _ := setupFullServer(t)

	// 1. Registro de usuário
	registerBody := map[string]string{
		"name":     "André Teste",
		"email":    "andre@kito.test",
		"password": "senhaSegura123",
	}
	regJSON, _ := json.Marshal(registerBody)
	resp, err := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewBuffer(regJSON))
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected status 201 Created, got %d", resp.StatusCode)
	}

	var regResult struct {
		Token string `json:"token"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&regResult)
	token := regResult.Token
	if token == "" {
		t.Fatal("expected non-empty token")
	}

	// 2. Consulta /api/v1/auth/me protegida
	reqMe, _ := http.NewRequest("GET", ts.URL+"/api/v1/auth/me", nil)
	reqMe.Header.Set("Authorization", "Bearer "+token)
	respMe, err := http.DefaultClient.Do(reqMe)
	if err != nil {
		t.Fatalf("auth/me failed: %v", err)
	}
	defer respMe.Body.Close()
	if respMe.StatusCode != http.StatusOK {
		t.Errorf("expected status 200 on /me, got %d", respMe.StatusCode)
	}

	// 3. Criar evento na agenda
	startTime := time.Date(2026, 9, 28, 14, 0, 0, 0, time.UTC)
	eventPayload := map[string]interface{}{
		"title":       "Consulta Médica",
		"description": "Exame de rotina",
		"location":    "Consultório Central",
		"start_at":    startTime.Format(time.RFC3339),
		"end_at":      startTime.Add(1 * time.Hour).Format(time.RFC3339),
	}
	eventJSON, _ := json.Marshal(eventPayload)
	reqEvent, _ := http.NewRequest("POST", ts.URL+"/api/v1/events", bytes.NewBuffer(eventJSON))
	reqEvent.Header.Set("Authorization", "Bearer "+token)
	reqEvent.Header.Set("Content-Type", "application/json")
	respEvent, err := http.DefaultClient.Do(reqEvent)
	if err != nil {
		t.Fatalf("create event failed: %v", err)
	}
	defer respEvent.Body.Close()
	if respEvent.StatusCode != http.StatusCreated {
		t.Fatalf("expected status 201 on create event, got %d", respEvent.StatusCode)
	}

	// 4. Criar evento colidindo (detecta conflito)
	conflictPayload := map[string]interface{}{
		"title":    "Reunião Sobreposta",
		"start_at": startTime.Add(30 * time.Minute).Format(time.RFC3339),
		"end_at":   startTime.Add(90 * time.Minute).Format(time.RFC3339),
	}
	conflictJSON, _ := json.Marshal(conflictPayload)
	reqConflict, _ := http.NewRequest("POST", ts.URL+"/api/v1/events", bytes.NewBuffer(conflictJSON))
	reqConflict.Header.Set("Authorization", "Bearer "+token)
	reqConflict.Header.Set("Content-Type", "application/json")
	respConflict, err := http.DefaultClient.Do(reqConflict)
	if err != nil {
		t.Fatalf("create conflicting event failed: %v", err)
	}
	defer respConflict.Body.Close()

	var conflictResult struct {
		Conflict struct {
			HasConflict      bool   `json:"has_conflict"`
			ConflictingTitle string `json:"conflicting_title"`
		} `json:"conflict"`
	}
	_ = json.NewDecoder(respConflict.Body).Decode(&conflictResult)
	if !conflictResult.Conflict.HasConflict {
		t.Errorf("expected conflict to be detected")
	}
	if conflictResult.Conflict.ConflictingTitle != "Consulta Médica" {
		t.Errorf("expected conflict with 'Consulta Médica', got '%s'", conflictResult.Conflict.ConflictingTitle)
	}

	// 5. Criar To-do
	todoPayload := map[string]interface{}{
		"title":    "Comprar passagem aérea",
		"priority": "high",
	}
	todoJSON, _ := json.Marshal(todoPayload)
	reqTodo, _ := http.NewRequest("POST", ts.URL+"/api/v1/todos", bytes.NewBuffer(todoJSON))
	reqTodo.Header.Set("Authorization", "Bearer "+token)
	reqTodo.Header.Set("Content-Type", "application/json")
	respTodo, err := http.DefaultClient.Do(reqTodo)
	if err != nil {
		t.Fatalf("create todo failed: %v", err)
	}
	defer respTodo.Body.Close()
	if respTodo.StatusCode != http.StatusCreated {
		t.Errorf("expected status 201 on create todo, got %d", respTodo.StatusCode)
	}
}
