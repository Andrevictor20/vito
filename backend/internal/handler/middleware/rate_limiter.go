package middleware

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type clientBucket struct {
	tokens     float64
	lastUpdate time.Time
}

// RateLimiter implementa limitação de taxa em memória thread-safe (Token Bucket).
type RateLimiter struct {
	mu       sync.Mutex
	capacity float64
	refill   float64
	window   time.Duration
	clients  map[string]*clientBucket
}

// NewRateLimiter instancia um limitador com capacidade 'limit' permitidas ao longo do intervalo 'window'.
func NewRateLimiter(limit int, window time.Duration) func(http.Handler) http.Handler {
	rl := &RateLimiter{
		capacity: float64(limit),
		refill:   float64(limit) / window.Seconds(),
		window:   window,
		clients:  make(map[string]*clientBucket),
	}

	// Limpeza periódica em background de entradas inativas para evitar memory leaks
	go rl.cleanupRoutine()

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := rl.extractClientKey(r)

			rl.mu.Lock()
			now := time.Now()
			bucket, exists := rl.clients[key]
			if !exists {
				bucket = &clientBucket{
					tokens:     rl.capacity - 1,
					lastUpdate: now,
				}
				rl.clients[key] = bucket
				rl.mu.Unlock()
				next.ServeHTTP(w, r)
				return
			}

			// Refill proporcional ao tempo decorrido
			elapsed := now.Sub(bucket.lastUpdate).Seconds()
			bucket.tokens += elapsed * rl.refill
			if bucket.tokens > rl.capacity {
				bucket.tokens = rl.capacity
			}
			bucket.lastUpdate = now

			if bucket.tokens >= 1 {
				bucket.tokens--
				rl.mu.Unlock()
				next.ServeHTTP(w, r)
				return
			}

			// Bloqueado por excesso de requisições
			rl.mu.Unlock()
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", fmt.Sprintf("%d", int(rl.window.Seconds())))
			w.WriteHeader(http.StatusTooManyRequests)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "limite de requisições excedido. tente novamente em instantes.",
			})
		})
	}
}

func (rl *RateLimiter) extractClientKey(r *http.Request) string {
	// Se for usuário autenticado, a chave é o ID do usuário
	if userID, ok := UserIDFromContext(r.Context()); ok && userID != "" {
		return "user:" + userID
	}

	// Caso contrário, identifica pelo IP do cliente
	ip := r.Header.Get("X-Forwarded-For")
	if ip != "" {
		parts := strings.Split(ip, ",")
		return "ip:" + strings.TrimSpace(parts[0])
	}
	realIP := r.Header.Get("X-Real-IP")
	if realIP != "" {
		return "ip:" + strings.TrimSpace(realIP)
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return "ip:" + host
	}
	return "ip:" + r.RemoteAddr
}

func (rl *RateLimiter) cleanupRoutine() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for key, bucket := range rl.clients {
			if now.Sub(bucket.lastUpdate) > 10*time.Minute {
				delete(rl.clients, key)
			}
		}
		rl.mu.Unlock()
	}
}
