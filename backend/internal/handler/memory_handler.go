package handler

import (
	"encoding/json"
	"net/http"

	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/go-chi/chi/v5"
)

// MemoryHandler expõe a API para o usuário inspecionar e gerenciar memórias ("O que o Vito sabe sobre mim").
type MemoryHandler struct {
	repo *repository.MemoryHierarchyRepository
}

// NewMemoryHandler instancia o MemoryHandler.
func NewMemoryHandler(repo *repository.MemoryHierarchyRepository) *MemoryHandler {
	return &MemoryHandler{repo: repo}
}

// ListMemories retorna a visão completa de memórias do usuário: temas, episódios recentes e fatos.
func (h *MemoryHandler) ListMemories(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	themes, err := h.repo.ListThematicSummaries(ctx, userID)
	if err != nil {
		http.Error(w, `{"error":"falha ao carregar temas"}`, http.StatusInternalServerError)
		return
	}

	episodes, err := h.repo.ListRecentEpisodes(ctx, userID, 30)
	if err != nil {
		http.Error(w, `{"error":"falha ao carregar episódios"}`, http.StatusInternalServerError)
		return
	}

	facts, err := h.repo.ListAtomicFacts(ctx, userID, 100)
	if err != nil {
		http.Error(w, `{"error":"falha ao carregar fatos"}`, http.StatusInternalServerError)
		return
	}

	resp := map[string]any{
		"themes":   themes,
		"episodes": episodes,
		"facts":    facts,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

// DeleteEpisode remove um episódio individual.
func (h *MemoryHandler) DeleteEpisode(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id obrigatório"}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.DeleteEpisode(r.Context(), userID, id); err != nil {
		http.Error(w, `{"error":"falha ao remover episódio"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// DeleteThematicSummary remove a consolidação de um tema.
func (h *MemoryHandler) DeleteThematicSummary(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	slug := chi.URLParam(r, "slug")
	if slug == "" {
		http.Error(w, `{"error":"slug obrigatório"}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.DeleteThematicSummary(r.Context(), userID, slug); err != nil {
		http.Error(w, `{"error":"falha ao remover resumo temático"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// DeleteFact desativa um fato atômico individual.
func (h *MemoryHandler) DeleteFact(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, `{"error":"id obrigatório"}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.DeleteAtomicFact(r.Context(), userID, id); err != nil {
		http.Error(w, `{"error":"falha ao desativar fato"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
}
