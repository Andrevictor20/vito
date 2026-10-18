package handler

import (
	"encoding/json"
	"net/http"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

type AuthHandler struct {
	authSvc  *service.AuthService
	userRepo domain.UserRepository
}

func NewAuthHandler(authSvc *service.AuthService, userRepo domain.UserRepository) *AuthHandler {
	return &AuthHandler{
		authSvc:  authSvc,
		userRepo: userRepo,
	}
}

type registerRequest struct {
	Name       string `json:"name"`
	Email      string `json:"email"`
	Password   string `json:"password"`
	DeviceName string `json:"device_name,omitempty"`
}

type loginRequest struct {
	Email      string `json:"email"`
	Password   string `json:"password"`
	DeviceName string `json:"device_name,omitempty"`
}

type authResponse struct {
	User         *domain.User `json:"user"`
	Token        string       `json:"token"`
	AccessToken  string       `json:"access_token,omitempty"`
	RefreshToken string       `json:"refresh_token,omitempty"`
	SessionID    string       `json:"session_id,omitempty"`
	ExpiresIn    int          `json:"expires_in,omitempty"`
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload inválido"}`, http.StatusBadRequest)
		return
	}

	user, pair, err := h.authSvc.RegisterWithSession(req.Name, req.Email, req.Password, resolveDeviceName(req.DeviceName, r), extractClientIP(r))
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		if err == domain.ErrUserAlreadyExists {
			w.WriteHeader(http.StatusConflict)
		} else {
			w.WriteHeader(http.StatusBadRequest)
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(buildAuthResponse(user, pair))
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload inválido"}`, http.StatusBadRequest)
		return
	}

	user, pair, err := h.authSvc.LoginWithSession(req.Email, req.Password, resolveDeviceName(req.DeviceName, r), extractClientIP(r))
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(buildAuthResponse(user, pair))
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	user, err := h.userRepo.GetByID(userID)
	if err != nil {
		http.Error(w, `{"error":"usuário não encontrado"}`, http.StatusNotFound)
		return
	}

	currentSessionID := middleware.SessionIDFromContext(r.Context())
	resMap := map[string]interface{}{
		"user": user,
	}

	// Auto-upgrade de sessão (Sprint 13 / Fix Session Persistence):
	// Se o usuário autenticou com um token legado sem session_id (ex: Google OAuth anterior),
	// emitimos atomicamente uma sessão Dual Token (Refresh Token 30d) para que o app nunca deslogue.
	if currentSessionID == "" && h.authSvc != nil {
		pair, err := h.authSvc.IssueSessionForUser(user, resolveDeviceName("", r), extractClientIP(r))
		if err == nil && pair != nil {
			resMap["token"] = pair.AccessToken
			resMap["access_token"] = pair.AccessToken
			resMap["refresh_token"] = pair.RefreshToken
			resMap["session_id"] = pair.SessionID
			resMap["expires_in"] = pair.ExpiresIn
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resMap)
}
