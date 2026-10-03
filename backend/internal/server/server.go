package server

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

// Server encapsula o roteador Chi e dependências HTTP do Kito.
type Server struct {
	router      *chi.Mux
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

// New instancia o servidor com o roteador Chi, middlewares e rotas registrados.
func New(cfg ...Config) *Server {
	s := &Server{
		router: chi.NewRouter(),
	}

	if len(cfg) > 0 {
		s.authHandler = cfg[0].AuthHandler
		s.calHandler = cfg[0].CalHandler
		s.todoHandler = cfg[0].TodoHandler
		s.astHandler = cfg[0].AstHandler
		s.authSvc = cfg[0].AuthSvc
	}

	s.setupMiddlewares()
	s.registerRoutes()
	return s
}

// Router retorna o handler HTTP principal.
func (s *Server) Router() http.Handler {
	return s.router
}

func (s *Server) setupMiddlewares() {
	s.router.Use(chimiddleware.RequestID)
	s.router.Use(chimiddleware.RealIP)
	s.router.Use(chimiddleware.Logger)
	s.router.Use(chimiddleware.Recoverer)
	s.router.Use(middleware.SecurityHeadersMiddleware)

	// Configuração segura e completa de CORS para Mobile e Web
	s.router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))
}

func (s *Server) registerRoutes() {
	s.router.Get("/healthz", s.handleHealthCheck)

	s.router.Route("/api/v1", func(r chi.Router) {
		// Rotas públicas de autenticação
		if s.authHandler != nil {
			r.Post("/auth/register", s.authHandler.Register)
			r.Post("/auth/login", s.authHandler.Login)
		}

		// Rotas protegidas por JWT
		if s.authSvc != nil {
			r.Group(func(protected chi.Router) {
				protected.Use(middleware.AuthMiddleware(s.authSvc))

				if s.authHandler != nil {
					protected.Get("/auth/me", s.authHandler.Me)
				}

				if s.calHandler != nil {
					protected.Route("/events", func(cr chi.Router) {
						cr.Post("/", s.calHandler.CreateEvent)
						cr.Get("/", s.calHandler.ListEvents)
						cr.Delete("/{id}", s.calHandler.DeleteEvent)
					})
				}

				if s.todoHandler != nil {
					protected.Route("/todos", func(tr chi.Router) {
						tr.Post("/", s.todoHandler.CreateTodo)
						tr.Get("/", s.todoHandler.ListTodos)
						tr.Patch("/{id}/complete", s.todoHandler.CompleteTodo)
						tr.Delete("/{id}", s.todoHandler.DeleteTodo)
					})
				}

				if s.astHandler != nil {
					protected.Post("/assistant/chat", s.astHandler.Chat)
					protected.Post("/assistant/audio", s.astHandler.AudioChat)
					protected.Post("/assistant/vision", s.astHandler.VisionChat)
				}
			})
		}
	})
}

func (s *Server) handleHealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	_ = json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"service": "vito-backend",
		"version": "v0.1.0",
		"router":  "chi/v5",
	})
}
