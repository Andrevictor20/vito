package handler

import (
	"encoding/json"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/platform/httpx"
	"net/http"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// MemoryHandler expõe a API para o usuário inspecionar e gerenciar memórias ("O que o Vito sabe sobre mim").
type MemoryHandler struct {
	repo     *repository.MemoryHierarchyRepository
	factRepo *repository.MemoryRepositorySQLite
	embedder repository.EmbedderFunc
}

// NewMemoryHandler instancia o MemoryHandler.
func NewMemoryHandler(repo *repository.MemoryHierarchyRepository) *MemoryHandler {
	return &MemoryHandler{repo: repo}
}

// SetFactRepository conecta o repositório de fatos atômicos usados em runtime pelo ADK/ContextEnricher.
func (h *MemoryHandler) SetFactRepository(factRepo *repository.MemoryRepositorySQLite, embedder repository.EmbedderFunc) {
	h.factRepo = factRepo
	h.embedder = embedder
}

// ListMemories retorna a visão completa de memórias do usuário: temas, episódios recentes e fatos.
func (h *MemoryHandler) ListMemories(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	ctx := r.Context()
	themes, err := h.repo.ListThematicSummaries(ctx, userID)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao carregar temas")
		return
	}

	episodes, err := h.repo.ListRecentEpisodes(ctx, userID, 30)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao carregar episódios")
		return
	}

	facts, err := h.repo.ListAtomicFacts(ctx, userID, 100)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao carregar fatos")
		return
	}
	if h.factRepo != nil {
		if runtimeFacts, lErr := h.factRepo.ListByUser(userID, 50); lErr == nil {
			seenContent := make(map[string]bool, len(facts))
			seenIDs := make(map[string]bool, len(facts))
			for _, f := range facts {
				seenIDs[f.ID] = true
				seenContent[strings.ToLower(strings.TrimSpace(f.Content))] = true
			}
			for _, rf := range runtimeFacts {
				if rf.SupersededBy != "" {
					continue
				}
				norm := strings.ToLower(strings.TrimSpace(rf.Content))
				if seenIDs[rf.ID] || seenContent[norm] {
					continue
				}
				seenIDs[rf.ID] = true
				seenContent[norm] = true
				facts = append(facts, repository.UserMemoryFact{
					ID:         rf.ID,
					UserID:     rf.UserID,
					Category:   rf.Category,
					Content:    rf.Content,
					Source:     "assistant",
					Confidence: rf.Confidence,
					IsActive:   true,
					CreatedAt:  rf.CreatedAt,
					UpdatedAt:  rf.UpdatedAt,
				})
			}
		}
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
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "id obrigatório")
		return
	}

	if err := h.repo.DeleteEpisode(r.Context(), userID, id); err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao remover episódio")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// DeleteThematicSummary remove a consolidação de um tema.
func (h *MemoryHandler) DeleteThematicSummary(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	slug := chi.URLParam(r, "slug")
	if slug == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "slug obrigatório")
		return
	}

	if err := h.repo.DeleteThematicSummary(r.Context(), userID, slug); err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao remover resumo temático")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// DeleteFact desativa um fato atômico individual.
func (h *MemoryHandler) DeleteFact(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "id obrigatório")
		return
	}

	var deletedContent string
	if h.factRepo != nil {
		if existing, lErr := h.repo.ListAtomicFacts(r.Context(), userID, 200); lErr == nil {
			for _, f := range existing {
				if f.ID == id {
					deletedContent = strings.TrimSpace(f.Content)
					break
				}
			}
		}
	}

	if err := h.repo.DeleteAtomicFact(r.Context(), userID, id); err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao desativar fato")
		return
	}
	if h.factRepo != nil {
		_ = h.factRepo.Delete(id, userID)
		if deletedContent != "" {
			if runtimeFacts, lErr := h.factRepo.ListByUser(userID, 100); lErr == nil {
				for _, rf := range runtimeFacts {
					if strings.EqualFold(strings.TrimSpace(rf.Content), deletedContent) {
						_ = h.factRepo.Delete(rf.ID, userID)
					}
				}
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// CreateFact cria um novo fato atômico na memória do usuário (#s-memory).
func (h *MemoryHandler) CreateFact(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	var req struct {
		Category string `json:"category"`
		Content  string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload inválido")
		return
	}
	content := strings.TrimSpace(req.Content)
	if content == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "content obrigatório")
		return
	}
	category := strings.TrimSpace(req.Category)
	if category == "" {
		category = "preference"
	}

	now := time.Now().UTC()
	fact := &repository.UserMemoryFact{
		ID:         uuid.New().String(),
		UserID:     userID,
		Category:   category,
		Content:    content,
		Source:     "manual",
		Confidence: 1.0,
		IsActive:   true,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := h.repo.CreateAtomicFact(r.Context(), fact); err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao salvar fato")
		return
	}
	if h.factRepo != nil {
		mem := &domain.Memory{
			ID:         fact.ID,
			UserID:     userID,
			Category:   category,
			Content:    content,
			Importance: 4,
			Confidence: 1.0,
			CreatedAt:  now,
			UpdatedAt:  now,
		}
		if err := h.factRepo.Create(mem); err == nil && h.embedder != nil {
			if vec, embErr := h.embedder(r.Context(), content); embErr == nil && len(vec) > 0 {
				_ = h.factRepo.UpsertEmbedding(r.Context(), mem.ID, userID, "gemini-embedding-001", vec)
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(fact)
}
