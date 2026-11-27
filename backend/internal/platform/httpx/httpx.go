package httpx

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// ParsePositiveInt interpreta limit/offset; default quando vazio, erro quando inválido.
func ParsePositiveInt(raw string, def int) (int, error) {
	if raw == "" {
		return def, nil
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 0 {
		return def, err
	}
	return n, nil
}

// Itoa converte inteiro para string decimal.
func Itoa(n int) string {
	return strconv.Itoa(n)
}

type apiError struct {
	Error apiErrorBody `json:"error"`
}

type apiErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// WriteJSON serializa data em JSON com o status HTTP informado.
func WriteJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

// WriteJSONError serializa uma mensagem de erro padronizada em JSON.
func WriteJSONError(w http.ResponseWriter, status int, msg string) {
	WriteJSON(w, status, map[string]string{"error": msg})
}

// WriteJSONCodeError serializa um erro estruturado {error: {code, message}} em JSON.
func WriteJSONCodeError(w http.ResponseWriter, status int, code, msg string) {
	WriteJSON(w, status, apiError{Error: apiErrorBody{Code: code, Message: msg}})
}

// RespondError traduz erros de domínio para o HTTP correspondente em JSON único.
func RespondError(w http.ResponseWriter, err error) {
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
		errors.Is(err, domain.ErrMeetingSlotNotFound),
		errors.Is(err, domain.ErrP2PInviteNotFound),
		errors.Is(err, domain.ErrBotNotFound),
		errors.Is(err, domain.ErrSkillNotFound),
		errors.Is(err, domain.ErrNotificationNotFound):
		WriteJSONCodeError(w, http.StatusNotFound, "not_found", err.Error())
	case errors.Is(err, domain.ErrP2PInviteUnauthorized):
		WriteJSONCodeError(w, http.StatusForbidden, "forbidden", err.Error())
	case errors.Is(err, domain.ErrConflict),
		errors.Is(err, domain.ErrScheduleConflict),
		errors.Is(err, domain.ErrBookingTypeSlugExists),
		errors.Is(err, domain.ErrUserAlreadyExists),
		errors.Is(err, domain.ErrMeetingAlreadyConfirmed),
		errors.Is(err, domain.ErrParticipantAlreadyVoted),
		errors.Is(err, domain.ErrP2PSlotConflict),
		errors.Is(err, domain.ErrP2PInviteNotPending):
		WriteJSONCodeError(w, http.StatusConflict, "conflict", err.Error())
	case errors.Is(err, domain.ErrValidation),
		errors.Is(err, domain.ErrInvalidAutonomyMode),
		errors.Is(err, domain.ErrHolidayReadOnly),
		errors.Is(err, domain.ErrMeetingExpired),
		errors.Is(err, domain.ErrInvalidMeetingData),
		errors.Is(err, domain.ErrP2PSelfInvite),
		errors.Is(err, domain.ErrAlwaysAskPolicyViolation),
		errors.Is(err, domain.ErrInvalidActionPolicy),
		errors.Is(err, domain.ErrUnknownAction),
		errors.Is(err, domain.ErrMaxSkillsExceeded),
		errors.Is(err, domain.ErrInvalidNotificationAction),
		errors.Is(err, domain.ErrInvalidNotificationType),
		errors.Is(err, domain.ErrInvalidPlan),
		errors.Is(err, domain.ErrInvalidBillingCycle),
		errors.Is(err, domain.ErrInvalidDeleteConfirm),
		errors.Is(err, domain.ErrInvalidReportReason),
		errors.Is(err, domain.ErrInvalidSupportMsg):
		WriteJSONCodeError(w, http.StatusUnprocessableEntity, "validation", err.Error())
	default:
		WriteJSONCodeError(w, http.StatusBadRequest, "bad_request", err.Error())
	}
}
