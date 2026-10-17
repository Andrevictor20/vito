package handler

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
	DeviceName   string `json:"device_name,omitempty"`
}

type logoutRequest struct {
	RefreshToken string `json:"refresh_token,omitempty"`
	AllOthers    bool   `json:"all_others,omitempty"`
}

func buildAuthResponse(user *domain.User, pair *service.TokenPair) authResponse {
	if pair == nil {
		return authResponse{User: user}
	}
	return authResponse{
		User:         user,
		Token:        pair.AccessToken,
		AccessToken:  pair.AccessToken,
		RefreshToken: pair.RefreshToken,
		SessionID:    pair.SessionID,
		ExpiresIn:    pair.ExpiresIn,
	}
}

func resolveDeviceName(explicit string, r *http.Request) string {
	if strings.TrimSpace(explicit) != "" {
		return strings.TrimSpace(explicit)
	}
	ua := strings.ToLower(r.Header.Get("User-Agent"))
	switch {
	case strings.Contains(ua, "android"):
		return "Android (Vito App)"
	case strings.Contains(ua, "iphone") || strings.Contains(ua, "ipad") || strings.Contains(ua, "ios"):
		return "iPhone / iOS (Vito App)"
	case strings.Contains(ua, "macintosh") || strings.Contains(ua, "mac os"):
		return "Navegador Web (macOS)"
	case strings.Contains(ua, "windows"):
		return "Navegador Web (Windows)"
	case strings.Contains(ua, "linux"):
		return "Navegador Web (Linux)"
	case strings.Contains(ua, "okhttp") || strings.Contains(ua, "expo"):
		return "Celular (Vito Mobile)"
	default:
		return "Dispositivo Vito"
	}
}

func extractClientIP(r *http.Request) string {
	if xff := strings.TrimSpace(r.Header.Get("CF-Connecting-IP")); xff != "" {
		return xff
	}
	if xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}
	return strings.TrimSpace(r.RemoteAddr)
}

// Refresh renova o par Access + Refresh Token aplicando Refresh Token Rotation (POST /api/v1/auth/refresh).
func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.RefreshToken) == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "refresh_token é obrigatório"})
		return
	}

	user, pair, err := h.authSvc.RefreshSession(req.RefreshToken, resolveDeviceName(req.DeviceName, r), extractClientIP(r))
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(buildAuthResponse(user, pair))
}

// ListSessions retorna todos os dispositivos conectados do usuário autenticado (GET /api/v1/auth/sessions).
func (h *AuthHandler) ListSessions(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	currentSessionID := middleware.SessionIDFromContext(r.Context())
	if currentSessionID == "" {
		currentSessionID = strings.TrimSpace(r.Header.Get("X-Session-ID"))
	}

	sessions, err := h.authSvc.ListSessions(userID, currentSessionID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "falha ao listar dispositivos conectados"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"sessions":           sessions,
		"current_session_id": currentSessionID,
	})
}

// RevokeSession desconecta um dispositivo específico ou todos os outros (DELETE /api/v1/auth/sessions/{id}).
func (h *AuthHandler) RevokeSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	sessionID := strings.TrimSpace(chi.URLParam(r, "id"))
	if sessionID == "" {
		http.Error(w, `{"error":"id da sessão é obrigatório"}`, http.StatusBadRequest)
		return
	}

	if sessionID == "others" {
		currentSessionID := middleware.SessionIDFromContext(r.Context())
		if err := h.authSvc.RevokeOtherSessions(userID, currentSessionID); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "revoked_others"})
		return
	}

	if err := h.authSvc.RevokeSession(userID, sessionID); err != nil {
		w.Header().Set("Content-Type", "application/json")
		if err == domain.ErrRefreshTokenNotFound {
			w.WriteHeader(http.StatusNotFound)
		} else {
			w.WriteHeader(http.StatusInternalServerError)
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "revoked", "id": sessionID})
}

// Logout encerra a sessão atual ou todas as outras sessões (POST /api/v1/auth/logout).
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	var req logoutRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	currentSessionID := middleware.SessionIDFromContext(r.Context())
	if req.AllOthers {
		_ = h.authSvc.RevokeOtherSessions(userID, currentSessionID)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "revoked_others"})
		return
	}

	_ = h.authSvc.LogoutSession(userID, currentSessionID, req.RefreshToken)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "logged_out"})
}
