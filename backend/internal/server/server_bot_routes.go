package server

import "github.com/go-chi/chi/v5"

func (s *Server) registerBotRoutes(protected chi.Router) {
	if s.botHandler == nil {
		return
	}
	protected.Route("/bots", func(br chi.Router) {
		br.Get("/", s.botHandler.ListBots)
		br.Post("/", s.botHandler.CreateBot)
		br.Get("/activity", s.botHandler.GetActivity)
		br.Get("/catalog/templates", s.botHandler.ListCatalogTemplates)
		br.Get("/catalog/skills", s.botHandler.ListCatalogSkills)
		br.Get("/apps", s.botHandler.ListApps)
		br.Post("/apps/suggest", s.botHandler.SuggestApp)
		br.Route("/{id}", func(bir chi.Router) {
			bir.Get("/", s.botHandler.GetBot)
			bir.Patch("/", s.botHandler.UpdateBot)
			bir.Delete("/", s.botHandler.DeleteBot)
			bir.Post("/run", s.botHandler.RunBot)
			bir.Get("/chat", s.botHandler.GetBotChat)
			bir.Post("/chat", s.botHandler.SendBotChat)
			bir.Post("/actions", s.botHandler.AddAction)
			bir.Patch("/actions/{actionKey}", s.botHandler.UpdateAction)
			bir.Delete("/actions/{actionKey}", s.botHandler.RemoveAction)
			bir.Post("/skills", s.botHandler.AddSkill)
			bir.Delete("/skills/{skillKey}", s.botHandler.RemoveSkill)
			bir.Post("/skills/{skillKey}/upgrade", s.botHandler.UpgradeSkill)
			bir.Get("/memories", s.botHandler.ListMemories)
			bir.Post("/memories", s.botHandler.AddMemory)
			bir.Delete("/memories/{memId}", s.botHandler.DeleteMemory)
			bir.Post("/pending/{confirmationId}/resolve", s.botHandler.ResolvePending)
		})
	})
}
