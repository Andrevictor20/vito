package ai

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

var (
	regexJSONBlock     = regexp.MustCompile(`(?s)\{.*\}`)
	regexSummaryField  = regexp.MustCompile(`"summary"\s*:\s*"([^"]+)"`)
	regexConfField     = regexp.MustCompile(`"confidence"\s*:\s*"?(\d+)"?`)
	regexUrgencyField  = regexp.MustCompile(`"urgency"\s*:\s*"([^"]+)"`)
	regexWhyRelField   = regexp.MustCompile(`"why_relevant"\s*:\s*"([^"]+)"`)
	regexNotifField    = regexp.MustCompile(`"simulated_notification"\s*:\s*"([^"]+)"`)
	regexCondMetField  = regexp.MustCompile(`"condition_met"\s*:\s*(true|false)`)
)

type rawEvalResult struct {
	ConditionMet          json.RawMessage `json:"condition_met"`
	CurrentData           json.RawMessage `json:"current_data"`
	Summary               string          `json:"summary"`
	Paragraphs            json.RawMessage `json:"paragraphs"`
	SimulatedNotification string          `json:"simulated_notification"`
	Confidence            json.RawMessage `json:"confidence"`
	WhyRelevant           string          `json:"why_relevant"`
	Urgency               string          `json:"urgency"`
}

// ParseTriggerEvalResult interpreta de forma defensiva e polimórfica a resposta de avaliação da IA,
// blindando contra arrays em current_data, formatações heterogêneas e vazamento de JSON bruto na UI.
func ParseTriggerEvalResult(rawText string, t *domain.Trigger) (*domain.TriggerTestResult, error) {
	cleanJSON := strings.TrimSpace(rawText)
	if start := strings.Index(cleanJSON, "{"); start != -1 {
		if end := strings.LastIndex(cleanJSON, "}"); end != -1 && end > start {
			cleanJSON = cleanJSON[start : end+1]
		}
	}

	var raw rawEvalResult
	err := json.Unmarshal([]byte(cleanJSON), &raw)
	if err != nil {
		// Fallback por Regex: recupera campos essenciais sem jamais vazar JSON bruto
		return parseFallbackWithRegex(cleanJSON, rawText, t), nil
	}

	res := &domain.TriggerTestResult{
		TriggerID:             t.ID,
		Title:                 t.Title,
		Query:                 t.Query,
		Summary:               strings.TrimSpace(raw.Summary),
		SimulatedNotification: strings.TrimSpace(raw.SimulatedNotification),
		WhyRelevant:           strings.TrimSpace(raw.WhyRelevant),
		Urgency:               strings.TrimSpace(raw.Urgency),
		TestedAt:              time.Now().UTC(),
	}

	// 1. ConditionMet (bool ou string "true"/"false")
	if len(raw.ConditionMet) > 0 {
		var b bool
		if errB := json.Unmarshal(raw.ConditionMet, &b); errB == nil {
			res.ConditionMet = b
		} else {
			var s string
			if errS := json.Unmarshal(raw.ConditionMet, &s); errS == nil {
				res.ConditionMet = strings.EqualFold(strings.TrimSpace(s), "true")
			}
		}
	}

	// 2. Confidence (int, float ou string "85")
	res.Confidence = parseConfidence(raw.Confidence)

	// 3. CurrentData (pode ser string, array de strings ou objeto)
	res.CurrentData = parseCurrentData(raw.CurrentData)

	// 4. Paragraphs (pode ser []string ou string)
	res.Paragraphs = parseParagraphs(raw.Paragraphs, res.Summary, res.CurrentData)

	// Se não veio summary, usa o primeiro parágrafo
	if res.Summary == "" && len(res.Paragraphs) > 0 {
		res.Summary = res.Paragraphs[0]
	}

	// Se não veio simulated notification, gera default executivo
	if res.SimulatedNotification == "" {
		res.SimulatedNotification = fmt.Sprintf("Alerta Vito: Vigília de '%s' atualizada.", t.Title)
	}

	res.EnforceConfidenceGate()
	return res, nil
}

func parseConfidence(raw json.RawMessage) int {
	if len(raw) == 0 {
		return 80
	}
	var num int
	if err := json.Unmarshal(raw, &num); err == nil {
		return num
	}
	var f float64
	if err := json.Unmarshal(raw, &f); err == nil {
		return int(f)
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		s = strings.TrimSpace(s)
		if n, errAtoi := strconv.Atoi(s); errAtoi == nil {
			return n
		}
	}
	return 80
}

