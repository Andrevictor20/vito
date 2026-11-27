package handler

import (
	"encoding/json"
	"github.com/andrevmp/vito/backend/internal/platform/httpx"
	"net/http"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
)

// BriefingHandler expõe endpoints para consulta e atualização das preferências do briefing matinal.
type BriefingHandler struct {
	briefingRepo domain.BriefingRepository
}

// NewBriefingHandler cria uma nova instância de BriefingHandler.
func NewBriefingHandler(briefingRepo domain.BriefingRepository) *BriefingHandler {
	return &BriefingHandler{briefingRepo: briefingRepo}
}

type updateBriefingRequest struct {
	Enabled          *bool  `json:"enabled"`
	ScheduledTime    string `json:"scheduled_time"`
	WakeupAlarmEarly *bool  `json:"wakeup_alarm_early"`
}

// GetSettings retorna as configurações de briefing do usuário logado.
func (h *BriefingHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	settings, err := h.briefingRepo.GetSettings(userID)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao carregar configurações de briefing")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(settings)
}

// UpdateSettings atualiza as configurações de briefing do usuário logado.
func (h *BriefingHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	var req updateBriefingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload inválido")
		return
	}

	if req.ScheduledTime != "" {
		if _, err := time.Parse("15:04", req.ScheduledTime); err != nil {
			httpx.WriteJSONError(w, http.StatusBadRequest, "formato de horário inválido (esperado HH:MM)")
			return
		}
	}

	current, err := h.briefingRepo.GetSettings(userID)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao recuperar configurações atuais")
		return
	}

	if req.Enabled != nil {
		current.Enabled = *req.Enabled
	}
	if req.ScheduledTime != "" {
		current.ScheduledTime = req.ScheduledTime
	}
	if req.WakeupAlarmEarly != nil {
		current.WakeupAlarmEarly = *req.WakeupAlarmEarly
	}

	if err := h.briefingRepo.UpsertSettings(current); err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "falha ao salvar configurações")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(current)
}
