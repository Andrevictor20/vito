package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

// P2PMeetingHandler expõe endpoints para matching de contatos e agendamento P2P in-app.
type P2PMeetingHandler struct {
	p2pSvc   *service.P2PMeetingService
	userRepo domain.UserRepository
}

// NewP2PMeetingHandler cria uma nova instância de P2PMeetingHandler.
func NewP2PMeetingHandler(p2pSvc *service.P2PMeetingService, userRepo domain.UserRepository) *P2PMeetingHandler {
	return &P2PMeetingHandler{
		p2pSvc:   p2pSvc,
		userRepo: userRepo,
	}
}

// GetChallenge retorna o salt criptográfico efêmero para challenge-response.
func (h *P2PMeetingHandler) GetChallenge(w http.ResponseWriter, r *http.Request) {
	salt, err := h.p2pSvc.GetContactMatchingSalt()
	if err != nil {
		respondError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"salt": salt,
	})
}

type matchContactsRequest struct {
	Salt   string   `json:"salt"`
	Hashes []string `json:"hashes"`
}

// MatchContacts busca contatos correspondentes usando hashes em tempo constante.
func (h *P2PMeetingHandler) MatchContacts(w http.ResponseWriter, r *http.Request) {
	var req matchContactsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, domain.ErrValidation)
		return
	}

	matches, err := h.p2pSvc.MatchContactsByHashes(r.Context(), req.Salt, req.Hashes)
	if err != nil {
		respondError(w, err)
		return
	}

	if matches == nil {
		matches = []domain.ContactMatchResult{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"matches": matches,
	})
}

type updatePhoneRequest struct {
	Phone string `json:"phone"`
}

// UpdatePhone atualiza o número de telefone do usuário autenticado para permitir matching P2P.
func (h *P2PMeetingHandler) UpdatePhone(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, `{"error":{"code":"unauthorized","message":"não autenticado"}}`, http.StatusUnauthorized)
		return
	}

	var req updatePhoneRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, domain.ErrValidation)
		return
	}

	phone := service.NormalizeE164Phone(req.Phone)
	if phone == "" {
		phone = req.Phone
	}

	if err := h.userRepo.UpdatePhone(userID, phone); err != nil {
		respondError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status": "updated",
		"phone":  phone,
	})
}

// GetMutualSlots calcula slots livres mútuos entre o usuário autenticado e o usuário alvo.
func (h *P2PMeetingHandler) GetMutualSlots(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, `{"error":{"code":"unauthorized","message":"não autenticado"}}`, http.StatusUnauthorized)
		return
	}

	targetUserID := r.URL.Query().Get("target_user_id")
	if targetUserID == "" {
		respondError(w, domain.ErrValidation)
		return
	}

	fromStr := r.URL.Query().Get("from")
	toStr := r.URL.Query().Get("to")

	from, err := time.Parse(time.RFC3339, fromStr)
	if err != nil {
		from = time.Now().UTC().Truncate(24 * time.Hour)
	}

	to, err := time.Parse(time.RFC3339, toStr)
	if err != nil {
		to = from.Add(24 * time.Hour)
	}

	durMin := 30
	if durStr := r.URL.Query().Get("duration"); durStr != "" {
		if d, err := strconv.Atoi(durStr); err == nil && d > 0 {
			durMin = d
		}
	}

	slots, err := h.p2pSvc.FindMutualSlots(r.Context(), userID, targetUserID, from, to, durMin)
	if err != nil {
		respondError(w, err)
		return
	}

	if slots == nil {
		slots = []domain.P2PMutualSlot{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"mutual_slots": slots,
	})
}

type sendInviteRequest struct {
	ToUserID    string    `json:"to_user_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	StartAt     time.Time `json:"start_at"`
	EndAt       time.Time `json:"end_at"`
}

// SendInvite cria e envia um convite de reunião bilateral.
func (h *P2PMeetingHandler) SendInvite(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, `{"error":{"code":"unauthorized","message":"não autenticado"}}`, http.StatusUnauthorized)
		return
	}

	var req sendInviteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, domain.ErrValidation)
		return
	}

	invite, err := h.p2pSvc.SendInvite(r.Context(), userID, req.ToUserID, req.Title, req.Description, req.StartAt, req.EndAt)
	if err != nil {
		respondError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(invite)
}

// ListPendingInvites lista os convites pendentes recebidos pelo usuário autenticado.
func (h *P2PMeetingHandler) ListPendingInvites(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, `{"error":{"code":"unauthorized","message":"não autenticado"}}`, http.StatusUnauthorized)
		return
	}

	invites, err := h.p2pSvc.ListPendingInvites(r.Context(), userID)
	if err != nil {
		respondError(w, err)
		return
	}

	if invites == nil {
		invites = []domain.P2PMeetingInvite{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(invites)
}

// ListUserInvites lista todos os convites (enviados e recebidos) do usuário autenticado.
func (h *P2PMeetingHandler) ListUserInvites(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, `{"error":{"code":"unauthorized","message":"não autenticado"}}`, http.StatusUnauthorized)
		return
	}

	invites, err := h.p2pSvc.ListUserInvites(r.Context(), userID)
	if err != nil {
		respondError(w, err)
		return
	}

	if invites == nil {
		invites = []domain.P2PMeetingInvite{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(invites)
}

// AcceptInvite aceita o convite e agenda simultaneamente nas duas agendas.
func (h *P2PMeetingHandler) AcceptInvite(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, `{"error":{"code":"unauthorized","message":"não autenticado"}}`, http.StatusUnauthorized)
		return
	}

	inviteID := chi.URLParam(r, "id")
	invite, err := h.p2pSvc.AcceptInviteWithResult(r.Context(), inviteID, userID)
	if err != nil {
		respondError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(invite)
}

// DeclineInvite recusa o convite pendente.
func (h *P2PMeetingHandler) DeclineInvite(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, `{"error":{"code":"unauthorized","message":"não autenticado"}}`, http.StatusUnauthorized)
		return
	}

	inviteID := chi.URLParam(r, "id")
	if err := h.p2pSvc.DeclineInvite(r.Context(), inviteID, userID); err != nil {
		respondError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status": "declined",
	})
}

// CancelInvite cancela o convite enviado pelo usuário.
func (h *P2PMeetingHandler) CancelInvite(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, `{"error":{"code":"unauthorized","message":"não autenticado"}}`, http.StatusUnauthorized)
		return
	}

	inviteID := chi.URLParam(r, "id")
	if err := h.p2pSvc.CancelInvite(r.Context(), inviteID, userID); err != nil {
		respondError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status": "cancelled",
	})
}
