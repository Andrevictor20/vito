package handler

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

// WhatsAppHandler gerencia as rotas HTTP de integração com o WhatsApp.
type WhatsAppHandler struct {
	waSvc        *service.WhatsAppService
	contextSvc   *service.WhatsAppContextService
	directorySvc *service.WhatsAppDirectoryService
	backupMgr    *database.BackupManager
}

// NewWhatsAppHandler instancia o handler para rotas de WhatsApp.
func NewWhatsAppHandler(waSvc *service.WhatsAppService) *WhatsAppHandler {
	return &WhatsAppHandler{waSvc: waSvc}
}

// SetContextService injeta o serviço de contexto conversacional do WhatsApp.
func (h *WhatsAppHandler) SetContextService(contextSvc *service.WhatsAppContextService) {
	h.contextSvc = contextSvc
}

// SetDirectoryService injeta o diretório de conversas do WhatsApp.
func (h *WhatsAppHandler) SetDirectoryService(directorySvc *service.WhatsAppDirectoryService) {
	h.directorySvc = directorySvc
}

// SetBackupManager injeta o gerenciador de backups.
//
// Necessário para a privacidade: o backup é de arquivo, então as cópias
// criptografadas continuariam contendo as mensagens que o usuário mandou
// apagar. "Limpar histórico" invalida os snapshots.
func (h *WhatsAppHandler) SetBackupManager(backupMgr *database.BackupManager) {
	h.backupMgr = backupMgr
}

type requestPairingCodeInput struct {
	Phone string `json:"phone"`
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

// RequestPairingCode gera ou recupera o código de pareamento de 8 dígitos para o WhatsApp do usuário.
func (h *WhatsAppHandler) RequestPairingCode(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "não autorizado"})
		return
	}

	var input requestPairingCodeInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "payload JSON inválido"})
		return
	}

	if input.Phone == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "o campo 'phone' é obrigatório"})
		return
	}

	code, err := h.waSvc.RequestPairingCode(r.Context(), userID, input.Phone)
	if err != nil {
		if err == domain.ErrWhatsAppInvalidPhone {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "número de telefone inválido"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"pairing_code": code,
		"status":       domain.WhatsAppStatusConnecting,
	})
}

// GetStatus retorna o estado atual da conexão com o WhatsApp.
func (h *WhatsAppHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "não autorizado"})
		return
	}

	status, err := h.waSvc.GetStatus(r.Context(), userID)
	if err != nil {
		if err == domain.ErrWhatsAppIntegrationNotFound {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"status": domain.WhatsAppStatusDisconnected,
			})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "falha ao buscar status do whatsapp"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":                status.ID,
		"status":            status.Status,
		"phone":             status.Phone,
		"pairing_code":      status.PairingCode,
		"last_connected_at": status.LastConnectedAt,
	})
}

// Disconnect desconecta a sessão ativa do WhatsApp.
func (h *WhatsAppHandler) Disconnect(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "não autorizado"})
		return
	}

	if err := h.waSvc.Disconnect(r.Context(), userID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "falha ao desconectar whatsapp"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "WhatsApp desconectado com sucesso",
		"status":  domain.WhatsAppStatusDisconnected,
	})
}

// GetContacts retorna os contatos do WhatsApp que possuem conta ativa no Vito.
func (h *WhatsAppHandler) GetContacts(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "não autorizado"})
		return
	}

	matches, err := h.waSvc.MatchWhatsAppContacts(r.Context(), userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "falha ao buscar contatos do whatsapp"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"contacts": matches,
		"count":    len(matches),
	})
}

// Webhook recebe notificações assíncronas enviadas pela Evolution API v2.
func (h *WhatsAppHandler) Webhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "falha ao ler corpo da requisição"})
		return
	}

	eventType := r.Header.Get("x-event-type")
	_ = h.waSvc.HandleWebhook(r.Context(), eventType, body)

	writeJSON(w, http.StatusOK, map[string]string{"status": "received"})
}

type contextSettingsInput struct {
	Scope      string `json:"scope"`
	WindowSize int    `json:"window_size"`
}

// GetContextSettings devolve o escopo e o tamanho da janela de contexto do WhatsApp.
func (h *WhatsAppHandler) GetContextSettings(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "não autorizado"})
		return
	}
	if h.contextSvc == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "contexto do WhatsApp indisponível"})
		return
	}

	settings, err := h.contextSvc.Settings(r.Context(), userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "falha ao ler as preferências de contexto"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"scope":       settings.Scope,
		"window_size": settings.WindowSize,
	})
}

// UpdateContextSettings atualiza o escopo e o tamanho da janela de contexto.
func (h *WhatsAppHandler) UpdateContextSettings(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "não autorizado"})
		return
	}
	if h.contextSvc == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "contexto do WhatsApp indisponível"})
		return
	}

	var input contextSettingsInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "payload JSON inválido"})
		return
	}

	settings, err := h.contextSvc.UpdateSettings(r.Context(), userID, input.Scope, input.WindowSize)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"scope":       settings.Scope,
		"window_size": settings.WindowSize,
	})
}

// GetContextPreview mostra ao usuário o que o Vito está enxergando agora:
// quantas mensagens estão arquivadas, quantas entram na janela e de quais chats.
func (h *WhatsAppHandler) GetContextPreview(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "não autorizado"})
		return
	}
	if h.contextSvc == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "contexto do WhatsApp indisponível"})
		return
	}

	preview, err := h.contextSvc.Preview(r.Context(), userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "falha ao montar a prévia do contexto"})
		return
	}
	writeJSON(w, http.StatusOK, preview)
}

// GetContextDirectory devolve o diretório de contatos e as pendências de resposta.
func (h *WhatsAppHandler) GetContextDirectory(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "não autorizado"})
		return
	}
	if h.directorySvc == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "diretório do WhatsApp indisponível"})
		return
	}

	preview, err := h.directorySvc.Preview(r.Context(), userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "falha ao montar o diretório de conversas"})
		return
	}
	writeJSON(w, http.StatusOK, preview)
}

// PurgeContextMessages apaga todo o histórico de conversa arquivado do WhatsApp.
func (h *WhatsAppHandler) PurgeContextMessages(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "não autorizado"})
		return
	}
	if h.contextSvc == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "contexto do WhatsApp indisponível"})
		return
	}

	if err := h.contextSvc.PurgeMessages(r.Context(), userID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "falha ao limpar o histórico do WhatsApp"})
		return
	}

	// As cópias criptografadas do banco também continham as mensagens apagadas.
	invalidated := 0
	if h.backupMgr != nil {
		if n, err := h.backupMgr.InvalidateSnapshots(); err == nil {
			invalidated = n
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":             "Histórico do WhatsApp limpo com sucesso",
		"backups_invalidated": invalidated,
	})
}
