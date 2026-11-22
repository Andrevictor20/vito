package handler

import (
	"encoding/json"
	"net/http"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

// StoreComplianceHandler expõe endpoints REST de assinatura, privacidade, LGPD e suporte (#s-store).
type StoreComplianceHandler struct {
	svc *service.StoreComplianceService
}

// NewStoreComplianceHandler instancia o handler de loja e conformidade LGPD.
func NewStoreComplianceHandler(svc *service.StoreComplianceService) *StoreComplianceHandler {
	return &StoreComplianceHandler{svc: svc}
}

// GetSubscription retorna a assinatura atual do usuário (GET /api/v1/billing/subscription).
func (h *StoreComplianceHandler) GetSubscription(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	sub, err := h.svc.GetSubscription(r.Context(), userID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "falha ao consultar assinatura")
		return
	}
	writeJSON(w, http.StatusOK, sub)
}

// UpdateSubscription ativa trial ou atualiza assinatura da loja (POST /api/v1/billing/subscription).
func (h *StoreComplianceHandler) UpdateSubscription(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	var in service.SubscriptionUpdateInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSONError(w, http.StatusBadRequest, "payload inválido")
		return
	}
	sub, err := h.svc.UpsertSubscription(r.Context(), userID, in)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sub)
}

// RestoreSubscription restaura compras prévias do usuário autenticado (POST /api/v1/billing/restore).
func (h *StoreComplianceHandler) RestoreSubscription(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	var req struct {
		StoreToken string `json:"store_token"`
	}
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&req)
	}
	restored, sub, err := h.svc.RestoreSubscription(r.Context(), userID, req.StoreToken)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "falha ao restaurar assinatura")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"restored":     restored,
		"subscription": sub,
	})
}

// GetPrivacySettings retorna as configurações de privacidade e compartilhamento (GET /api/v1/privacy/settings).
func (h *StoreComplianceHandler) GetPrivacySettings(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	ps, err := h.svc.GetPrivacySettings(r.Context(), userID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "falha ao consultar privacidade")
		return
	}
	writeJSON(w, http.StatusOK, ps)
}

// UpdatePrivacySettings atualiza compartilhamento e permissões (PUT /api/v1/privacy/settings).
func (h *StoreComplianceHandler) UpdatePrivacySettings(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	var upd domain.PrivacySettingsUpdate
	if err := json.NewDecoder(r.Body).Decode(&upd); err != nil {
		writeJSONError(w, http.StatusBadRequest, "payload inválido")
		return
	}
	ps, err := h.svc.UpdatePrivacySettings(r.Context(), userID, upd)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "falha ao salvar privacidade")
		return
	}
	writeJSON(w, http.StatusOK, ps)
}

// ExportAccount gera o pacote JSON LGPD completo do usuário (POST /api/v1/account/export).
func (h *StoreComplianceHandler) ExportAccount(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	bundle, err := h.svc.ExportAccountJSON(r.Context(), userID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "falha ao exportar dados da conta")
		return
	}
	writeJSON(w, http.StatusOK, bundle)
}

// DeleteAccount agenda a exclusão definitiva em 30 dias após confirmar "EXCLUIR" (POST /api/v1/account/delete).
func (h *StoreComplianceHandler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	var req struct {
		Confirmation string `json:"confirmation"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "payload inválido")
		return
	}
	out, err := h.svc.ScheduleAccountDeletion(r.Context(), userID, req.Confirmation)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// ContactSupport registra uma solicitação de contato com o suporte (POST /api/v1/support/contact).
func (h *StoreComplianceHandler) ContactSupport(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	var req struct {
		Subject string `json:"subject"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "payload inválido")
		return
	}
	out, err := h.svc.SubmitSupportContact(r.Context(), userID, req.Subject, req.Message)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, out)
}

// ReportAIContent registra uma denúncia de resposta gerada pela IA (POST /api/v1/ai/report).
func (h *StoreComplianceHandler) ReportAIContent(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		writeJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}
	var req struct {
		ThreadID string `json:"thread_id"`
		Reason   string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "payload inválido")
		return
	}
	out, err := h.svc.ReportAIContent(r.Context(), userID, req.ThreadID, req.Reason)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, out)
}
