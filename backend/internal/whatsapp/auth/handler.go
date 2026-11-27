package auth

import (
	"encoding/json"
	"errors"
	"github.com/andrevmp/vito/backend/internal/platform/httpx"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
)

// WhatsAppAuthHandler gerencia as rotas de login sem senha por OTP do WhatsApp.
type WhatsAppAuthHandler struct {
	svc *WhatsAppAuthService
}

// NewWhatsAppAuthHandler instancia o handler.
func NewWhatsAppAuthHandler(svc *WhatsAppAuthService) *WhatsAppAuthHandler {
	return &WhatsAppAuthHandler{svc: svc}
}

type requestOTPPayload struct {
	Phone string `json:"phone"`
}

// writeAuthError responde sempre com JSON válido (o corpo precisa ser parseável pelo app
// para exibir a mensagem real e reagir conforme o código do erro).
func writeAuthError(w http.ResponseWriter, status int, message, code, action string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	payload := map[string]string{"error": message}
	if code != "" {
		payload["code"] = code
	}
	if action != "" {
		payload["action"] = action
	}
	_ = json.NewEncoder(w).Encode(payload)
}

// RequestOTP solicita o envio de um código de 6 dígitos via WhatsApp.
func (h *WhatsAppAuthHandler) RequestOTP(w http.ResponseWriter, r *http.Request) {
	var req requestOTPPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeAuthError(w, http.StatusBadRequest, "payload JSON inválido", "INVALID_PAYLOAD", "")
		return
	}

	if strings.TrimSpace(req.Phone) == "" {
		writeAuthError(w, http.StatusBadRequest, "telefone é obrigatório", "PHONE_REQUIRED", "")
		return
	}

	err := h.svc.RequestOTP(r.Context(), req.Phone)
	if err != nil {
		if errors.Is(err, domain.ErrInvalidPhoneFormat) {
			writeAuthError(w, http.StatusBadRequest, "formato de telefone inválido", "INVALID_PHONE", "")
			return
		}
		if errors.Is(err, domain.ErrOTPRateLimited) {
			writeAuthError(w, http.StatusTooManyRequests, "aguarde 30 segundos antes de solicitar um novo código", "RATE_LIMITED", "")
			return
		}
		if errors.Is(err, domain.ErrPhoneNotLinked) {
			writeAuthError(w, http.StatusForbidden,
				"Este número ainda não tem conta no Vito.",
				"PHONE_NOT_LINKED", "register")
			return
		}
		writeAuthError(w, http.StatusInternalServerError, "falha ao enviar código pelo WhatsApp: "+err.Error(), "SEND_FAILED", "")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"data": map[string]string{
			"message": "Código de acesso enviado com sucesso para o seu WhatsApp",
		},
	})
}

type verifyOTPPayload struct {
	Phone      string `json:"phone"`
	Code       string `json:"code"`
	DeviceName string `json:"device_name"`
}

// VerifyOTP valida o código OTP, autentica o usuário e emite a sessão Dual Token.
func (h *WhatsAppAuthHandler) VerifyOTP(w http.ResponseWriter, r *http.Request) {
	var req verifyOTPPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload JSON inválido")
		return
	}

	if strings.TrimSpace(req.Phone) == "" || strings.TrimSpace(req.Code) == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "telefone e código são obrigatórios")
		return
	}

	deviceName := strings.TrimSpace(req.DeviceName)
	if deviceName == "" {
		deviceName = r.Header.Get("X-Device-Name")
	}
	if deviceName == "" {
		deviceName = r.UserAgent()
	}
	if deviceName == "" {
		deviceName = "Dispositivo Desconhecido"
	}
	ipAddress := r.RemoteAddr
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		ipAddress = strings.Split(forwarded, ",")[0]
	}

	tokens, user, err := h.svc.VerifyOTP(r.Context(), req.Phone, req.Code, deviceName, ipAddress)
	if err != nil {
		if errors.Is(err, domain.ErrOTPInvalid) || errors.Is(err, domain.ErrOTPExpired) || errors.Is(err, domain.ErrOTPNotFound) {
			writeAuthError(w, http.StatusUnauthorized, err.Error(), "OTP_INVALID", "")
			return
		}
		if errors.Is(err, domain.ErrOTPMaxAttempts) {
			writeAuthError(w, http.StatusTooManyRequests, "limite de tentativas excedido para este código", "OTP_MAX_ATTEMPTS", "")
			return
		}
		if errors.Is(err, domain.ErrInvalidPhoneFormat) {
			writeAuthError(w, http.StatusBadRequest, "formato de telefone inválido", "INVALID_PHONE", "")
			return
		}
		if errors.Is(err, domain.ErrPhoneNotLinked) {
			writeAuthError(w, http.StatusForbidden,
				"Este número ainda não tem conta no Vito.",
				"PHONE_NOT_LINKED", "register")
			return
		}
		writeAuthError(w, http.StatusInternalServerError, err.Error(), "VERIFY_FAILED", "")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"data": map[string]interface{}{
			"user":       user,
			"token_pair": tokens,
		},
	})
}

type linkPhonePayload struct {
	Phone string `json:"phone"`
}

// LinkPhone associa o telefone à conta do usuário autenticado.
func (h *WhatsAppAuthHandler) LinkPhone(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autenticado")
		return
	}

	var req linkPhonePayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload JSON inválido")
		return
	}

	if strings.TrimSpace(req.Phone) == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "telefone é obrigatório")
		return
	}

	err := h.svc.LinkPhone(r.Context(), userID, req.Phone)
	if err != nil {
		if errors.Is(err, domain.ErrInvalidPhoneFormat) {
			writeAuthError(w, http.StatusBadRequest, "formato de telefone inválido", "INVALID_PHONE", "")
			return
		}
		if errors.Is(err, domain.ErrUserAlreadyExists) {
			writeAuthError(w, http.StatusConflict, "este número de telefone já está vinculado a outra conta", "PHONE_TAKEN", "")
			return
		}
		if errors.Is(err, domain.ErrUserNotFound) {
			writeAuthError(w, http.StatusNotFound, "usuário não encontrado", "USER_NOT_FOUND", "")
			return
		}
		if errors.Is(err, domain.ErrPhoneNotVerified) {
			writeAuthError(w, http.StatusForbidden,
				"Não foi possível confirmar a posse deste número. Pareie o seu WhatsApp ou use a confirmação de telefone para vincular.",
				"PHONE_NOT_VERIFIED", "verify_phone")
			return
		}
		writeAuthError(w, http.StatusInternalServerError, "falha ao vincular telefone: "+err.Error(), "LINK_FAILED", "")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"data": map[string]string{
			"status":  "linked",
			"message": "Telefone vinculado com sucesso à sua conta",
		},
	})
}

// RegisterPublicRoutes registra as rotas públicas de login sem senha via WhatsApp OTP.
func (h *WhatsAppAuthHandler) RegisterPublicRoutes(r chi.Router) {
	if h == nil {
		return
	}
	r.Post("/auth/whatsapp/request-otp", h.RequestOTP)
	r.Post("/auth/whatsapp/verify-otp", h.VerifyOTP)
}

// RegisterProtectedRoutes registra a rota protegida de vinculação de telefone via OTP.
func (h *WhatsAppAuthHandler) RegisterProtectedRoutes(r chi.Router) {
	if h == nil {
		return
	}
	r.Post("/auth/whatsapp/link", h.LinkPhone)
}
