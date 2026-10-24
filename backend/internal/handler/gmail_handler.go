package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

// GmailHandler processa as requisições HTTP da integração com o Gmail.
type GmailHandler struct {
	svc *service.GmailService
}

// NewGmailHandler cria uma nova instância do handler.
func NewGmailHandler(svc *service.GmailService) *GmailHandler {
	return &GmailHandler{svc: svc}
}

// GetStatus retorna o estado de conexão da conta do Gmail do usuário autenticado.
func (h *GmailHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	status, err := h.svc.GetStatus(r.Context(), userID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"connected":       status.Connected,
		"email":           status.Email,
		"last_scanned_at": status.LastScannedAt,
		"data":            status,
	})
}

// Disconnect remove a integração e revoga o acesso da conta.
func (h *GmailHandler) Disconnect(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	if err := h.svc.Disconnect(r.Context(), userID); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Gmail desconectado com sucesso",
		"data":    map[string]string{"message": "Gmail desconectado com sucesso"},
	})
}

// ScanEmails executa a triagem inteligente de faturas, boletos e confirmações de voo.
func (h *GmailHandler) ScanEmails(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "não autorizado"})
		return
	}

	opts := service.ScanOptions{
		Folder:     r.URL.Query().Get("folder"),
		Query:      r.URL.Query().Get("q"),
		UnreadOnly: r.URL.Query().Get("unread_only") == "true",
	}
	if opts.Folder == "" {
		opts.Folder = r.URL.Query().Get("category")
	}
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			opts.Limit = l
		}
	}

	result, err := h.svc.ScanEmailsWithOptions(r.Context(), userID, opts)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		if errors.Is(err, domain.ErrGmailNotConnected) {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "integração com Gmail não está conectada", "code": "not_connected"})
			return
		}
		if errors.Is(err, domain.ErrGmailAuthFailed) || errors.Is(err, domain.ErrGmailInvalidCredentials) {
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "autenticação do Gmail expirada ou revogada", "code": "reauth_required"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"scanned_count": result.MessagesRead,
		"bills":         result.Bills,
		"flights":       result.Flights,
		"urgent_emails": result.UrgentEmails,
		"data":          result,
	})
}

// CreateDraftRequest representa o corpo para criação de rascunhos.
type CreateDraftRequest struct {
	To      string `json:"to"`
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

// CreateDraft cria um rascunho de e-mail na conta do usuário para revisão prévia.
func (h *GmailHandler) CreateDraft(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	var req CreateDraftRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload JSON inválido"}`, http.StatusBadRequest)
		return
	}

	draftID, err := h.svc.CreateDraft(r.Context(), userID, req.To, req.Subject, req.Body)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"draft_id": draftID,
		"message":  "Rascunho criado com sucesso no Gmail",
		"data": map[string]string{
			"draft_id": draftID,
			"message":  "Rascunho criado com sucesso no Gmail",
		},
	})
}

// SendEmailRequest representa o corpo para envio imediato de e-mail.
type SendEmailRequest struct {
	To      string `json:"to"`
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

// SendEmail envia um e-mail imediatamente pela conta do Gmail conectada do usuário.
func (h *GmailHandler) SendEmail(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	var req SendEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload JSON inválido"}`, http.StatusBadRequest)
		return
	}

	msgID, err := h.svc.SendEmail(r.Context(), userID, req.To, req.Subject, req.Body)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		if errors.Is(err, domain.ErrGmailNotConnected) {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "integração com Gmail não está conectada", "code": "not_connected"})
			return
		}
		if errors.Is(err, domain.ErrGmailAuthFailed) || errors.Is(err, domain.ErrGmailInvalidCredentials) {
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "autenticação do Gmail expirada ou revogada", "code": "reauth_required"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"message_id": msgID,
		"message":    "E-mail enviado com sucesso pelo Gmail",
		"data": map[string]string{
			"message_id": msgID,
			"message":    "E-mail enviado com sucesso pelo Gmail",
		},
	})
}
