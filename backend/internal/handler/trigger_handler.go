package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

type TriggerHandler struct {
	triggerSvc *service.TriggerService
}

func NewTriggerHandler(triggerSvc *service.TriggerService) *TriggerHandler {
	return &TriggerHandler{triggerSvc: triggerSvc}
}

type createTriggerRequest struct {
	Title         string                      `json:"title"`
	Category      domain.TriggerCategory      `json:"category"`
	Query         string                      `json:"query"`
	ConditionType domain.TriggerConditionType `json:"condition_type"`
	TargetValue   string                      `json:"target_value"`
	Frequency     domain.TriggerFrequency     `json:"frequency"`
}

func (h *TriggerHandler) CreateTrigger(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	var req createTriggerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload inválido"}`, http.StatusBadRequest)
		return
	}

	trigger, err := h.triggerSvc.CreateTrigger(userID, domain.CreateTriggerInput{
		Title:         req.Title,
		Category:      req.Category,
		Query:         req.Query,
		ConditionType: req.ConditionType,
		TargetValue:   req.TargetValue,
		Frequency:     req.Frequency,
	})
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(trigger)
}

func (h *TriggerHandler) ListTriggers(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	cat := domain.TriggerCategory(r.URL.Query().Get("category"))
	status := domain.TriggerStatus(r.URL.Query().Get("status"))

	triggers, err := h.triggerSvc.ListTriggers(userID, cat, status)
	if err != nil {
		http.Error(w, `{"error":"falha ao listar disparadores"}`, http.StatusInternalServerError)
		return
	}

	if triggers == nil {
		triggers = []domain.Trigger{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(triggers)
}

func (h *TriggerHandler) GetTrigger(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	trigger, err := h.triggerSvc.GetTrigger(id, userID)
	if err != nil {
		http.Error(w, `{"error":"disparador não encontrado"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(trigger)
}

func (h *TriggerHandler) ToggleStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	trigger, err := h.triggerSvc.ToggleStatus(id, userID)
	if err != nil {
		http.Error(w, `{"error":"falha ao alternar status do disparador"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(trigger)
}

type updateTriggerRequest struct {
	Title         *string                      `json:"title"`
	Category      *domain.TriggerCategory      `json:"category"`
	Query         *string                      `json:"query"`
	ConditionType *domain.TriggerConditionType `json:"condition_type"`
	TargetValue   *string                      `json:"target_value"`
	Frequency     *domain.TriggerFrequency     `json:"frequency"`
	Status        *domain.TriggerStatus        `json:"status"`
}

func (h *TriggerHandler) UpdateTrigger(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	var req updateTriggerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload inválido"}`, http.StatusBadRequest)
		return
	}

	trigger, err := h.triggerSvc.UpdateTrigger(id, userID, domain.UpdateTriggerInput{
		Title:         req.Title,
		Category:      req.Category,
		Query:         req.Query,
		ConditionType: req.ConditionType,
		TargetValue:   req.TargetValue,
		Frequency:     req.Frequency,
		Status:        req.Status,
	})
	if err != nil {
		http.Error(w, `{"error":"falha ao atualizar disparador"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(trigger)
}

func (h *TriggerHandler) DeleteTrigger(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	if err := h.triggerSvc.DeleteTrigger(id, userID); err != nil {
		http.Error(w, `{"error":"falha ao excluir disparador"}`, http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *TriggerHandler) ListLogs(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	id := chi.URLParam(r, "id")
	logs, err := h.triggerSvc.ListTriggerLogs(id, userID)
	if err != nil {
		http.Error(w, `{"error":"falha ao listar logs"}`, http.StatusInternalServerError)
		return
	}

	if logs == nil {
		logs = []domain.TriggerLog{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(logs)
}

type parsePromptRequest struct {
	Prompt string `json:"prompt"`
}

type parsePromptResponse struct {
	Category      domain.TriggerCategory      `json:"category"`
	SuggestedTitle string                     `json:"suggested_title"`
	Query         string                      `json:"query"`
	ConditionType domain.TriggerConditionType `json:"condition_type"`
}

func (h *TriggerHandler) ParsePrompt(w http.ResponseWriter, r *http.Request) {
	var req parsePromptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Prompt == "" {
		http.Error(w, `{"error":"prompt obrigatório"}`, http.StatusBadRequest)
		return
	}

	cat := service.HeuristicClassifyCategory(req.Prompt)
	res := parsePromptResponse{
		Category:       cat,
		SuggestedTitle: req.Prompt,
		Query:          req.Prompt,
		ConditionType:  domain.ConditionDailyBrief,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}