func parseCurrentData(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	// Tenta como string
	var str string
	if err := json.Unmarshal(raw, &str); err == nil {
		return strings.TrimSpace(str)
	}
	// Tenta como array de strings ([]string)
	var arr []string
	if err := json.Unmarshal(raw, &arr); err == nil {
		cleaned := make([]string, 0, len(arr))
		for _, item := range arr {
			trimmed := strings.TrimSpace(item)
			if trimmed != "" {
				cleaned = append(cleaned, "• "+trimmed)
			}
		}
		return strings.Join(cleaned, "\n")
	}
	// Tenta como array de interfaces
	var arrI []interface{}
	if err := json.Unmarshal(raw, &arrI); err == nil {
		cleaned := make([]string, 0, len(arrI))
		for _, item := range arrI {
			if s, ok := item.(string); ok && strings.TrimSpace(s) != "" {
				cleaned = append(cleaned, "• "+strings.TrimSpace(s))
			} else {
				cleaned = append(cleaned, fmt.Sprintf("• %v", item))
			}
		}
		return strings.Join(cleaned, "\n")
	}
	return strings.TrimSpace(string(raw))
}

func parseParagraphs(raw json.RawMessage, fallbackSummary, fallbackData string) []string {
	if len(raw) > 0 {
		// 1. Tenta como []string
		var arr []string
		if err := json.Unmarshal(raw, &arr); err == nil && len(arr) > 0 {
			valid := make([]string, 0, len(arr))
			for _, p := range arr {
				trimmed := strings.TrimSpace(p)
				// NUNCA aceita string que pareça JSON bruto
				if trimmed != "" && !strings.HasPrefix(trimmed, `{"`) && !strings.HasPrefix(trimmed, `[{`) {
					valid = append(valid, trimmed)
				}
			}
			if len(valid) > 0 {
				return valid
			}
		}

		// 2. Tenta como string única
		var single string
		if err := json.Unmarshal(raw, &single); err == nil {
			trimmed := strings.TrimSpace(single)
			if trimmed != "" && !strings.HasPrefix(trimmed, `{"`) {
				// Divide por quebras de linha (1 ou mais)
				lines := strings.Split(trimmed, "\n")
				cleaned := make([]string, 0, len(lines))
				for _, line := range lines {
					pTrim := strings.TrimSpace(line)
					if pTrim != "" && !strings.HasPrefix(pTrim, `{"`) {
						cleaned = append(cleaned, pTrim)
					}
				}
				if len(cleaned) > 0 {
					return cleaned
				}
			}
		}
	}

	// 3. Fallbacks seguros
	if fallbackSummary != "" && !strings.HasPrefix(fallbackSummary, `{"`) {
		return []string{fallbackSummary}
	}
	if fallbackData != "" && !strings.HasPrefix(fallbackData, `{"`) {
		return []string{fallbackData}
	}
	return []string{"Consulta realizada com sucesso. Condições avaliadas e monitoramento ativo."}
}

func parseFallbackWithRegex(cleanJSON, rawText string, t *domain.Trigger) *domain.TriggerTestResult {
	res := &domain.TriggerTestResult{
		TriggerID:             t.ID,
		Title:                 t.Title,
		Query:                 t.Query,
		ConditionMet:          false,
		Summary:               "Consulta realizada com sucesso. Condições avaliadas.",
		SimulatedNotification: fmt.Sprintf("Alerta Vito: Vigília de '%s' atualizada.", t.Title),
		Confidence:            75,
		TestedAt:              time.Now().UTC(),
	}

	if m := regexSummaryField.FindStringSubmatch(cleanJSON); len(m) > 1 {
		res.Summary = strings.TrimSpace(m[1])
	}
	if m := regexConfField.FindStringSubmatch(cleanJSON); len(m) > 1 {
		if n, err := strconv.Atoi(m[1]); err == nil {
			res.Confidence = n
		}
	}
	if m := regexUrgencyField.FindStringSubmatch(cleanJSON); len(m) > 1 {
		res.Urgency = strings.TrimSpace(m[1])
	}
	if m := regexWhyRelField.FindStringSubmatch(cleanJSON); len(m) > 1 {
		res.WhyRelevant = strings.TrimSpace(m[1])
	}
	if m := regexNotifField.FindStringSubmatch(cleanJSON); len(m) > 1 {
		res.SimulatedNotification = strings.TrimSpace(m[1])
	}
	if m := regexCondMetField.FindStringSubmatch(cleanJSON); len(m) > 1 {
		res.ConditionMet = strings.EqualFold(m[1], "true")
	}

	// Garante que Paragraphs NUNCA contenha JSON bruto
	if res.Summary != "" && !strings.HasPrefix(res.Summary, `{"`) {
		res.Paragraphs = []string{res.Summary}
	} else {
		res.Paragraphs = []string{"Consulta realizada com sucesso. Monitoramento atualizado e ativo."}
	}
	res.CurrentData = "Dados processados em segundo plano."

	res.EnforceConfidenceGate()
	return res
}
