package ai

import (
	"testing"
)

func TestSanitizeAndExtractJSON(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		wantErr     bool
		expectedKey string
	}{
		{
			name:        "JSON limpo direto",
			input:       `{"action": "GENERAL_CHAT", "message": "Olá!"}`,
			wantErr:     false,
			expectedKey: "GENERAL_CHAT",
		},
		{
			name:        "JSON com markdown code fences (```json)",
			input:       "```json\n{\"action\": \"CREATE_TODO\", \"message\": \"Tarefa criada\"}\n```",
			wantErr:     false,
			expectedKey: "CREATE_TODO",
		},
		{
			name:        "JSON com markdown code fences sem linguagem (```)",
			input:       "```\n{\"action\": \"CREATE_EVENT\", \"message\": \"Evento agendado\"}\n```",
			wantErr:     false,
			expectedKey: "CREATE_EVENT",
		},
		{
			name:        "JSON envolvido em texto conversacional",
			input:       "Aqui está a resposta estruturada:\n{\"action\": \"SAVE_MEMORY\", \"message\": \"Lembrete salvo\"}\nTenha um ótimo dia!",
			wantErr:     false,
			expectedKey: "SAVE_MEMORY",
		},
		{
			name:        "JSON com trailing comma antes de fechar objeto",
			input:       `{"action": "GENERAL_CHAT", "message": "Teste",}`,
			wantErr:     false,
			expectedKey: "GENERAL_CHAT",
		},
		{
			name:        "JSON com trailing commas em campos aninhados",
			input:       `{"action": "CREATE_TODO", "todo": {"title": "Comprar café", "priority": "high",},}`,
			wantErr:     false,
			expectedKey: "CREATE_TODO",
		},
		{
			name:    "Texto puro sem JSON",
			input:   "Desculpe, não consegui entender o que você precisa.",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cleaned, err := SanitizeAndExtractJSON(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Errorf("SanitizeAndExtractJSON esperava erro, mas obteve sucesso: %s", string(cleaned))
				}
				return
			}

			if err != nil {
				t.Fatalf("SanitizeAndExtractJSON retornou erro inesperado: %v", err)
			}

			var intent ParsedIntent
			if err := UnmarshalIntent(tt.input, &intent); err != nil {
				t.Fatalf("UnmarshalIntent falhou: %v (cleaned: %s)", err, string(cleaned))
			}

			if string(intent.Action) != tt.expectedKey {
				t.Errorf("Action esperado %s, obteve %s", tt.expectedKey, intent.Action)
			}
		})
	}
}
