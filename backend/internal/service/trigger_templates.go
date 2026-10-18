package service

import (
	"context"
	"errors"
	"strings"

	"github.com/andrevmp/vito/backend/internal/domain"
)

var ErrTriggerTemplateNotFound = errors.New("template de vigília não encontrado")

// DefaultTriggerTemplates retorna o catálogo oficial de vigílias proativas por área.
func DefaultTriggerTemplates() []domain.TriggerTemplate {
	return []domain.TriggerTemplate{
		{
			ID:             "tmpl-career-jobs",
			Title:          "Radar de Oportunidades & Vagas",
			Description:    "Monitora vagas abertas no LinkedIn, Gupy e Remotar alinhadas à sua área e senioridade, filtrando oportunidades aderentes.",
			Category:       domain.CategoryCareer,
			Area:           "carreiras",
			Icon:           "work",
			Connectors:     []string{"web", "profile"},
			Query:          "vagas emprego desenvolvedor tecnologia senior",
			UserIntent:     "Identificar novas vagas de emprego abertas com salário e senioridade aderentes ao perfil profissional do usuário.",
			SearchKeywords: "vaga emprego tecnologia desenvolvedor senior gupy linkedin remotar",
			ConditionType:  domain.ConditionChangeDetected,
			TargetValue:    "",
			Frequency:      domain.FrequencyDailyMorning,
			ScheduledTime:  "08:30",
		},
		{
			ID:             "tmpl-concursos-editais",
			Title:          "Vigília de Concursos Públicos",
			Description:    "Monitora publicação de editais, bancas examinadoras (Cebraspe, FCC, FGV), datas de inscrição e vagas abertas no DOU e estados.",
			Category:       domain.CategoryPublicExams,
			Area:           "concursos",
			Icon:           "gavel",
			Connectors:     []string{"web"},
			Query:          "concurso publico edital aberto inscricoes fiscal ti judiciario",
			UserIntent:     "Avisar sobre publicação de novos editais de concursos públicos e prazos de inscrição para cargos de interesse.",
			SearchKeywords: "concurso publico edital aberto cebraspe fcc fgv dou inscricoes",
			ConditionType:  domain.ConditionChangeDetected,
			TargetValue:    "",
			Frequency:      domain.FrequencyDailyMorning,
			ScheduledTime:  "08:00",
		},
		{
			ID:             "tmpl-imoveis-oportunidades",
			Title:          "Radar de Imóveis & Oportunidades",
			Description:    "Varre novas listagens de apartamentos e casas para alugar ou comprar na sua região e faixa de valor, alertando oportunidades abaixo do m² médio.",
			Category:       domain.CategoryRealEstate,
			Area:           "imoveis",
			Icon:           "home",
			Connectors:     []string{"web"},
			Query:          "apartamento aluguel compra oportunidade abaixo mercado",
			UserIntent:     "Encontrar novos imóveis listados com bom preço ou condições favoráveis na região especificada.",
			SearchKeywords: "imovel apartamento aluguel venda oportunidade quintoandar zap viva real",
			ConditionType:  domain.ConditionPriceBelow,
			TargetValue:    "R$ 3.500",
			Frequency:      domain.FrequencyDailyEvening,
			ScheduledTime:  "18:30",
		},
		{
			ID:             "tmpl-viagens-voos",
			Title:          "Alerta de Voo, Check-in & Passagens",
			Description:    "Cruza confirmações de voo do seu Gmail, avisa na véspera para check-in e monitora promoções de passagens para seus destinos.",
			Category:       domain.CategoryTravel,
			Area:           "viagens",
			Icon:           "flight",
			Connectors:     []string{"gmail", "calendar", "web"},
			Query:          "voo passagem aerea promocao checkin",
			UserIntent:     "Avisar com antecedência sobre check-in de voos e monitorar oscilações de passagens aéreas.",
			SearchKeywords: "voo passagem aerea latam gol azul checkin promocao",
			ConditionType:  domain.ConditionEventUpcoming,
			TargetValue:    "",
			Frequency:      domain.FrequencyImmediate,
			ScheduledTime:  "",
		},
		{
			ID:             "tmpl-financas-boletos",
			Title:          "Vigília de Boletos & Faturas",
			Description:    "Lê e-mails de faturas e boletos no Gmail, alertando 48h antes do vencimento com o valor e a linha digitável pronta para pagar.",
			Category:       domain.CategoryFinance,
			Area:           "financas",
			Icon:           "receipt-long",
			Connectors:     []string{"gmail"},
			Query:          "fatura boleto vencimento pagamento",
			UserIntent:     "Alertar sobre faturas bancárias e boletos pendentes antes da data de vencimento.",
			SearchKeywords: "fatura boleto bancario nubank itau bradesco santander vencimento",
			ConditionType:  domain.ConditionDailyBrief,
			TargetValue:    "",
			Frequency:      domain.FrequencyDailyMorning,
			ScheduledTime:  "08:00",
		},
		{
			ID:             "tmpl-financas-cambio",
			Title:          "Monitor de Dólar & Câmbio",
			Description:    "Acompanha cotação comercial do Dólar e Euro em tempo real e avisa caso atinja uma faixa de preço favorável.",
			Category:       domain.CategoryFinance,
			Area:           "financas",
			Icon:           "attach-money",
			Connectors:     []string{"web"},
			Query:          "dolar comercial cotacao hoje",
			UserIntent:     "Avisar quando a cotação do dólar oscilar para valores de interesse.",
			SearchKeywords: "dolar cotação comercial euro cambio hoje",
			ConditionType:  domain.ConditionPriceBelow,
			TargetValue:    "5.20",
			Frequency:      domain.FrequencyHourly,
			ScheduledTime:  "",
		},
		{
			ID:             "tmpl-trabalho-briefing",
			Title:          "Briefing Matinal do Seu Setor",
			Description:    "Resumo executivo diário com as principais notícias, regulação e movimentos de mercado do seu setor profissional.",
			Category:       domain.CategoryNews,
			Area:           "trabalho",
			Icon:           "newspaper",
			Connectors:     []string{"web"},
			Query:          "noticias mercado tecnologia negocios economia",
			UserIntent:     "Entregar síntese rápida das 3 principais notícias do dia no horário do café da manhã.",
			SearchKeywords: "noticias tecnologia mercado regulacao negocios economia",
			ConditionType:  domain.ConditionDailyBrief,
			TargetValue:    "",
			Frequency:      domain.FrequencyDailyMorning,
			ScheduledTime:  "07:30",
		},
		{
			ID:             "tmpl-estudos-certificacoes",
			Title:          "Radar de Bolsas & Certificações",
			Description:    "Monitora cupons gratuitos, programas de bolsas e novas turmas de certificações em tecnologia e gestão.",
			Category:       domain.CategoryCustom,
			Area:           "estudos",
			Icon:           "school",
			Connectors:     []string{"web"},
			Query:          "bolsas certificacoes ti cursos gratuitos inscricoes",
			UserIntent:     "Localizar inscrições abertas para bolsas de estudo e certificações gratuitas de capacitação.",
			SearchKeywords: "bolsas estudos cursos gratuitos certificacoes aws google azure ti",
			ConditionType:  domain.ConditionChangeDetected,
			TargetValue:    "",
			Frequency:      domain.FrequencyDailyMorning,
			ScheduledTime:  "09:00",
		},
	}
}

