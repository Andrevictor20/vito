package main

import (
	"database/sql"
	"strconv"

	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/config"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

// AIProviderRuntime agrupa dependências de BYOK e seleção de modelo do servidor.
type AIProviderRuntime struct {
	Repo     domain.AIProviderRepository
	Registry *service.UserProviderRegistry
	Resolver *service.ModelResolver
	Service  *service.AIProviderService
	Handler  *handler.AIProviderHandler
}

func setupAIProviderSubsystem(
	cfg *config.Config,
	db *sql.DB,
	aiSettingsRepo domain.AISettingsRepository,
	convRepo *repository.ConversationStoreRepository,
) *AIProviderRuntime {
	if db == nil {
		return &AIProviderRuntime{}
	}
	portNum := 0
	if cfg != nil && cfg.Port != "" {
		portNum, _ = strconv.Atoi(cfg.Port)
	}
	encKey := ""
	if cfg != nil {
		encKey = cfg.DataEncryptionKey
	}

	aiProviderRepo := repository.NewAIProviderRepository(db)
	triggerRepo := repository.NewTriggerRepository(db)
	vault := service.NewAIKeyVault(encKey)
	registry := service.NewUserProviderRegistry(vault, adkengine.NewADKLLMFactory(), aiProviderRepo, portNum)
	resolver := service.NewModelResolver(aiProviderRepo, aiSettingsRepo, convRepo, triggerRepo, registry)
	svc := service.NewAIProviderService(aiProviderRepo, aiSettingsRepo, convRepo, triggerRepo, vault, registry, portNum)
	h := handler.NewAIProviderHandler(svc)

	return &AIProviderRuntime{
		Repo:     aiProviderRepo,
		Registry: registry,
		Resolver: resolver,
		Service:  svc,
		Handler:  h,
	}
}
