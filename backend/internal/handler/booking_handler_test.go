package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	_ "modernc.org/sqlite"
)

func setupBookingHandlerTest(t *testing.T) (*chi.Mux, *domain.User, *domain.BookingType) {
	t.Helper()
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("erro ao abrir sqlite: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	eventRepo := repository.NewEventRepository(db)
	bookingRepo := repository.NewBookingRepositorySQLite(db)

	user := &domain.User{
		ID:           "user-host-123",
		Name:         "André Victor",
		Email:        "andre@vito.app",
		PasswordHash: "pass",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
	_ = userRepo.Create(user)

	bt := &domain.BookingType{
		ID:              "bt-123",
		UserID:          user.ID,
		Slug:            "30m",
		Title:           "Alinhamento 30m",
		DurationMinutes: 30,
		BufferMinutes:   10,
		DaysOfWeek:      "[1,2,3,4,5]",
		StartHour:       "10:00",
		EndHour:         "18:00",
		IsActive:        true,
	}
	_ = bookingRepo.CreateType(bt)

	shortener := service.NewDubShortenerService("", "http://localhost:8080")
	turnstile := service.NewTurnstileValidator("") // bypass em teste

	bookingSvc := service.NewBookingService(
		bookingRepo,
		eventRepo,
		userRepo,
		nil,
		shortener,
		turnstile,
		"http://localhost:8080",
	)

	h := handler.NewBookingHandler(bookingSvc)

	r := chi.NewRouter()
	// Rotas públicas
	r.Get("/book/{username}/{slug}", h.ServePublicPage)
	r.Get("/api/public/book/{username}/{slug}/slots", h.GetPublicSlots)
	r.Post("/api/public/book/{username}/{slug}/reserve", h.ReservePublicSlot)

	// Rotas autenticadas (simulando injeção de contexto de auth)
	r.Route("/api/v1/booking", func(auth chi.Router) {
		auth.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				ctx := context.WithValue(req.Context(), middleware.UserIDKey, user.ID)
				next.ServeHTTP(w, req.WithContext(ctx))
			})
		})
		auth.Get("/types", h.ListTypes)
		auth.Post("/types", h.CreateType)
	})

	return r, user, bt
}

func TestBookingHandler_ServePublicPage(t *testing.T) {
	router, _, bt := setupBookingHandlerTest(t)

	req := httptest.NewRequest(http.MethodGet, "/book/andre/"+bt.Slug, nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperado status 200, obteve %d", rec.Code)
	}

	body := rec.Body.String()
	if !strings.Contains(body, bt.Title) {
		t.Errorf("página não contém o título do agendamento: %s", bt.Title)
	}
	if !strings.Contains(body, "Content-Security-Policy") && rec.Header().Get("Content-Security-Policy") == "" {
		t.Errorf("cabeçalho CSP não foi configurado")
	}
}

func TestBookingHandler_GetPublicSlots(t *testing.T) {
	router, _, bt := setupBookingHandlerTest(t)

	// Terça-feira futura
	req := httptest.NewRequest(http.MethodGet, "/api/public/book/andre/"+bt.Slug+"/slots?date=2026-10-20", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperado status 200, obteve %d", rec.Code)
	}

	var slots []domain.BookingSlot
	if err := json.NewDecoder(rec.Body).Decode(&slots); err != nil {
		t.Fatalf("erro ao decodificar slots: %v", err)
	}
	if len(slots) == 0 {
		t.Errorf("esperado ao menos um slot para o dia útil")
	}
}

func TestBookingHandler_ReservePublicSlot(t *testing.T) {
	router, _, bt := setupBookingHandlerTest(t)

	startAt := time.Date(2026, 10, 20, 10, 0, 0, 0, time.UTC)
	endAt := startAt.Add(30 * time.Minute)

	payload := map[string]any{
		"guest_name":  "Fernanda Lima",
		"guest_email": "fernanda@teste.com",
		"guest_notes": "Apresentação de proposta",
		"start_at":    startAt.Format(time.RFC3339),
		"end_at":      endAt.Format(time.RFC3339),
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/public/book/andre/"+bt.Slug+"/reserve", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("esperado status 201 Created, obteve %d. Body: %s", rec.Code, rec.Body.String())
	}

	// Tentativa duplicada -> 409 Conflict
	req2 := httptest.NewRequest(http.MethodPost, "/api/public/book/andre/"+bt.Slug+"/reserve", bytes.NewReader(body))
	req2.Header.Set("Content-Type", "application/json")
	rec2 := httptest.NewRecorder()

	router.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusConflict {
		t.Fatalf("esperado status 409 Conflict para horário duplicado, obteve %d", rec2.Code)
	}
}

func TestBookingHandler_ListTypesAuthenticated(t *testing.T) {
	router, _, bt := setupBookingHandlerTest(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/booking/types", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperado status 200 OK, obteve %d", rec.Code)
	}

	var list []service.BookingTypeWithLink
	if err := json.NewDecoder(rec.Body).Decode(&list); err != nil {
		t.Fatalf("erro ao decodificar lista de tipos: %v", err)
	}
	if len(list) != 1 || list[0].Slug != bt.Slug {
		t.Errorf("esperado 1 tipo com slug %s, obteve %+v", bt.Slug, list)
	}
}
