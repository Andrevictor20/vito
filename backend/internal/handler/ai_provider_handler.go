package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

// AIProviderHandler expõe as rotas REST de provedores BYOK, modelos e preferências (Plano 03 §5).
type AIProviderHandler struct {
	svc *service.AIProviderService
}

// NewAIProviderHandler cria o handler de provedores de IA BYOK.
func NewAIProviderHandler(svc *service.AIProviderService) *AIProviderHandler {
	return &AIProviderHandler{svc: svc}
}

// ListProviders retorna o catálogo completo (Servidor + 6 provedores BYOK) sem expor segredos.
func (h *AIProviderHandler) ListProviders(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	items, err := h.svc.ListProviders(r.Context(), userID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "falha ao listar provedores de IA")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"providers": items})
}

// ConnectProvider valida, testa contra o provedor, cifra no cofre e salva a chave BYOK.
func (h *AIProviderHandler) ConnectProvider(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	key := domain.ProviderKey(strings.ToLower(strings.TrimSpace(chi.URLParam(r, "key"))))
	if !domain.IsBYOKProviderKey(key) {
		writeJSONError(w, http.StatusBadRequest, "provedor inválido")
		return
	}

	var body struct {
		APIKey  string `json:"api_key"`
		BaseURL string `json:"base_url,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "payload JSON inválido")
		return
	}

	summary, err := h.svc.Connect(r.Context(), userID, key, body.APIKey, body.BaseURL)
	if err != nil {
		writeProviderServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, summary)
}

// TestProvider testa a chave já conectada atualizando status ('ok' | 'invalid').
func (h *AIProviderHandler) TestProvider(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	key := domain.ProviderKey(strings.ToLower(strings.TrimSpace(chi.URLParam(r, "key"))))
	if !domain.IsBYOKProviderKey(key) {
		writeJSONError(w, http.StatusBadRequest, "provedor inválido")
		return
	}

	summary, err := h.svc.Test(r.Context(), userID, key)
	if err != nil {
		writeProviderServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, struct {
		OK bool `json:"ok"`
		*domain.UserAIProviderSummary
	}{
		OK:                    true,
		UserAIProviderSummary: summary,
	})
}

// RemoveProvider remove a chave BYOK e limpa preferências associadas.
func (h *AIProviderHandler) RemoveProvider(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	key := domain.ProviderKey(strings.ToLower(strings.TrimSpace(chi.URLParam(r, "key"))))
	if !domain.IsBYOKProviderKey(key) {
		writeJSONError(w, http.StatusBadRequest, "provedor inválido")
		return
	}
	if err := h.svc.Remove(r.Context(), userID, key); err != nil {
		if errors.Is(err, domain.ErrAIProviderNotFound) {
			writeJSONError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSONError(w, http.StatusInternalServerError, "falha ao remover provedor")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "removed"})
}

// GetProviderModels retorna a lista de modelos de um provedor conectado (atualiza com ?refresh=1 ou >24h).
func (h *AIProviderHandler) GetProviderModels(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	key := domain.ProviderKey(strings.ToLower(strings.TrimSpace(chi.URLParam(r, "key"))))
	if !domain.IsBYOKProviderKey(key) {
		writeJSONError(w, http.StatusBadRequest, "provedor inválido")
		return
	}
	refresh := r.URL.Query().Get("refresh") == "1" || strings.EqualFold(r.URL.Query().Get("refresh"), "true")
	models, err := h.svc.GetProviderModels(r.Context(), userID, key, refresh)
	if err != nil {
		if errors.Is(err, domain.ErrAIProviderNotFound) {
			writeJSONError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	if models == nil {
		models = []domain.ProviderModelInfo{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"models": models})
}

// ListSelectableModels retorna os modelos agrupados por provedor ativo para o ModelPickerSheet.
func (h *AIProviderHandler) ListSelectableModels(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	groups, err := h.svc.ListSelectableModels(r.Context(), userID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "falha ao listar modelos disponíveis")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"groups": groups})
}

// GetPreferences retorna default_model e default_effort do usuário.
func (h *AIProviderHandler) GetPreferences(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	prefs, err := h.svc.GetPreferences(r.Context(), userID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "falha ao consultar preferências de IA")
		return
	}
	if prefs.DefaultModel == "" {
		prefs.DefaultModel = service.ModelPrefServerAuto
	}
	writeJSON(w, http.StatusOK, prefs)
}

// UpdatePreferences atualiza default_model e default_effort do usuário.
func (h *AIProviderHandler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	var body struct {
		DefaultModel  string `json:"default_model"`
		DefaultEffort string `json:"default_effort"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "payload JSON inválido")
		return
	}
	prefs, err := h.svc.UpdatePreferences(r.Context(), userID, body.DefaultModel, body.DefaultEffort)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, prefs)
}

func writeProviderServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, service.ErrAIProviderRateLimited):
		writeJSONError(w, http.StatusTooManyRequests, err.Error())
	case errors.Is(err, domain.ErrAIProviderNotFound):
		writeJSONError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, service.ErrProviderAuthRejected):
		msg := strings.TrimPrefix(err.Error(), service.ErrProviderAuthRejected.Error()+": ")
		writeJSONError(w, http.StatusBadRequest, msg)
	default:
		writeJSONError(w, http.StatusBadRequest, err.Error())
	}
}

func writeJSONError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
