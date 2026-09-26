package server

import (
	"encoding/json"
	"net/http"

	"github.com/andrevmp/kito/backend/internal/handler"
	"github.com/andrevmp/kito/backend/internal/handler/middleware"
	"github.com/andrevmp/kito/backend/internal/service"
)

// Server encapsula o roteador e dependências HTTP do Kito.
type Server struct {
	mux         *http.ServeMux
	authHandler *handler.AuthHandler
	calHandler  *handler.CalendarHandler
	todoHandler *handler.TodoHandler
	astHandler  *handler.AssistantHandler
	authSvc     *service.AuthService
}

// Config contém as dependências necessárias para inicializar o Server.
type Config struct {
	AuthHandler *handler.AuthHandler
	CalHandler  *handler.CalendarHandler
	TodoHandler *handler.TodoHandler
	AstHandler  *handler.AssistantHandler
	AuthSvc     *service.AuthService
}

// New instancia o servidor com as rotas e middlewares registrados.
func New(cfg ...Config) *Server {
	s := &Server{
		mux: http.NewServeMux(),
	}

	if len(cfg) > 0 {
		s.authHandler = cfg[0].AuthHandler
		s.calHandler = cfg[0].CalHandler
		s.todoHandler = cfg[0].TodoHandler
		s.astHandler = cfg[0].AstHandler
		s.authSvc = cfg[0].AuthSvc
	}

	s.registerRoutes()
	return s
}

// Router retorna o handler HTTP com suporte a CORS básico.
func (s *Server) Router() http.Handler {
	return s.corsMiddleware(s.mux)
}

func (s *Server) registerRoutes() {
	s.mux.HandleFunc("GET /healthz", s.handleHealthCheck)

	if s.authHandler != nil {
		s.mux.HandleFunc("POST /api/v1/auth/register", s.authHandler.Register)
		s.mux.HandleFunc("POST /api/v1/auth/login", s.authHandler.Login)
	}

	// Rotas protegidas por JWT
	if s.authSvc != nil {
		authMW := middleware.AuthMiddleware(s.authSvc)

		if s.authHandler != nil {
			s.mux.Handle("GET /api/v1/auth/me", authMW(http.HandlerFunc(s.authHandler.Me)))
		}

		if s.calHandler != nil {
			s.mux.Handle("POST /api/v1/events", authMW(http.HandlerFunc(s.calHandler.CreateEvent)))
			s.mux.Handle("GET /api/v1/events", authMW(http.HandlerFunc(s.calHandler.ListEvents)))
			s.mux.Handle("DELETE /api/v1/events/{id}", authMW(http.HandlerFunc(s.calHandler.DeleteEvent)))
		}

		if s.todoHandler != nil {
			s.mux.Handle("POST /api/v1/todos", authMW(http.HandlerFunc(s.todoHandler.CreateTodo)))
			s.mux.Handle("GET /api/v1/todos", authMW(http.HandlerFunc(s.todoHandler.ListTodos)))
			s.mux.Handle("PATCH /api/v1/todos/{id}/complete", authMW(http.HandlerFunc(s.todoHandler.CompleteTodo)))
			s.mux.Handle("DELETE /api/v1/todos/{id}", authMW(http.HandlerFunc(s.todoHandler.DeleteTodo)))
		}

		if s.astHandler != nil {
			s.mux.Handle("POST /api/v1/assistant/chat", authMW(http.HandlerFunc(s.astHandler.Chat)))
		}
	}
}

func (s *Server) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
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
