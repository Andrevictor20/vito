package ai

import (
	"regexp"
	"strings"
	"unicode"
)

var conversationalPrefixes = []*regexp.Regexp{
	regexp.MustCompile(`(?i)^\s*(quero\s+que\s+(você\s+)?(acompanhe|monitore|me\s+avise|veja|pesquise)(\s+(do|de|da|sobre|o|a|os|as))?\s*)`),
	regexp.MustCompile(`(?i)^\s*(acompanhe|monitore|me\s+avise|fique\s+de\s+olho|noticias\s+sobre|notícias\s+sobre|avisar\s+quando|verificar\s+quando)(\s+(de|do|da|sobre|o|a|os|as))?\s*`),
	regexp.MustCompile(`(?i)^\s*(qual\s+o|quanto\s+tá|quanto\s+esta|menor\s+preço\s+do|menor\s+preco\s+do|preço\s+do|preco\s+do)(\s+(celular|aparelho|smartphone|produto|item))?\s*`),
}

var redundantFillers = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\b(por\s+favor|me\s+avise|se\s+baixar|se\s+cair|no\s+brasil|em\s+reais)\b`),
}

// CleanSearchQuery extrai os termos essenciais de pesquisa a partir de uma frase conversacional de radar.
func CleanSearchQuery(raw, category string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}

	// 1. Remove prefixos conversacionais repetidos
	changed := true
	for changed {
		changed = false
		for _, re := range conversationalPrefixes {
			if loc := re.FindStringIndex(s); loc != nil && loc[0] == 0 {
				s = strings.TrimSpace(s[loc[1]:])
				changed = true
			}
		}
	}

	// 2. Remove conectivos e preenchimentos redundantes
	for _, re := range redundantFillers {
		s = re.ReplaceAllString(s, " ")
	}

	// 3. Normaliza pontuação e múltiplos espaços
	var b strings.Builder
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '-' {
			b.WriteRune(r)
		} else {
			b.WriteRune(' ')
		}
	}

	words := strings.Fields(b.String())
	if len(words) == 0 {
		return strings.TrimSpace(raw)
	}

	cleaned := strings.Join(words, " ")
	return cleaned
}

// ContainsWordIgnoreCase verifica se uma palavra inteira está presente na string, ignorando maiúsculas/minúsculas.
func ContainsWordIgnoreCase(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}
