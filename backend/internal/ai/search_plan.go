package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/andrevmp/vito/backend/internal/domain"
)

var (
	regexTicker        = regexp.MustCompile(`\b([A-Z]{4}(?:3|4|11|34))\b`)
	regexExplicitPrice = regexp.MustCompile(`(?i)(?:abaixo|acima|menor|maior|cair|subir|ultrapassar|atingir|r\$)\s*(?:de|que|em)?\s*(?:r\$)?\s*([0-9]+(?:\.[0-9]{3})*(?:,[0-9]{2})?|[0-9]+)`)
	regexOpBelow       = regexp.MustCompile(`(?i)\b(abaixo|menor|cair|queda|despencar)\b`)
	regexFlightIATA    = regexp.MustCompile(`\b([A-Z]{2,3})\s*(?:para|pra|->|a)\s*([A-Z]{2,3})\b`)
	regexFlightNumber  = regexp.MustCompile(`(?i)\b([A-Z0-9]{2}\s*\d{3,4})\b`)
)

// BuildTriggerSearchPlan gera o plano de busca estruturado com base em regras heurísticas de alta precisão.
func BuildTriggerSearchPlan(title, query string, category domain.TriggerCategory) domain.TriggerSearchConfig {
	combined := strings.TrimSpace(title + " " + query)
	config := domain.TriggerSearchConfig{
		MaxAgeHours: 48,
	}

	cleanQ := CleanSearchQuery(query, string(category))
	if cleanQ == "" {
		cleanQ = CleanSearchQuery(title, string(category))
	}

	// 1. Finanças / Bolsa / Câmbio
	if category == domain.CategoryFinance || strings.Contains(strings.ToLower(combined), "ações") ||
		strings.Contains(strings.ToLower(combined), "b3") || strings.Contains(strings.ToLower(combined), "ticker") {
		if m := regexTicker.FindStringSubmatch(strings.ToUpper(combined)); len(m) > 1 {
			config.Ticker = m[1]
			config.Queries = []string{
				fmt.Sprintf("%s cotação hoje", config.Ticker),
				fmt.Sprintf("%s b3 resultado fato relevante", config.Ticker),
			}
		} else {
			config.Queries = []string{cleanQ + " cotação", cleanQ + " mercado financeiro"}
		}

		config.ComparisonOp = "lte"
		if !regexOpBelow.MatchString(combined) && (strings.Contains(strings.ToLower(combined), "acima") || strings.Contains(strings.ToLower(combined), "maior")) {
			config.ComparisonOp = "gte"
		}
		if val := extractTargetNumber(combined); val != nil {
			config.TargetValue = val
		}
		config.MaxAgeHours = 24
		return config
	}

	// 2. Shopping / Preços / E-commerce
	if category == domain.CategoryShopping || IsShoppingOrPriceQuery(query, title, string(category)) {
		config.ExcludeTerms = []string{
			"capa", "capinha", "pelicula", "película", "case", "suporte",
			"usado", "defeito", "peças", "aluguel", "caixa vazia",
		}
		config.MustIncludeTerms = []string{"novo", "original"}
		config.Queries = []string{
			fmt.Sprintf("%s menor preço mercado livre", cleanQ),
			fmt.Sprintf("%s promoção amazon kabum magalu", cleanQ),
			fmt.Sprintf("%s comprar", cleanQ),
		}
		config.ComparisonOp = "lte"
		if val := extractTargetNumber(combined); val != nil {
			config.TargetValue = val
		}
		config.MaxAgeHours = 48
		return config
	}

	// 3. Vagas de Emprego / Carreira
	if category == domain.CategoryCareer || strings.Contains(strings.ToLower(combined), "vaga") ||
		strings.Contains(strings.ToLower(combined), "emprego") || strings.Contains(strings.ToLower(combined), "contrata") {
		config.ExcludeTerms = []string{
			"curso", "bootcamp", "treinamento", "vaga encerrada",
			"inscrições encerradas", "no longer accepting",
		}
		config.Queries = []string{
			fmt.Sprintf("site:gupy.io \"vaga\" %s", cleanQ),
			fmt.Sprintf("site:linkedin.com/jobs %s", cleanQ),
			fmt.Sprintf("site:vagas.com.br %s", cleanQ),
		}
		config.MaxAgeHours = 72
		return config
	}

	// 4. Concursos Públicos
	if category == domain.CategoryPublicExams || strings.Contains(strings.ToLower(combined), "concurso") ||
		strings.Contains(strings.ToLower(combined), "edital") {
		config.ExcludeTerms = []string{
			"cursinho", "apostila", "preparatório", "simulado", "rumor",
			"especulação", "pode sair", "previsto",
		}
		config.Queries = []string{
			fmt.Sprintf("site:in.gov.br \"edital\" %s", cleanQ),
			fmt.Sprintf("pci concursos %s", cleanQ),
			fmt.Sprintf("concurso %s banca organizadora edital", cleanQ),
		}
		config.MaxAgeHours = 48
		return config
	}

	// 5. Viagens / Voos
	if category == domain.CategoryTravel || strings.Contains(strings.ToLower(combined), "voo") ||
		strings.Contains(strings.ToLower(combined), "passagem") {
		if m := regexFlightIATA.FindStringSubmatch(strings.ToUpper(combined)); len(m) > 2 {
			config.OriginIATA = m[1]
			config.DestinationIATA = m[2]
			config.Queries = []string{
				fmt.Sprintf("passagem aérea %s para %s promoção", config.OriginIATA, config.DestinationIATA),
				fmt.Sprintf("voo %s %s menor preço", config.OriginIATA, config.DestinationIATA),
			}
		} else if m := regexFlightNumber.FindStringSubmatch(strings.ToUpper(combined)); len(m) > 1 {
			config.FlightNumber = strings.ReplaceAll(m[1], " ", "")
			config.Queries = []string{
				fmt.Sprintf("voo %s status horário portão", config.FlightNumber),
			}
		} else {
			config.Queries = []string{cleanQ + " voo status", cleanQ + " passagem aérea"}
		}
		if val := extractTargetNumber(combined); val != nil {
			config.TargetValue = val
		}
		config.MaxAgeHours = 24
		return config
	}

	// 6. Notícias / Default
	config.Queries = []string{
		cleanQ,
		cleanQ + " últimas notícias hoje",
	}
	config.MaxAgeHours = 24
	return config
}

