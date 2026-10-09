package service_test

import (
	"testing"

	"github.com/andrevmp/vito/backend/internal/service"
)

func TestGetNotificationContextEmoji(t *testing.T) {
	tests := []struct {
		title    string
		category string
		expected string
	}{
		// Saúde / Medicamento
		{"Tomar antibiótico 500mg", "general", "💊"},
		{"Lembrar do comprimido das 20h", "health", "💊"},
		{"Dar remédio para dor", "", "💊"},

		// Hidratação
		{"Beber 500ml de água", "general", "💧"},
		{"Hidratar agora", "", "💧"},

		// Consulta / Médico
		{"Consulta com Dr. Carlos", "health", "🩺"},
		{"Dentista limpeza", "health", "🩺"},
		{"Exame de sangue no laboratório", "health", "🩺"},

		// Treino / Academia
		{"Treino de perna", "general", "🏋️"},
		{"Academia com personal", "health", "🏋️"},
		{"Corrida no parque", "", "🏋️"},

		// Alimentação / Refeições
		{"Almoço com diretoria", "work", "🍽️"},
		{"Jantar de negócios", "work", "🍽️"},

		// Estudos
		{"Aula de inglês", "study", "📚"},
		{"Estudar arquitetura de software", "study", "📚"},

		// Viagem
		{"Voo para São Paulo", "general", "✈️"},
		{"Embarque aeroporto", "general", "✈️"},

		// Financeiro
		{"Pagar boleto da internet", "general", "💳"},
		{"Fatura do cartão de crédito", "finance", "💳"},

		// Mercado
		{"Compras no supermercado", "general", "🛒"},

		// Aniversário
		{"Aniversário da Mariana", "personal", "🎂"},

		// Compromissos comuns SEM emoji contextual
		{"Alinhamento semanal com equipe", "work", "💼"},
		{"Planejamento estratégico", "", ""},
		{"Organizar gavetas", "general", ""},
		{"Revisão de contrato", "", ""},
		{"Backup do servidor", "", ""},
	}

	for _, tc := range tests {
		t.Run(tc.title, func(t *testing.T) {
			got := service.GetNotificationContextEmoji(tc.title, tc.category)
			if got != tc.expected {
				t.Errorf("GetNotificationContextEmoji(%q, %q) = %q; want %q", tc.title, tc.category, got, tc.expected)
			}
		})
	}
}
