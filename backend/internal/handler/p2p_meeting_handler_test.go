package handler_test

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	_ "modernc.org/sqlite"
)

type p2pHandlerTestContext struct {
	userRepo domain.UserRepository
	p2pRepo  domain.P2PInviteRepository
	p2pSvc   *service.P2PMeetingService
	handler  *handler.P2PMeetingHandler
	u1       *domain.User
	u2       *domain.User
}

func setupP2PHandlerTest(t *testing.T) *p2pHandlerTestContext {
	t.Helper()
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("erro ao abrir db: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	eventRepo := repository.NewEventRepository(db)
	p2pRepo := repository.NewP2PInviteRepositorySQLite(db)
	calSvc := service.NewCalendarService(eventRepo)
	p2pSvc := service.NewP2PMeetingService(p2pRepo, userRepo, calSvc, nil)
	p2pHandler := handler.NewP2PMeetingHandler(p2pSvc, userRepo)

	phone1 := "+5511999991111"
	u1 := &domain.User{ID: uuid.New().String(), Name: "Alice", Email: "alice@vito.app", Phone: &phone1, CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()}
	if err := userRepo.Create(u1); err != nil {
		t.Fatal(err)
	}

	phone2 := "+5511999992222"
	u2 := &domain.User{ID: uuid.New().String(), Name: "Bob", Email: "bob@vito.app", Phone: &phone2, CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()}
	if err := userRepo.Create(u2); err != nil {
		t.Fatal(err)
	}

	return &p2pHandlerTestContext{
		userRepo: userRepo,
		p2pRepo:  p2pRepo,
		p2pSvc:   p2pSvc,
		handler:  p2pHandler,
		u1:       u1,
		u2:       u2,
	}
}

func TestP2PMeetingHandler_ChallengeAndMatch(t *testing.T) {
	tc := setupP2PHandlerTest(t)

	// 1. GET Challenge
	reqChallenge := httptest.NewRequest(http.MethodGet, "/api/v1/contacts/challenge", nil)
	recChallenge := httptest.NewRecorder()
	tc.handler.GetChallenge(recChallenge, reqChallenge)

	if recChallenge.Code != http.StatusOK {
		t.Fatalf("esperava 200 no challenge, obteve: %d", recChallenge.Code)
	}

	var challengeResp map[string]string
	if err := json.Unmarshal(recChallenge.Body.Bytes(), &challengeResp); err != nil {
		t.Fatal(err)
	}
	salt := challengeResp["salt"]
	if salt == "" {
		t.Fatal("salt vazio")
	}

	// 2. Hash phone de Bob e matching
	h := hmac.New(sha256.New, []byte(salt))
	h.Write([]byte(*tc.u2.Phone))
	bobHash := hex.EncodeToString(h.Sum(nil))

	matchBody, _ := json.Marshal(map[string]interface{}{
		"salt":   salt,
		"hashes": []string{bobHash},
	})
	reqMatch := httptest.NewRequest(http.MethodPost, "/api/v1/contacts/match", bytes.NewReader(matchBody))
	recMatch := httptest.NewRecorder()
	tc.handler.MatchContacts(recMatch, reqMatch)

	if recMatch.Code != http.StatusOK {
		t.Fatalf("esperava 200 no match, obteve %d", recMatch.Code)
	}

	var matchResp struct {
		Matches []domain.ContactMatchResult `json:"matches"`
	}
	if err := json.Unmarshal(recMatch.Body.Bytes(), &matchResp); err != nil {
		t.Fatal(err)
	}
	if len(matchResp.Matches) != 1 {
		t.Fatalf("esperava 1 match, obteve %d", len(matchResp.Matches))
	}
	if matchResp.Matches[0].UserID != tc.u2.ID {
		t.Errorf("match incorreto: %+v", matchResp.Matches[0])
	}
}

func TestP2PMeetingHandler_InviteAndAcceptFlow(t *testing.T) {
	tc := setupP2PHandlerTest(t)

	// 1. Alice convida Bob
	startAt := time.Now().UTC().Add(24 * time.Hour).Truncate(time.Hour)
	endAt := startAt.Add(45 * time.Minute)

	invitePayload, _ := json.Marshal(map[string]interface{}{
		"to_user_id":  tc.u2.ID,
		"title":       "Coffee Chat",
		"description": "Bate-papo rápido",
		"start_at":    startAt.Format(time.RFC3339),
		"end_at":      endAt.Format(time.RFC3339),
	})

	reqInvite := httptest.NewRequest(http.MethodPost, "/api/v1/meetings/p2p/invite", bytes.NewReader(invitePayload))
	reqInvite = reqInvite.WithContext(context.WithValue(reqInvite.Context(), middleware.UserIDKey, tc.u1.ID))
	recInvite := httptest.NewRecorder()
	tc.handler.SendInvite(recInvite, reqInvite)

	if recInvite.Code != http.StatusCreated {
		t.Fatalf("esperava 201 no invite, obteve %d: %s", recInvite.Code, recInvite.Body.String())
	}

	var createdInvite domain.P2PMeetingInvite
	if err := json.Unmarshal(recInvite.Body.Bytes(), &createdInvite); err != nil {
		t.Fatal(err)
	}
	if createdInvite.ID == "" {
		t.Fatal("ID do convite vazio")
	}

	// 2. Bob lista pendentes
	reqPending := httptest.NewRequest(http.MethodGet, "/api/v1/meetings/p2p/invites/pending", nil)
	reqPending = reqPending.WithContext(context.WithValue(reqPending.Context(), middleware.UserIDKey, tc.u2.ID))
	recPending := httptest.NewRecorder()
	tc.handler.ListPendingInvites(recPending, reqPending)

	if recPending.Code != http.StatusOK {
		t.Fatalf("esperava 200 nos pendentes, obteve %d", recPending.Code)
	}

	var pendingList []domain.P2PMeetingInvite
	if err := json.Unmarshal(recPending.Body.Bytes(), &pendingList); err != nil {
		t.Fatal(err)
	}
	if len(pendingList) != 1 {
		t.Fatalf("esperava 1 pendente, obteve %d", len(pendingList))
	}

	// 3. Bob aceita o convite
	rAccept := chi.NewRouter()
	rAccept.Post("/api/v1/meetings/p2p/invites/{id}/accept", tc.handler.AcceptInvite)

	reqAccept := httptest.NewRequest(http.MethodPost, "/api/v1/meetings/p2p/invites/"+createdInvite.ID+"/accept", nil)
	reqAccept = reqAccept.WithContext(context.WithValue(reqAccept.Context(), middleware.UserIDKey, tc.u2.ID))
	recAccept := httptest.NewRecorder()
	rAccept.ServeHTTP(recAccept, reqAccept)

	if recAccept.Code != http.StatusOK {
		t.Fatalf("esperava 200 ao aceitar, obteve %d: %s", recAccept.Code, recAccept.Body.String())
	}

	var acceptedInvite domain.P2PMeetingInvite
	if err := json.Unmarshal(recAccept.Body.Bytes(), &acceptedInvite); err != nil {
		t.Fatal(err)
	}
	if acceptedInvite.Status != domain.P2PInviteStatusAccepted {
		t.Fatalf("status deveria ser accepted, obteve %s", acceptedInvite.Status)
	}
	if acceptedInvite.EventIDFrom == nil || acceptedInvite.EventIDTo == nil {
		t.Fatal("event IDs de ambos devem estar preenchidos")
	}
}

func TestP2PMeetingHandler_MutualSlots(t *testing.T) {
	tc := setupP2PHandlerTest(t)

	from := time.Now().UTC().Truncate(24*time.Hour).Add(24 * time.Hour).Add(9 * time.Hour)
	to := from.Add(8 * time.Hour)

	url := "/api/v1/meetings/p2p/mutual-slots?target_user_id=" + tc.u2.ID +
		"&from=" + from.Format(time.RFC3339) +
		"&to=" + to.Format(time.RFC3339) +
		"&duration=30"

	req := httptest.NewRequest(http.MethodGet, url, nil)
	req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, tc.u1.ID))
	rec := httptest.NewRecorder()
	tc.handler.GetMutualSlots(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200 em mutual slots, obteve %d: %s", rec.Code, rec.Body.String())
	}

	var resp struct {
		MutualSlots []domain.P2PMutualSlot `json:"mutual_slots"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.MutualSlots) == 0 {
		t.Fatal("esperava slots mútuos")
	}
}
