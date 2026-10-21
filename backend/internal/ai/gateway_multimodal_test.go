package ai_test

import (
	"context"
	"testing"

	"github.com/andrevmp/vito/backend/internal/ai"
)

// TestGateway_ImagemCaiParaSegundoProvedorDeVisao garante a redundância real.
//
// Com um único provedor capaz de ler imagens, qualquer erro de cota do Google
// matava a análise sem alternativa. Agora o segundo provedor de visão assume.
func TestGateway_ImagemCaiParaSegundoProvedorDeVisao(t *testing.T) {
	intent := &ai.ParsedIntent{Action: ai.ActionGeneralChat, Message: "li a imagem"}

	primeiroFalha := &MockVisionProvider{MockProvider: MockProvider{name: "Gemini", shouldError: true, intent: intent}}
	segundoAssume := &MockVisionProvider{MockProvider: MockProvider{name: "OpenRouter Vision", shouldError: false, intent: intent}}

	gw := ai.NewGateway(primeiroFalha, segundoAssume)

	res, err := gw.ParseIntent(context.Background(), ai.UserInput{
		Text:     "Descreva a imagem",
		ImageB64: "aW1n",
	})
	if err != nil {
		t.Fatalf("esperava sucesso no segundo provedor de visão, obteve erro: %v", err)
	}
	if res.ProviderUsed != "OpenRouter Vision" {
		t.Errorf("esperava provedor 'OpenRouter Vision', obteve '%s'", res.ProviderUsed)
	}
}

// TestGateway_ImagemNaoUsaProvedorSemVisao evita alucinação.
//
// Um provedor só de texto responderia "descreva a imagem" sem enxergar nada —
// pior do que uma falha honesta, porque o Vito inventaria o conteúdo.
func TestGateway_ImagemNaoUsaProvedorSemVisao(t *testing.T) {
	intent := &ai.ParsedIntent{Action: ai.ActionGeneralChat, Message: "resposta textual"}

	somenteTexto := &MockProvider{name: "Groq Texto", shouldError: false, intent: intent}
	comVisao := &MockVisionProvider{MockProvider: MockProvider{name: "Gemini Vision", shouldError: false, intent: intent}}

	gw := ai.NewGateway(somenteTexto, comVisao)

	res, err := gw.ParseIntent(context.Background(), ai.UserInput{
		Text:     "Descreva a imagem",
		ImageB64: "aW1n",
	})
	if err != nil {
		t.Fatalf("ParseIntent falhou: %v", err)
	}
	if res.ProviderUsed != "Gemini Vision" {
		t.Errorf("esperava o provedor com visão, obteve '%s'", res.ProviderUsed)
	}
}
