package middleware

import "net/http"

// SecurityHeadersMiddleware injeta cabeçalhos de proteção e integridade HTTP recomendados pela OWASP.
func SecurityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// Se a requisição chega via HTTPS ou através de túnel Cloudflare seguro
		if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" || r.Header.Get("CF-Visitor") != "" {
			w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}

		next.ServeHTTP(w, r)
	})
}
