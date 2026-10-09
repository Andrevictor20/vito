package service

import (
	"strings"
)

// GetNotificationContextEmoji retorna um emoji estritamente contextual com base no título e categoria.
// Caso o texto não corresponda a um contexto semântico claro, retorna string vazia (sem emoji).
func GetNotificationContextEmoji(title, category string) string {
	lowerTitle := strings.ToLower(title)
	lowerCategory := strings.ToLower(category)

	// 1. Remédios / Medicamentos / Saúde Clínica
	if containsAny(lowerTitle, "remédio", "remedio", "medicamento", "antibiótico", "antibiotico", "comprimido", "pílula", "pilula", "dose", "farmácia", "farmacia", "receita") {
		return "💊"
	}

	// 2. Hidratação / Água
	if containsAny(lowerTitle, "água", "agua", "hidratar", "hidratação", "hidratacao") {
		return "💧"
	}

	// 3. Consultas / Médicos / Exames
	if containsAny(lowerTitle, "médico", "medico", "médica", "medica", "consulta", "exame", "dentista", "cardiologista", "dermatologista", "terapeuta", "psicólogo", "psicologo", "hospital", "clínica", "clinica", "laboratório", "laboratorio") {
		return "🩺"
	}

	// 4. Treinos / Academia / Exercícios físicos
	if containsAny(lowerTitle, "academia", "treino", "treinar", "musculação", "musculacao", "corrida", "correr", "caminhada", "pilates", "yoga", "crossfit", "natação", "natacao") {
		return "🏋️"
	}

	// 5. Alimentação / Refeições
	if containsAny(lowerTitle, "almoço", "almoco", "almoçar", "almocar", "jantar", "janta", "café da manhã", "cafe da manha", "refeição", "refeicao", "lanche", "restaurante") {
		return "🍽️"
	}

	// 6. Despertar / Acordar
	if containsAny(lowerTitle, "acordar", "despertar", "levantar", "despertador") {
		return "⏰"
	}

	// 7. Estudos / Cursos / Leitura
	if containsAny(lowerTitle, "aula", "estudar", "estudo", "prova", "curso", "livro", "leitura", "faculdade", "workshop") {
		return "📚"
	}

	// 8. Viagens / Voo / Transporte
	if containsAny(lowerTitle, "voo", "avião", "aviao", "aeroporto", "viagem", "embarque", "hotel", "rodoviária", "rodoviaria") {
		return "✈️"
	}

	// 9. Compras / Mercado
	if containsAny(lowerTitle, "compras", "mercado", "supermercado", "comprar", "feira", "shopping", "padaria") {
		return "🛒"
	}

	// 10. Finanças / Contas
	if containsAny(lowerTitle, "boleto", "pagar", "pagamento", "fatura", "banco", "pix", "imposto", "ted", "doc") {
		return "💳"
	}

	// 11. Aniversários / Celebrações
	if containsAny(lowerTitle, "aniversário", "aniversario", "parabéns", "parabens", "festa", "comemoração", "comemoracao") {
		return "🎂"
	}

	// 12. Veículos / Automotivo
	if containsAny(lowerTitle, "carro", "veículo", "veiculo", "oficina", "mecânico", "mecanico", "revisão do carro", "revisão veicular", "posto de gasolina", "ipva") {
		return "🚗"
	}

	// 13. Animais de estimação
	if containsAny(lowerTitle, "pet", "cachorro", "cão", "cao", "gato", "veterinário", "veterinario", "ração", "racao") {
		return "🐾"
	}

	// 14. Fallbacks baseados na categoria formal
	switch lowerCategory {
	case "health":
		return "🩺"
	case "study":
		return "📚"
	case "finance":
		return "💳"
	case "work":
		return "💼"
	}

	// Sem contexto temático específico: nenhum emoji
	return ""
}

func containsAny(s string, keywords ...string) bool {
	for _, kw := range keywords {
		if strings.Contains(s, kw) {
			return true
		}
	}
	return false
}
