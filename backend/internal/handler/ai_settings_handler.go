package handler

import (
	"encoding/json"
	"github.com/andrevmp/vito/backend/internal/platform/httpx"
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
	PersonaStyle    string `json:"persona_style"`
	PreferredVoice  string `json:"preferred_voice"`
	EmojiPolicy     string `json:"emoji_policy"`
	ResponseLength  string `json:"response_length"`
}

// GetSettings retorna as configurações de IA do usuário logado.
func (h *AISettingsHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	settings, err := h.repo.GetSettings(userID)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao buscar preferências de IA")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(settings)
}

// UpdateSettings atualiza as preferências de autonomia e recursos da IA para o usuário logado.
func (h *AISettingsHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	var req updateAISettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload inválido")
		return
	}

	mode := strings.TrimSpace(req.AutonomyMode)
	if mode != "" {
		if mode != string(domain.AutonomyModeAssisted) && mode != string(domain.AutonomyModeProactive) {
			httpx.WriteJSONError(w, http.StatusBadRequest, "modo de autonomia inválido (deve ser 'assisted' ou 'proactive')")
			return
		}
	}

	current, err := h.repo.GetSettings(userID)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao carregar preferências atuais")
		return
	}

	if mode != "" {
		current.AutonomyMode = domain.AutonomyMode(mode)
	}
	if req.AutoFocusBlocks != nil {
		current.AutoFocusBlocks = *req.AutoFocusBlocks
	}
	if p := strings.TrimSpace(req.PersonaStyle); p != "" {
		current.PersonaStyle = p
	}
	if v := strings.TrimSpace(req.PreferredVoice); v != "" {
		current.PreferredVoice = v
	}
	if e := strings.TrimSpace(req.EmojiPolicy); e != "" {
		current.EmojiPolicy = e
	}
	if l := strings.TrimSpace(req.ResponseLength); l != "" {
		current.ResponseLength = l
	}

	if err := h.repo.UpsertSettings(current); err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao salvar preferências de IA")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(current)
}
