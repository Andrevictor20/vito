package ai

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
)

var trailingCommaRegex = regexp.MustCompile(`,\s*([}\]])`)

// SanitizeAndExtractJSON isola o bloco JSON mais interno, remove formatações markdown e corrige vírgulas sobressalentes.
func SanitizeAndExtractJSON(raw string) ([]byte, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, errors.New("conteúdo vazio recebido para extração de json")
	}

	// 1. Remove marcadores markdown ```json e ```
	if strings.Contains(trimmed, "```") {
		// Substitui delimitadores markdown no início/fim se presentes
		lines := strings.Split(trimmed, "\n")
		var filtered []string
		for _, line := range lines {
			l := strings.TrimSpace(line)
			if strings.HasPrefix(l, "```") {
				continue
			}
			filtered = append(filtered, line)
		}
		trimmed = strings.Join(filtered, "\n")
	}

	// 2. Localiza o primeiro '{' e o último '}'
	startIdx := strings.Index(trimmed, "{")
	endIdx := strings.LastIndex(trimmed, "}")

	if startIdx == -1 || endIdx == -1 || endIdx <= startIdx {
		return nil, fmt.Errorf("nenhum bloco json delimitado por chaves encontrado no texto (raw: %s)", raw)
	}

	extracted := trimmed[startIdx : endIdx+1]

	// 3. Corrige trailing commas antes de fechamento de objeto ou array: `,\s*([}\]])` -> `$1`
	cleaned := trailingCommaRegex.ReplaceAllString(extracted, "$1")

	// 4. Valida se o JSON resultante é sintaticamente aceito
	if !json.Valid([]byte(cleaned)) {
		return nil, fmt.Errorf("json extraído inválido após sanitização: %s", cleaned)
	}

	return []byte(cleaned), nil
}

// UnmarshalIntent sanitiza o texto bruto e realiza o unmarshal direto no ParsedIntent alvo.
func UnmarshalIntent(raw string, target *ParsedIntent) error {
	cleanBytes, err := SanitizeAndExtractJSON(raw)
	if err != nil {
		return err
	}

	if err := json.Unmarshal(cleanBytes, target); err != nil {
		return fmt.Errorf("falha ao decodificar json estruturado da ia: %w (raw: %s)", err, string(cleanBytes))
	}

	target.Action = IntentAction(strings.ToUpper(string(target.Action)))

	return nil
}

// ValidateIntent aplica strict schema + auto-reparo (§8.6/6): erro explícito em
// JSON inválido, reply vazio sem ações ou evento com fim<=início (gateway faz
// 1 retentativa com o erro antes do failover).
func ValidateIntent(intent *ParsedIntent) error {
	if intent == nil {
		return errors.New("intent nula após parse")
	}
	if intent.IsEmpty() {
		return errors.New("resposta vazia do provedor (sem message nem ações)")
	}
	if intent.Event != nil && !intent.Event.StartAt.IsZero() && !intent.Event.EndAt.IsZero() {
		if intent.Event.EndAt.Before(intent.Event.StartAt) || intent.Event.EndAt.Equal(intent.Event.StartAt) {
			return errors.New("evento com end_at anterior ou igual a start_at")
		}
	}
	return nil
}

// ParseAndNormalizeWithRepair sanitiza, decodifica e valida com 1 tentativa de
// reparo (remove cercas markdown residuais e vírgulas sobressalentes).
func ParseAndNormalizeWithRepair(raw string, target *ParsedIntent) error {
	if err := UnmarshalIntent(raw, target); err == nil {
		if verr := ValidateIntent(target); verr == nil {
			return nil
		} else {
			lastErr := verr
			// Reparo: tenta extrair novamente após trim agressivo.
			cleaned := strings.TrimSpace(raw)
			cleaned = strings.Trim(cleaned, "`")
			if err2 := UnmarshalIntent(cleaned, target); err2 == nil {
				if verr2 := ValidateIntent(target); verr2 == nil {
					return nil
				}
			}
			return lastErr
		}
	} else {
		// Reparo único com o erro exato antes do failover.
		cleaned := trailingCommaRegex.ReplaceAllString(strings.TrimSpace(raw), "$1")
		if err2 := UnmarshalIntent(cleaned, target); err2 == nil {
			if verr := ValidateIntent(target); verr == nil {
				return nil
			}
		}
		return err
	}
}
