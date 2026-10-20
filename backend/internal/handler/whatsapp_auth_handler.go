package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

// WhatsAppAuthHandler gerencia as rotas de login sem senha por OTP do WhatsApp.
type WhatsAppAuthHandler struct {
	svc *service.WhatsAppAuthService
}

// NewWhatsAppAuthHandler instancia o handler.
func NewWhatsAppAuthHandler(svc *service.WhatsAppAuthService) *WhatsAppAuthHandler {
	return &WhatsAppAuthHandler{svc: svc}
}

type requestOTPPayload struct {
	Phone string `json:"phone"`
}

// RequestOTP solicita o envio de um código de 6 dígitos via WhatsApp.
func (h *WhatsAppAuthHandler) RequestOTP(w http.ResponseWriter, r *http.Request) {
	var req requestOTPPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload JSON inválido"}`, http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Phone) == "" {
		http.Error(w, `{"error":"telefone é obrigatório"}`, http.StatusBadRequest)
		return
	}

	err := h.svc.RequestOTP(r.Context(), req.Phone)
	if err != nil {
		if errors.Is(err, domain.ErrInvalidPhoneFormat) {
			http.Error(w, `{"error":"formato de telefone inválido"}`, http.StatusBadRequest)
			return
		}
		if errors.Is(err, domain.ErrOTPRateLimited) {
			http.Error(w, `{"error":"aguarde 30 segundos antes de solicitar um novo código"}`, http.StatusTooManyRequests)
			return
		}
		http.Error(w, `{"error":"falha ao enviar código pelo WhatsApp: `+err.Error()+`"}`, http.StatusInternalServerError)
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
		http.Error(w, `{"error":"payload JSON inválido"}`, http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Phone) == "" || strings.TrimSpace(req.Code) == "" {
		http.Error(w, `{"error":"telefone e código são obrigatórios"}`, http.StatusBadRequest)
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
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusUnauthorized)
			return
		}
		if errors.Is(err, domain.ErrOTPMaxAttempts) {
			http.Error(w, `{"error":"limite de tentativas excedido para este código"}`, http.StatusTooManyRequests)
			return
		}
		if errors.Is(err, domain.ErrInvalidPhoneFormat) {
			http.Error(w, `{"error":"formato de telefone inválido"}`, http.StatusBadRequest)
			return
		}
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
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
		http.Error(w, `{"error":"não autenticado"}`, http.StatusUnauthorized)
		return
	}

	var req linkPhonePayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload JSON inválido"}`, http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Phone) == "" {
		http.Error(w, `{"error":"telefone é obrigatório"}`, http.StatusBadRequest)
		return
	}

	err := h.svc.LinkPhone(r.Context(), userID, req.Phone)
	if err != nil {
		if errors.Is(err, domain.ErrInvalidPhoneFormat) {
			http.Error(w, `{"error":"formato de telefone inválido"}`, http.StatusBadRequest)
			return
		}
		if errors.Is(err, domain.ErrUserAlreadyExists) {
			http.Error(w, `{"error":"este número de telefone já está vinculado a outra conta"}`, http.StatusConflict)
			return
		}
		if errors.Is(err, domain.ErrUserNotFound) {
			http.Error(w, `{"error":"usuário não encontrado"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"falha ao vincular telefone: `+err.Error()+`"}`, http.StatusInternalServerError)
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
