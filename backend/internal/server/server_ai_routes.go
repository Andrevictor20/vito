package server

import "github.com/go-chi/chi/v5"

func (s *Server) registerAIRoutes(protected chi.Router) {
	if s.aiProviderHandler != nil {
		protected.Route("/ai", func(air chi.Router) {
			air.Get("/providers", s.aiProviderHandler.ListProviders)
			air.Put("/providers/{key}", s.aiProviderHandler.ConnectProvider)
			air.Post("/providers/{key}/test", s.aiProviderHandler.TestProvider)
			air.Delete("/providers/{key}", s.aiProviderHandler.RemoveProvider)
			air.Get("/providers/{key}/models", s.aiProviderHandler.GetProviderModels)
			air.Get("/models", s.aiProviderHandler.ListSelectableModels)
			air.Get("/preferences", s.aiProviderHandler.GetPreferences)
			air.Put("/preferences", s.aiProviderHandler.UpdatePreferences)
		})
	}
	if s.chatHandler != nil {
		protected.Patch("/threads/{id}/model", s.chatHandler.UpdateThreadModelPref)
	}
	if s.triggerHandler != nil {
		protected.Patch("/bots/{id}/model", s.triggerHandler.UpdateBotModelPref)
	}
}
