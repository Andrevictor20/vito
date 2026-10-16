package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// apiError padroniza o corpo de erro (BACK-04).
type apiError struct {
	Error apiErrorBody `json:"error"`
}

type apiErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// respondError traduz erros de domínio para o HTTP correspondente em JSON único.
func respondError(w http.ResponseWriter, err error) {
	w.Header().Set("Content-Type", "application/json")
	switch {
	case errors.Is(err, domain.ErrTodoNotFound),
		errors.Is(err, domain.ErrSubtaskNotFound),
		errors.Is(err, domain.ErrEventNotFound),
		errors.Is(err, domain.ErrMemoryNotFound),
		errors.Is(err, domain.ErrPendingItemNotFound),
		errors.Is(err, domain.ErrTriggerNotFound),
		errors.Is(err, domain.ErrChatSessionNotFound),
		errors.Is(err, domain.ErrIntegrationNotFound),
		errors.Is(err, domain.ErrMeetingNotFound),
		errors.Is(err, domain.ErrMeetingSlotNotFound):
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(apiError{Error: apiErrorBody{Code: "not_found", Message: err.Error()}})
	case errors.Is(err, domain.ErrConflict),
		errors.Is(err, domain.ErrScheduleConflict),
		errors.Is(err, domain.ErrBookingTypeSlugExists),
		errors.Is(err, domain.ErrUserAlreadyExists),
		errors.Is(err, domain.ErrMeetingAlreadyConfirmed),
		errors.Is(err, domain.ErrParticipantAlreadyVoted):
		w.WriteHeader(http.StatusConflict)
		_ = json.NewEncoder(w).Encode(apiError{Error: apiErrorBody{Code: "conflict", Message: err.Error()}})
	case errors.Is(err, domain.ErrValidation),
		errors.Is(err, domain.ErrInvalidAutonomyMode),
		errors.Is(err, domain.ErrHolidayReadOnly),
		errors.Is(err, domain.ErrMeetingExpired),
		errors.Is(err, domain.ErrInvalidMeetingData):
		w.WriteHeader(http.StatusUnprocessableEntity)
		_ = json.NewEncoder(w).Encode(apiError{Error: apiErrorBody{Code: "validation", Message: err.Error()}})
	default:
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(apiError{Error: apiErrorBody{Code: "bad_request", Message: err.Error()}})
	}
}
