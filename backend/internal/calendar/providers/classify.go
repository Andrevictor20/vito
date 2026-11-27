package providers

import "strings"

// ClassifyEvent infere a categoria e cor semântica a partir de palavras-chave no título e descrição.
func ClassifyEvent(title, description string) (string, string) {
	text := strings.ToLower(title + " " + description)

	// Feriados e Datas Comemorativas (#F59E0B)
	holidayTerms := []string{
		"feriado", "nossa senhora", "aparecida", "ano novo", "confraternização", "carnaval",
		"quarta-feira de cinzas", "quarta de cinzas", "sexta-feira santa", "paixão de cristo",
		"páscoa", "pascoa", "tiradentes", "dia do trabalho", "dia do trabalhador",
		"corpus christi", "independência", "independencia", "finados", "proclamação da república",
		"proclamacao da republica", "consciência negra", "consciencia negra", "natal",
		"véspera de natal", "vespera de natal", "véspera de ano novo", "vespera de ano novo",
		"dia das mães", "dia dos pais", "dia das crianças", "holiday", "réveillon", "reveillon",
	}
	for _, term := range holidayTerms {
		if strings.Contains(text, term) {
			return "holiday", "#F59E0B"
		}
	}

	// Trabalho / Reuniões (#38BDF8)
	workTerms := []string{"reunião", "reuniao", "daily", "align", "alinhamento", "1:1", "review", "sprint", "meet", "call", "apresentação", "apresentacao", "entrevista", "cliente", "projeto", "demo", "deploy"}
	for _, term := range workTerms {
		if strings.Contains(text, term) {
			return "work", "#38BDF8"
		}
	}

	// Saúde / Bem-Estar (#34D399)
	healthTerms := []string{"médico", "medico", "consulta", "exame", "dentista", "academia", "treino", "pilates", "fisio", "terapia", "remédio", "remedio", "oftalmo", "psicolog", "nutri", "corrida"}
	for _, term := range healthTerms {
		if strings.Contains(text, term) {
			return "health", "#34D399"
		}
	}

	// Finanças (#F87171)
	financeTerms := []string{"fatura", "pagar", "pagamento", "imposto", "banco", "conta", "boleto", "salário", "salario", "aluguel", "irpf", "darf"}
	for _, term := range financeTerms {
		if strings.Contains(text, term) {
			return "finance", "#F87171"
		}
	}

	// Estudo / Educação (#818CF8)
	studyTerms := []string{"aula", "curso", "faculdade", "prova", "seminário", "seminario", "workshop", "mentoria", "estudo", "tcc", "palestra"}
	for _, term := range studyTerms {
		if strings.Contains(text, term) {
			return "study", "#818CF8"
		}
	}

	// Lazer / Social (#FBBF24)
	leisureTerms := []string{"churrasco", "chopp", "cerveja", "bar", "festa", "cinema", "show", "viagem", "praia", "jogo", "jantar", "aniversário", "aniversario", "parabéns", "parabens"}
	for _, term := range leisureTerms {
		if strings.Contains(text, term) {
			return "leisure", "#FBBF24"
		}
	}

	// Pessoal / Família (#D0BCFF)
	personalTerms := []string{"família", "familia", "mãe", "mae", "pai", "filho", "filha", "casa", "compras", "mercado", "levar", "buscar"}
	for _, term := range personalTerms {
		if strings.Contains(text, term) {
			return "personal", "#D0BCFF"
		}
	}

	return "general", "#94A3B8"
}
