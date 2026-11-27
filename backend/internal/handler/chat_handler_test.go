package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func TestChatHandler_ThreadModelUpsertHydrationDeleteAndFeedback(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "chat_handler.db"))
	if err != nil {
		t.Fatalf("falha ao abrir sqlite: %v", err)
	}
	defer db.Close()

	userID := "user-chat-h"
	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{
		ID:        userID,
		Name:      "André",
		Email:     "chat@vito.local",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})

	chatRepo := repository.NewChatRepository(db)
	convRepo := repository.NewConversationStoreRepository(db)
	aiProvRepo := repository.NewAIProviderRepository(db)
	aiSetRepo := repository.NewAISettingsRepository(db)
	provSvc := service.NewAIProviderService(aiProvRepo, aiSetRepo, convRepo, nil, nil, nil, 0)

	chatSvc := service.NewChatService(chatRepo)
	h := handler.NewChatHandler(chatSvc)
	h.SetAIProviderService(provSvc)
	h.SetConversationStore(convRepo)

	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, userID))
			next.ServeHTTP(w, req)
		})
	})
	h.RegisterRoutes(r)

	// 1. PATCH /threads/{id}/model em conversa nova deve fazer upsert sem 404
	threadID := "conv-new-123"
	reqPref := httptest.NewRequest(http.MethodPatch, "/threads/"+threadID+"/model", strings.NewReader(`{"model_pref":"srv:auto","effort_pref":"high"}`))
	rrPref := httptest.NewRecorder()
	r.ServeHTTP(rrPref, reqPref)
	if rrPref.Code != http.StatusOK {
		t.Fatalf("esperava 200 OK ao atualizar modelo de thread nova, obteve %d: %s", rrPref.Code, rrPref.Body.String())
	}

	// 2. Sync de sessão + GetSessionMessages deve hidratar model_pref e effort_pref da thread
	reqSync := httptest.NewRequest(http.MethodPost, "/chat/sync", strings.NewReader(`{"session":{"id":"`+threadID+`","title":"Teste","preview":"Oi"},"messages":[]}`))
	rrSync := httptest.NewRecorder()
	r.ServeHTTP(rrSync, reqSync)
	if rrSync.Code != http.StatusOK {
		t.Fatalf("POST /chat/sync falhou (%d): %s", rrSync.Code, rrSync.Body.String())
	}

	var synced domain.ChatSessionWithMessages
	if err := json.NewDecoder(rrSync.Body).Decode(&synced); err != nil {
		t.Fatalf("decode sync: %v", err)
	}
	if synced.Session.ModelPref != "srv:auto" || synced.Session.EffortPref != "high" {
		t.Errorf("esperava model_pref='srv:auto' e effort_pref='high' hidratados, obteve %+v", synced.Session)
	}

	// 3. Feedback explícito like/dislike
	reqFb := httptest.NewRequest(http.MethodPost, "/chat/messages/feedback", strings.NewReader(`{"message_id":"m1","rating":"like","content":"Ótimo resumo objetivo."}`))
	rrFb := httptest.NewRecorder()
	r.ServeHTTP(rrFb, reqFb)
	if rrFb.Code != http.StatusOK {
		t.Fatalf("POST /chat/messages/feedback esperava 200, obteve %d: %s", rrFb.Code, rrFb.Body.String())
	}

	// 4. DELETE /chat/sessions/{id} deve remover também de conversation_threads
	reqDel := httptest.NewRequest(http.MethodDelete, "/chat/sessions/"+threadID, nil)
	rrDel := httptest.NewRecorder()
	r.ServeHTTP(rrDel, reqDel)
	if rrDel.Code != http.StatusNoContent {
		t.Fatalf("DELETE /chat/sessions esperava 204, obteve %d", rrDel.Code)
	}
	var count int
	_ = db.QueryRow(`SELECT COUNT(*) FROM conversation_threads WHERE id = ?`, threadID).Scan(&count)
	if count != 0 {
		t.Errorf("esperava remoção da thread em conversation_threads após DeleteSession, count=%d", count)
	}
}