// GetTriggerTemplateByID busca um template pelo ID no catálogo.
func GetTriggerTemplateByID(id string) (*domain.TriggerTemplate, error) {
	for _, t := range DefaultTriggerTemplates() {
		if t.ID == id {
			return &t, nil
		}
	}
	return nil, ErrTriggerTemplateNotFound
}

// ListTemplates devolve a lista completa de templates disponíveis.
func (s *TriggerService) ListTemplates() []domain.TriggerTemplate {
	return DefaultTriggerTemplates()
}

// ActivateTemplate cria um disparador ativo a partir de um template do catálogo.
func (s *TriggerService) ActivateTemplate(ctx context.Context, userID, templateID string, overrides *domain.ActivateTemplateInput) (*domain.Trigger, error) {
	tmpl, err := GetTriggerTemplateByID(templateID)
	if err != nil {
		return nil, err
	}

	title := tmpl.Title
	query := tmpl.Query
	targetVal := tmpl.TargetValue

	if overrides != nil {
		if strings.TrimSpace(overrides.Title) != "" {
			title = strings.TrimSpace(overrides.Title)
		}
		if strings.TrimSpace(overrides.Query) != "" {
			query = strings.TrimSpace(overrides.Query)
		}
		if strings.TrimSpace(overrides.TargetValue) != "" {
			targetVal = strings.TrimSpace(overrides.TargetValue)
		}
	}

	input := domain.CreateTriggerInput{
		Title:          title,
		Category:       tmpl.Category,
		Query:          query,
		UserIntent:     tmpl.UserIntent,
		SearchKeywords: tmpl.SearchKeywords,
		ConditionType:  tmpl.ConditionType,
		TargetValue:    targetVal,
		Frequency:      tmpl.Frequency,
		ScheduledTime:  tmpl.ScheduledTime,
	}

	return s.CreateTrigger(userID, input)
}
