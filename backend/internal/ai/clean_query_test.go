package ai_test

import (
	"testing"

	"github.com/andrevmp/vito/backend/internal/ai"
)

func TestCleanSearchQuery(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		category string
		wantSub  []string // substrings that must be in the result
	}{
		{
			name:     "Remover prefixo conversacional longo de preco",
			input:    "Quero que acompanhe e me avise do menor preço do celular Poco x8 pro max",
			category: "finance",
			wantSub:  []string{"Poco", "x8", "pro", "max"},
		},
		{
			name:     "Limpar frase de noticias",
			input:    "Fique de olho e me avise de noticias sobre greve do metro sp",
			category: "news",
			wantSub:  []string{"greve", "metro", "sp"},
		},
		{
			name:     "Preservar termos limpos de tecnologia",
			input:    "Golpe do Pix WhatsApp",
			category: "security",
			wantSub:  []string{"Golpe", "Pix", "WhatsApp"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := ai.CleanSearchQuery(tc.input, tc.category)
			if got == "" {
				t.Fatalf("CleanSearchQuery retornou string vazia para %q", tc.input)
			}
			for _, sub := range tc.wantSub {
				if !ai.ContainsWordIgnoreCase(got, sub) {
					t.Errorf("CleanSearchQuery(%q) = %q; esperava conter %q", tc.input, got, sub)
				}
			}
		})
	}
}
