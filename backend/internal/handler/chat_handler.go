package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

// ChatHandler gerencia as requisições HTTP REST de sincronização de conversas e mensagens.
type ChatHandler struct {
	svc *service.ChatService
}

// NewChatHandler cria um novo handler de chat.
func NewChatHandler(svc *service.ChatService) *ChatHandler {
	return &ChatHandler{svc: svc}
}

type syncChatRequest struct {
	Session  domain.ChatSession   `json:"session"`
	Messages []domain.ChatMessage `json:"messages"`
}

// ListSessions retorna todas as sessões de chat do usuário logado.
func (h *ChatHandler) ListSessions(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	sessions, err := h.svc.ListSessions(r.Context(), userID)
	if err != nil {
		http.Error(w, `{"error":"falha ao listar conversas"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(sessions)
}

// GetSessionMessages retorna a sessão e suas mensagens.
func (h *ChatHandler) GetSessionMessages(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	sessionID := chi.URLParam(r, "id")
	if sessionID == "" {
		http.Error(w, `{"error":"id da conversa obrigatório"}`, http.StatusBadRequest)
		return
	}

	res, err := h.svc.GetSessionWithMessages(r.Context(), sessionID, userID)
	if err != nil {
		http.Error(w, `{"error":"falha ao buscar histórico da conversa"}`, http.StatusInternalServerError)
		return
	}
	if res == nil {
		respondError(w, domain.ErrChatSessionNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

// SyncSession recebe o estado de uma conversa e persiste de forma atômica no servidor.
func (h *ChatHandler) SyncSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	var req syncChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload inválido"}`, http.StatusBadRequest)
		return
	}

	if req.Session.ID == "" {
		http.Error(w, `{"error":"id da conversa obrigatório"}`, http.StatusBadRequest)
		return
	}

	res, err := h.svc.SyncSession(r.Context(), userID, &req.Session, req.Messages)
	if err != nil {
		http.Error(w, `{"error":"falha ao sincronizar conversa"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

// DeleteSession remove uma conversa do histórico.
func (h *ChatHandler) DeleteSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	sessionID := chi.URLParam(r, "id")
	if sessionID == "" {
		http.Error(w, `{"error":"id da conversa obrigatório"}`, http.StatusBadRequest)
		return
	}

	if err := h.svc.DeleteSession(r.Context(), sessionID, userID); err != nil {
		http.Error(w, `{"error":"falha ao deletar conversa"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