// BuildTriggerSearchPlanWithAI utiliza o modelo de linguagem para refinar o plano de busca se disponível.
func BuildTriggerSearchPlanWithAI(ctx context.Context, generator TextGeneratorProvider, userPrompt string, defaultCat domain.TriggerCategory) (domain.TriggerSearchConfig, error) {
	if generator == nil {
		return BuildTriggerSearchPlan("Radar", userPrompt, defaultCat), nil
	}

	sysPrompt := `Você é o planejador de buscas e coletores do assistente Vito.
Analise a solicitação de radar do usuário e devolva um plano JSON com o formato:
{
  "category": "finance|shopping|career|public_exams|travel|news",
  "queries": ["query 1 com operadores", "query 2"],
  "must_include_terms": ["termo1"],
  "exclude_terms": ["termo_indesejado"],
  "ticker": "PETR4 (se finanças)",
  "target_value": 35.0 (numérico ou null),
  "comparison_op": "lte|gte (se numérico)",
  "origin_iata": "GRU (se voo)",
  "destination_iata": "SSA (se voo)",
  "flight_number": "LA3340 (se voo específico)",
  "max_age_hours": 24
}
Responda EXCLUSIVAMENTE em JSON válido, sem comentários.`

	respText, err := generator.GenerateText(ctx, sysPrompt, userPrompt)
	if err != nil {
		return BuildTriggerSearchPlan("Radar", userPrompt, defaultCat), nil
	}

	var plan domain.TriggerSearchConfig
	clean := strings.TrimSpace(respText)
	if start := strings.Index(clean, "{"); start != -1 {
		if end := strings.LastIndex(clean, "}"); end != -1 && end > start {
			clean = clean[start : end+1]
		}
	}

	if err := json.Unmarshal([]byte(clean), &plan); err != nil || len(plan.Queries) == 0 {
		return BuildTriggerSearchPlan("Radar", userPrompt, defaultCat), nil
	}

	return plan, nil
}

func extractTargetNumber(text string) *float64 {
	if m := regexExplicitPrice.FindStringSubmatch(text); len(m) > 1 {
		raw := strings.TrimSpace(m[1])
		raw = strings.ReplaceAll(raw, ".", "")
		raw = strings.ReplaceAll(raw, ",", ".")
		if val, err := strconv.ParseFloat(raw, 64); err == nil && val > 0 {
			return &val
		}
	}
	return nil
}
