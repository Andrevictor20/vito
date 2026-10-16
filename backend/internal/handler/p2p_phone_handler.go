package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
)

type verifyPhoneCodeRequest struct {
	Code  string `json:"code"`
	Token string `json:"token"`
}

func resolvePublicBaseURL(r *http.Request) string {
	scheme := "https"
	if proto := r.Header.Get("X-Forwarded-Proto"); proto != "" {
		scheme = proto
	} else if r.TLS == nil && (strings.HasPrefix(r.Host, "localhost") || strings.HasPrefix(r.Host, "127.0.0.1")) {
		scheme = "http"
	}
	if r.Host != "" {
		return fmt.Sprintf("%s://%s", scheme, r.Host)
	}
	return "https://vito.rasppi.cloud"
}

// RequestPhoneVerification gera token e link do WhatsApp para confirmação ativa do número de telefone.
func (h *P2PMeetingHandler) RequestPhoneVerification(w http.ResponseWriter, r *http.Request) {
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

	challenge, err := h.p2pSvc.RequestPhoneVerification(r.Context(), userID, req.Phone, resolvePublicBaseURL(r))
	if err != nil {
		if errors.Is(err, domain.ErrUserAlreadyExists) {
			http.Error(w, `{"error":{"code":"conflict","message":"este número de telefone já está vinculado a outra conta"}}`, http.StatusConflict)
			return
		}
		respondError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(challenge)
}

// VerifyPhoneCode confirma o telefone via código de 6 dígitos ou consulta se o link do WhatsApp já foi confirmado.
func (h *P2PMeetingHandler) VerifyPhoneCode(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, `{"error":{"code":"unauthorized","message":"não autenticado"}}`, http.StatusUnauthorized)
		return
	}

	var req verifyPhoneCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, domain.ErrValidation)
		return
	}

	// Se enviou o código de 6 dígitos, confirma pelo código
	if strings.TrimSpace(req.Code) != "" {
		ch, err := h.p2pSvc.ConfirmPhoneVerificationByCode(r.Context(), userID, req.Code)
		if err != nil {
			if errors.Is(err, domain.ErrPhoneVerificationInvalid) {
				http.Error(w, `{"error":{"code":"invalid_code","message":"código inválido ou expirado"}}`, http.StatusBadRequest)
				return
			}
			respondError(w, err)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":   "verified",
			"verified": true,
			"phone":    ch.Phone,
		})
		return
	}

	// Se enviou o token, verifica se já foi confirmado via clique no link do WhatsApp
	if strings.TrimSpace(req.Token) != "" {
		ch, err := h.p2pSvc.GetPhoneVerificationStatus(r.Context(), userID, req.Token)
		if err != nil {
			http.Error(w, `{"error":{"code":"invalid_token","message":"sessão de verificação não encontrada"}}`, http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		status := "pending"
		if ch.Verified {
			status = "verified"
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":   status,
			"verified": ch.Verified,
			"phone":    ch.Phone,
		})
		return
	}

	respondError(w, domain.ErrValidation)
}

// VerifyPhonePublicPage confirma o telefone quando o usuário toca no link mágico enviado no WhatsApp.
func (h *P2PMeetingHandler) VerifyPhonePublicPage(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	ch, err := h.p2pSvc.ConfirmPhoneVerificationByToken(r.Context(), token)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(renderPhoneVerifyHTML(false, "", "Link de verificação inválido ou expirado. Solicite uma nova confirmação no aplicativo Vito.")))
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(renderPhoneVerifyHTML(true, ch.Phone, fmt.Sprintf("Código %s validado com sucesso. Você já pode voltar para o aplicativo Vito.", ch.Code))))
}

func renderPhoneVerifyHTML(success bool, phone, message string) string {
	title := "Telefone Confirmado ✓"
	badgeColor := "#34D399"
	icon := "✓"
	if !success {
		title = "Verificação Expirada"
		badgeColor = "#F87171"
		icon = "!"
	}
	phoneBlock := ""
	if phone != "" {
		phoneBlock = fmt.Sprintf(`<div class="phone-pill">%s</div>`, html.EscapeString(phone))
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>%s — Vito</title>
  <style>
    :root { --bg: #0B0D10; --surface: #14171C; --border: #22262F; --text: #F3F4F6; --muted: #9CA3AF; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; max-width: 420px; width: 100%%; padding: 32px 24px; text-align: center; box-shadow: 0 24px 48px rgba(0,0,0,0.45); }
    .icon { width: 56px; height: 56px; border-radius: 28px; background: rgba(52,211,153,0.12); color: %s; border: 1px solid %s; display: inline-flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 800; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 10px; }
    .phone-pill { display: inline-block; background: #1C2026; border: 1px solid var(--border); border-radius: 12px; padding: 8px 16px; font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; margin-bottom: 14px; color: #FFFFFF; }
    p { font-size: 14px; color: var(--muted); line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">%s</div>
    <h1>%s</h1>
    %s
    <p>%s</p>
  </div>
</body>
</html>`,
		html.EscapeString(title),
		badgeColor,
		badgeColor,
		icon,
		html.EscapeString(title),
		phoneBlock,
		html.EscapeString(message),
	)
}
