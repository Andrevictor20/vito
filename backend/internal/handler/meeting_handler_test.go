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

func setupMeetingHandlerTest(t *testing.T) (*chi.Mux, *domain.User, *domain.Meeting) {
	t.Helper()
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("erro ao abrir sqlite: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	eventRepo := repository.NewEventRepository(db)
	meetingRepo := repository.NewMeetingRepositorySQLite(db)

	user := &domain.User{
		ID:           "user-host-456",
		Name:         "André Victor",
		Email:        "andre@vito.app",
		PasswordHash: "pass",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
	_ = userRepo.Create(user)

	now := time.Now().UTC().Truncate(time.Second)
	m := &domain.Meeting{
		ID:              "meet-test-1",
		UserID:          user.ID,
		Title:           "Reunião de Demonstração",
		DurationMinutes: 30,
		Mode:            domain.MeetingModeOneOnOne,
		Status:          domain.MeetingStatusOpen,
		ShortURL:        "https://vito.s.gy/m/demo",
		ExpiresAt:       now.Add(24 * time.Hour),
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	slots := []domain.MeetingSlot{
		{
			ID:        "slot-test-1",
			MeetingID: m.ID,
			StartAt:   now.Add(10 * time.Hour),
			EndAt:     now.Add(10*time.Hour + 30*time.Minute),
			CreatedAt: now,
		},
	}
	_ = meetingRepo.Create(context.Background(), m, slots)

	meetingSvc := service.NewMeetingService(
		meetingRepo,
		eventRepo,
		nil,
		nil,
		"http://localhost:8180",
	)

	h := handler.NewMeetingHandler(meetingSvc)

	r := chi.NewRouter()

	// Public routes
	r.Get("/meet/{id}", h.ServePublicPage)
	r.Get("/api/public/meet/{id}", h.GetPublicMeeting)
	r.Post("/api/public/meet/{id}/vote", h.SubmitPublicVote)

	// Authenticated routes
	r.Route("/api/v1/meetings", func(sub chi.Router) {
		sub.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				ctx := context.WithValue(req.Context(), middleware.UserIDKey, user.ID)
				next.ServeHTTP(w, req.WithContext(ctx))
			})
		})
		sub.Post("/", h.CreateMeeting)
		sub.Get("/", h.ListMeetings)
		sub.Get("/{id}", h.GetMeeting)
		sub.Delete("/{id}", h.DeleteMeeting)
		sub.Post("/{id}/confirm", h.ConfirmConsensus)
		sub.Get("/{id}/share", h.GetWhatsAppShare)
	})

	return r, user, m
}

func TestMeetingHandler_ServePublicPage(t *testing.T) {
	r, _, m := setupMeetingHandlerTest(t)

	req := httptest.NewRequest(http.MethodGet, "/meet/"+m.ID, nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava status 200, veio %d", rec.Code)
	}
	body := rec.Body.String()
	if !strings.Contains(body, m.Title) {
		t.Errorf("página não contém título da reunião: %s", body)
	}
	if !strings.Contains(body, "Vito Reuniões") {
		t.Errorf("página não contém menção ao Vito: %s", body)
	}
}

func TestMeetingHandler_PublicVote_And_AuthFlow(t *testing.T) {
	r, _, m := setupMeetingHandlerTest(t)

	// 1. Votação pública
	votePayload := map[string]interface{}{
		"participant_name": "Juliana Costa",
		"contact_info":     "juliana@teste.com",
		"slot_ids":         []string{"slot-test-1"},
	}
	jsonBody, _ := json.Marshal(votePayload)
	req := httptest.NewRequest(http.MethodPost, "/api/public/meet/"+m.ID+"/vote", bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200 no voto público, veio %d: %s", rec.Code, rec.Body.String())
	}

	// 2. Consulta autenticada de detalhes
	reqDetails := httptest.NewRequest(http.MethodGet, "/api/v1/meetings/"+m.ID, nil)
	recDetails := httptest.NewRecorder()
	r.ServeHTTP(recDetails, reqDetails)

	if recDetails.Code != http.StatusOK {
		t.Fatalf("esperava 200 nos detalhes, veio %d", recDetails.Code)
	}

	var details domain.MeetingWithDetails
	if err := json.NewDecoder(recDetails.Body).Decode(&details); err != nil {
		t.Fatal(err)
	}
	if details.Status != domain.MeetingStatusConfirmed {
		t.Fatalf("esperava status confirmed, veio %s", details.Status)
	}
	if len(details.Participants) != 1 || details.Participants[0].Name != "Juliana Costa" {
		t.Fatalf("participante não registrado corretamente: %+v", details.Participants)
	}

	// 3. WhatsApp Share
	reqShare := httptest.NewRequest(http.MethodGet, "/api/v1/meetings/"+m.ID+"/share", nil)
	recShare := httptest.NewRecorder()
	r.ServeHTTP(recShare, reqShare)

	if recShare.Code != http.StatusOK {
		t.Fatalf("esperava 200 no share, veio %d", recShare.Code)
	}
	var share service.WhatsAppShare
	_ = json.NewDecoder(recShare.Body).Decode(&share)
	if !strings.Contains(share.MessageText, m.Title) {
		t.Errorf("share não contém título: %+v", share)
	}

	// 4. Deleção
	reqDel := httptest.NewRequest(http.MethodDelete, "/api/v1/meetings/"+m.ID, nil)
	recDel := httptest.NewRecorder()
	r.ServeHTTP(recDel, reqDel)

	if recDel.Code != http.StatusNoContent {
		t.Fatalf("esperava 204 no delete, veio %d", recDel.Code)
	}
}
