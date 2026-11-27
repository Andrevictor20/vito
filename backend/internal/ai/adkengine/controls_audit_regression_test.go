package adkengine_test

import (
	"context"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

type stubPrivacyChecker struct {
	aiEnabled bool
}

func (s *stubPrivacyChecker) GetPrivacySettings(_ context.Context, userID string) (*domain.PrivacySettings, error) {
	return &domain.PrivacySettings{
		UserID:              userID,
		AIProcessingEnabled: s.aiEnabled,
		AnalyticsEnabled:    true,
	}, nil
}

func TestAutonomyModeAndAutoFocusBlocks_InjectedIntoVolatileContext(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "autonomy_ctx.db"))
	if err != nil {
		t.Fatalf("falha ao abrir sqlite: %v", err)
	}
	defer db.Close()

	userID := "user-aut-ctx"
	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{
		ID:        userID,
		Name:      "André",
		Email:     "aut@vito.local",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})
	aiSettingsRepo := repository.NewAISettingsRepository(db)

	cases := []struct {
		name         string
		mode         domain.AutonomyMode
		focus        bool
		wantContains []string
	}{
		{
			name:  "proativo com blocos de foco",
			mode:  domain.AutonomyModeProactive,
			focus: true,
			wantContains: []string{
				"MODO DE AUTONOMIA: PROATIVO",
				"BLOCOS DE FOCO AUTOMÁTICOS: ATIVADOS",
			},
		},
		{
			name:         "assistido sem blocos de foco",
			mode:         domain.AutonomyModeAssisted,
			focus:        false,
			wantContains: []string{"MODO DE AUTONOMIA: ASSISTIDO"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_ = aiSettingsRepo.UpsertSettings(&domain.AISettings{
				UserID:          userID,
				AutonomyMode:    tc.mode,
				AutoFocusBlocks: tc.focus,
			})
			prov := &fakeADKLLM{
				model:     "gemini-2.5-flash",
				responses: []scriptedModelResponse{{Text: "Entendido."}},
			}
			facade, err := adkengine.NewADKLoopFacade(adkengine.FacadeConfig{
				ServerPool:       testServerPool("Aut-LLM", "gemini-2.5-flash", prov),
				Registry:         toolsets.NewToolsetsRegistry(),
				ScopeGuard:       service.NewScopeGuard(),
				ConfirmationGate: service.NewConfirmationGateService(db),
				ConvRepo:         repository.NewConversationStoreRepository(db),
				UserRepo:         userRepo,
				AISettingsRepo:   aiSettingsRepo,
			})
			if err != nil {
				t.Fatalf("NewADKLoopFacade falhou: %v", err)
			}

			if _, err := facade.Run(context.Background(), domain.UnifiedAssistantRequest{
				UserID:   userID,
				ThreadID: "th-" + string(tc.mode),
				Channel:  "app_mobile",
				Message:  "Organize meu dia",
			}); err != nil {
				t.Fatalf("Run falhou: %v", err)
			}
			sys := collectSystemInstructionText(prov.capturedReqs[0])
			for _, token := range tc.wantContains {
				if !strings.Contains(sys, token) {
					t.Errorf("esperava %q no SystemInstruction, obteve:\n%s", token, sys)
				}
			}
		})
	}
}

func TestScopeGuard_GeneralChatBlocksAlwaysAskEvenInProactiveMode(t *testing.T) {
	guard := service.NewScopeGuard()
	ctx := context.Background()

	execProactive := &domain.ToolExecutionContext{
		TurnID:        "turn-proactive-1",
		UserID:        "user-1",
		Channel:       "app_mobile",
		AutonomyLevel: "autonomous_write",
	}

	if allowed, reason := guard.CanExecute(ctx, execProactive, "create_todo", true); !allowed {
		t.Fatalf("create_todo não destrutivo deve executar no modo proativo: %s", reason)
	}
	for _, sensitive := range []string{"send_message", "send_email", "delete_event", "delete_todo"} {
		if allowed, _ := guard.CanExecute(ctx, execProactive, sensitive, true); allowed {
			t.Fatalf("operação sensível/destrutiva %q NÃO pode executar sem confirmação explícita mesmo em proactive", sensitive)
		}
	}

	execConfirmed := &domain.ToolExecutionContext{
		TurnID:        "turn-confirmed-1",
		UserID:        "user-1",
		Channel:       "app_mobile",
		AutonomyLevel: "confirmed",
	}
	if allowed, reason := guard.CanExecute(ctx, execConfirmed, "send_message", true); !allowed {
		t.Fatalf("confirmação pontual deve liberar send_message: %s", reason)
	}
}

func TestPrivacyChecker_BlocksRunWhenAIDisabled(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "privacy_block.db"))
	if err != nil {
		t.Fatalf("falha ao abrir sqlite: %v", err)
	}
	defer db.Close()

	prov := &fakeADKLLM{
		model:     "gemini-2.5-flash",
		responses: []scriptedModelResponse{{Text: "Não deveria rodar."}},
	}
	facade, err := adkengine.NewADKLoopFacade(adkengine.FacadeConfig{
		ServerPool:       testServerPool("Priv-LLM", "gemini-2.5-flash", prov),
		Registry:         toolsets.NewToolsetsRegistry(),
		ScopeGuard:       service.NewScopeGuard(),
		ConfirmationGate: service.NewConfirmationGateService(db),
		ConvRepo:         repository.NewConversationStoreRepository(db),
		PrivacyChecker:   &stubPrivacyChecker{aiEnabled: false},
	})
	if err != nil {
		t.Fatalf("NewADKLoopFacade falhou: %v", err)
	}

	_, err = facade.Run(context.Background(), domain.UnifiedAssistantRequest{
		UserID:   "user-priv-off",
		ThreadID: "th-priv-off",
		Channel:  "app_mobile",
		Message:  "Oi",
	})
	if err == nil || !strings.Contains(err.Error(), "Privacidade") {
		t.Fatalf("esperava bloqueio por privacidade, obteve err=%v", err)
	}
	if len(prov.capturedReqs) != 0 {
		t.Fatalf("LLM não deveria ser chamada quando AIProcessingEnabled=false, chamadas=%d", len(prov.capturedReqs))
	}
}
