package adkengine

import (
	"context"
	"iter"
	"strings"
	"testing"

	"google.golang.org/adk/v2/model"
	"google.golang.org/genai"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/bots"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

type spyModelLLM struct {
	name     string
	reply    string
	captured []*model.LLMRequest
}

func (s *spyModelLLM) Name() string { return s.name }

func (s *spyModelLLM) GenerateContent(ctx context.Context, req *model.LLMRequest, stream bool) iter.Seq2[*model.LLMResponse, error] {
	s.captured = append(s.captured, req)
	return func(yield func(*model.LLMResponse, error) bool) {
		yield(&model.LLMResponse{
			Content:      genai.NewContentFromText(s.reply, genai.RoleModel),
			TurnComplete: true,
		}, nil)
	}
}

type spyAISettingsRepo struct {
	getCalls int
	settings *domain.AISettings
}

func (s *spyAISettingsRepo) GetSettings(userID string) (*domain.AISettings, error) {
	s.getCalls++
	return s.settings, nil
}
func (s *spyAISettingsRepo) UpsertSettings(settings *domain.AISettings) error { return nil }
func (s *spyAISettingsRepo) GetPreferences(ctx context.Context, userID string) (*domain.AIPreferences, error) {
	return nil, nil
}
func (s *spyAISettingsRepo) UpdatePreferences(ctx context.Context, userID, defaultModel, defaultEffort string) error {
	return nil
}
func (s *spyAISettingsRepo) ClearProviderPrefs(ctx context.Context, userID, providerKey string) error {
	return nil
}

func TestBotRuntime_DoesNotDuplicateSystemInstruction(t *testing.T) {
	spy := &spyModelLLM{name: "spy-gemini", reply: "OK"}
	routed := NewRoutedLLM(ServerPoolEntry{
		ProviderKey: "google",
		ModelID:     "gemini-2.5-flash",
		DisplayName: "Spy",
		LLM:         spy,
	})

	bridge := NewToolsetBridge(toolsets.NewToolsetsRegistry())
	guard := NewGuardrailPlugin(bridge, nil, nil, nil)
	sessSvc := NewSQLiteSessionService(nil)
	adapter := NewBotRuntimeAdapter(routed, sessSvc, bridge, guard)

	goalMarker := "OBJETIVO_UNICO_BOT_XYZ_991"
	_, err := adapter.ExecuteBotTurn(context.Background(), bots.BotRuntimeRequest{
		UserID: "user-1",
		Bot: &domain.Bot{
			ID:    "bot-1",
			Title: "Monitor Teste",
			Goal:  goalMarker,
		},
		Prompt: "Execute verificação",
	})
	if err != nil {
		t.Fatalf("ExecuteBotTurn falhou: %v", err)
	}
	if len(spy.captured) == 0 || spy.captured[0].Config == nil || spy.captured[0].Config.SystemInstruction == nil {
		t.Fatal("esperava captura de SystemInstruction no modelo")
	}

	var combined strings.Builder
	for _, p := range spy.captured[0].Config.SystemInstruction.Parts {
		if p != nil {
			combined.WriteString(p.Text)
			combined.WriteString("\n")
		}
	}
	if got := strings.Count(combined.String(), "RESTRIÇÃO DE ESCOPO ÚNICO"); got != 1 {
		t.Fatalf("SystemInstruction do bot foi duplicada! esperava 1 ocorrência de RESTRIÇÃO DE ESCOPO ÚNICO, obteve %d (parts=%d):\n%s",
			got, len(spy.captured[0].Config.SystemInstruction.Parts), combined.String())
	}
	if got := strings.Count(combined.String(), goalMarker); got < 1 {
		t.Fatalf("esperava goalMarker %q no SystemInstruction", goalMarker)
	}
}

func TestRunnerFacade_ResolvePersonaReadsSettingsOnce(t *testing.T) {
	settingsSpy := &spyAISettingsRepo{
		settings: &domain.AISettings{
			UserID:       "user-1",
			PersonaStyle: string(ai.StyleDirect),
			AutonomyMode: domain.AutonomyModeProactive,
		},
	}
	facade := &ADKLoopFacade{
		aiSettingsRepo: settingsSpy,
	}

	_, style, autonomy, mode, focusBlocks := facade.resolveUserPersonaAndAutonomy(domain.UnifiedAssistantRequest{
		UserID:  "user-1",
		Message: "bom dia",
	}, "user-1")

	if style != ai.StyleDirect || autonomy != "autonomous_write" || mode != domain.AutonomyModeProactive || focusBlocks {
		t.Fatalf("esperava direct/autonomous_write/proactive/false, obteve %s/%s/%s/%v", style, autonomy, mode, focusBlocks)
	}
	if settingsSpy.getCalls != 1 {
		t.Fatalf("esperava apenas 1 consulta a GetSettings, obteve %d", settingsSpy.getCalls)
	}
}

func TestRunnerFacade_SynthesizeFallbackWorksWithoutLegacyRouter(t *testing.T) {
	spy := &spyModelLLM{name: "spy-gemini", reply: "Resposta sintetizada via ADK"}
	routed := NewRoutedLLM(ServerPoolEntry{
		ProviderKey: "google",
		ModelID:     "gemini-2.5-flash",
		DisplayName: "Spy",
		LLM:         spy,
	})

	facade := &ADKLoopFacade{
		cfg:       FacadeConfig{},
		routedLLM: routed,
	}

	ans := facade.synthesizeFallbackAnswer(
		context.Background(),
		domain.UnifiedAssistantRequest{UserID: "user-1", Channel: "app_mobile", Message: "o que tem hoje?"},
		"thread-1",
		"STATIC",
		"VOLATILE",
		[]domain.ExecutedTool{{Tool: "calendar", Operation: "list_events", Status: "COMPLETED"}},
	)
	if ans != "Resposta sintetizada via ADK" {
		t.Fatalf("esperava síntese via routedLLM sem Router legado, obteve %q", ans)
	}
}
