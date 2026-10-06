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
