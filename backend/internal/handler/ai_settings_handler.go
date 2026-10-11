package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
)

// AISettingsHandler gerencia a consulta e atualização das preferências de IA e autonomia.
type AISettingsHandler struct {
	repo domain.AISettingsRepository
}

// NewAISettingsHandler cria uma nova instância de AISettingsHandler.
func NewAISettingsHandler(repo domain.AISettingsRepository) *AISettingsHandler {
	return &AISettingsHandler{repo: repo}
}

type updateAISettingsRequest struct {
	AutonomyMode    string `json:"autonomy_mode"`
	AutoFocusBlocks *bool  `json:"auto_focus_blocks"`
}

// GetSettings retorna as configurações de IA do usuário logado.
func (h *AISettingsHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	settings, err := h.repo.GetSettings(userID)
	if err != nil {
		http.Error(w, `{"error":"falha ao buscar preferências de IA"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(settings)
}

// UpdateSettings atualiza as preferências de autonomia e recursos da IA para o usuário logado.
func (h *AISettingsHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	var req updateAISettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload inválido"}`, http.StatusBadRequest)
		return
	}

	mode := strings.TrimSpace(req.AutonomyMode)
	if mode != "" {
		if mode != string(domain.AutonomyModeAssisted) && mode != string(domain.AutonomyModeProactive) {
			http.Error(w, `{"error":"modo de autonomia inválido (deve ser 'assisted' ou 'proactive')"}`, http.StatusBadRequest)
			return
		}
	}

	current, err := h.repo.GetSettings(userID)
	if err != nil {
		http.Error(w, `{"error":"falha ao carregar preferências atuais"}`, http.StatusInternalServerError)
		return
	}

	if mode != "" {
		current.AutonomyMode = domain.AutonomyMode(mode)
	}
	if req.AutoFocusBlocks != nil {
		current.AutoFocusBlocks = *req.AutoFocusBlocks
	}

	if err := h.repo.UpsertSettings(current); err != nil {
		http.Error(w, `{"error":"falha ao salvar preferências de IA"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(current)
}
