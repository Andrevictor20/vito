package adkengine

import (
	"strings"
	"testing"

	"google.golang.org/adk/v2/model"
	"google.golang.org/genai"
)

func TestAC01_BeforeModelPreservesSubAgentInstruction(t *testing.T) {
	req := &model.LLMRequest{
		Config: &genai.GenerateContentConfig{
			SystemInstruction: &genai.Content{
				Role: "system",
				Parts: []*genai.Part{
					genai.NewPartFromText("Você é o especialista vito_routine_agent. Use transfer_to_agent quando necessário."),
				},
			},
		},
		Contents: []*genai.Content{
			genai.NewContentFromText("Listar minha agenda de hoje", genai.RoleUser),
		},
	}

	ApplyBeforeModelConfig(req, "app_mobile", "auto", "STATIC_VITO_PERSONA", "VOLATILE_CONTEXT_NOW")

	if req.Config == nil || req.Config.SystemInstruction == nil {
		t.Fatal("esperava SystemInstruction preenchida")
	}
	parts := req.Config.SystemInstruction.Parts
	if len(parts) != 3 {
		t.Fatalf("esperava 3 partes (static + subagent + volatile), obteve %d", len(parts))
	}
	if parts[0].Text != "STATIC_VITO_PERSONA" {
		t.Errorf("prefixo estático esperado na posição 0, obteve %q", parts[0].Text)
	}
	if !strings.Contains(parts[1].Text, "vito_routine_agent") || !strings.Contains(parts[1].Text, "transfer_to_agent") {
		t.Errorf("instrução do sub-agente e transfer_to_agent deveriam estar preservadas na posição 1, obteve %q", parts[1].Text)
	}
	if parts[2].Text != "VOLATILE_CONTEXT_NOW" {
		t.Errorf("contexto volátil esperado na posição 2, obteve %q", parts[2].Text)
	}
}
