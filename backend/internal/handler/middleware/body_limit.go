package middleware

import (
	"net/http"
	"strings"
)

// Limites de payload (SEC-04): JSON padrão 1MB; áudio/visão 15MB.
const (
	DefaultBodyLimitBytes = 1 << 20
	MediaBodyLimitBytes   = 15 << 20
)

// BodyLimitMiddleware rejeita corpos gigantes com 413 antes do decode.
func BodyLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		limit := int64(DefaultBodyLimitBytes)
		if strings.HasPrefix(r.URL.Path, "/api/v1/assistant/audio") ||
			strings.HasPrefix(r.URL.Path, "/api/v1/assistant/vision") {
			limit = int64(MediaBodyLimitBytes)
		}
		if r.ContentLength > limit {
			http.Error(w, `{"error":"payload excede o limite permitido"}`, http.StatusRequestEntityTooLarge)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, limit)
		next.ServeHTTP(w, r)
	})
}
