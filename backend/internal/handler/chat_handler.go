package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"github.com/andrevmp/vito/backend/internal/platform/httpx"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

// ChatHandler gerencia as requisições HTTP REST de sincronização de conversas e mensagens.
type ChatHandler struct {
	svc           *service.ChatService
	aiProviderSvc *service.AIProviderService
}

// NewChatHandler cria um novo handler de chat.
func NewChatHandler(svc *service.ChatService) *ChatHandler {
	return &ChatHandler{svc: svc}
}

// SetAIProviderService conecta o serviço de preferências BYOK para atualizar modelo por conversa.
func (h *ChatHandler) SetAIProviderService(svc *service.AIProviderService) {
	h.aiProviderSvc = svc
}

// SetConversationStore conecta o repositório de threads ADK ao serviço de chat.
func (h *ChatHandler) SetConversationStore(convRepo *repository.ConversationStoreRepository) {
	if h.svc != nil {
		h.svc.SetConversationStore(convRepo)
	}
}

type syncChatRequest struct {
	Session  domain.ChatSession   `json:"session"`
	Messages []domain.ChatMessage `json:"messages"`
}

// ListSessions retorna todas as sessões de chat do usuário logado.
func (h *ChatHandler) ListSessions(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	sessions, err := h.svc.ListSessions(r.Context(), userID)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao listar conversas")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(sessions)
}

// GetSessionMessages retorna a sessão e suas mensagens.
func (h *ChatHandler) GetSessionMessages(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	sessionID := chi.URLParam(r, "id")
	if sessionID == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "id da conversa obrigatório")
		return
	}

	res, err := h.svc.GetSessionWithMessages(r.Context(), sessionID, userID)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao buscar histórico da conversa")
		return
	}
	if res == nil {
		httpx.RespondError(w, domain.ErrChatSessionNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

// SyncSession recebe o estado de uma conversa e persiste de forma atômica no servidor.
func (h *ChatHandler) SyncSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	var req syncChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload inválido")
		return
	}

	if req.Session.ID == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "id da conversa obrigatório")
		return
	}

	res, err := h.svc.SyncSession(r.Context(), userID, &req.Session, req.Messages)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao sincronizar conversa")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

// DeleteSession remove uma conversa do histórico.
func (h *ChatHandler) DeleteSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	sessionID := chi.URLParam(r, "id")
	if sessionID == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "id da conversa obrigatório")
		return
	}

	if err := h.svc.DeleteSession(r.Context(), sessionID, userID); err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao deletar conversa")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// UpdateThreadModelPref atualiza model_pref e effort_pref da conversa (PATCH /api/v1/threads/{id}/model).
func (h *ChatHandler) UpdateThreadModelPref(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	if h.aiProviderSvc == nil {
		httpx.WriteJSONError(w, http.StatusServiceUnavailable, "serviço de provedores de IA não configurado")
		return
	}
	threadID := strings.TrimSpace(chi.URLParam(r, "id"))
	if threadID == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "id da conversa obrigatório")
		return
	}
	var body domain.ModelPreferenceUpdate
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload JSON inválido")
		return
	}
	if err := h.aiProviderSvc.UpdateThreadModelPref(r.Context(), userID, threadID, body.ModelPref, body.EffortPref); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.WriteJSONError(w, http.StatusNotFound, "conversa não encontrada")
			return
		}
		httpx.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.WriteJSON(w, http.StatusOK, body)
}

// RecordMessageFeedback registra reação explícita (like/dislike) do usuário para aprendizado contínuo.
func (h *ChatHandler) RecordMessageFeedback(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	var req struct {
		MessageID string `json:"message_id"`
		SessionID string `json:"session_id,omitempty"`
		Rating    string `json:"rating"`
		Content   string `json:"content,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload inválido")
		return
	}
	rating := strings.ToLower(strings.TrimSpace(req.Rating))
	if rating != "like" && rating != "dislike" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "rating inválido (use 'like' ou 'dislike')")
		return
	}
	snippet := strings.TrimSpace(req.Content)
	if len(snippet) > 140 {
		snippet = strings.TrimSpace(snippet[:140])
	}
	if snippet != "" {
		label := "aprovou"
		if rating == "dislike" {
			label = "não gostou de"
		}
		service.EmitImplicitFeedback(userID, "Usuário "+label+" resposta no estilo: \""+snippet+"\"")
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{
		"status": "recorded",
		"rating": rating,
	})
}
