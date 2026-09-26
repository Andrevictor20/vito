package server

import (
	"encoding/json"
	"net/http"
)

// Server encapsula o roteador e dependências HTTP do Kito.
type Server struct {
	mux *http.ServeMux
}

// New instancia um novo servidor com as rotas padrão registradas.
func New() *Server {
	s := &Server{
		mux: http.NewServeMux(),
	}
	s.registerRoutes()
	return s
}

// Router retorna o handler HTTP compatível com net/http.
func (s *Server) Router() http.Handler {
	return s.mux
}

func (s *Server) registerRoutes() {
	s.mux.HandleFunc("GET /healthz", s.handleHealthCheck)
}

func (s *Server) handleHealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	_ = json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"service": "kito-backend",
		"version": "v0.1.0",
	})
}
