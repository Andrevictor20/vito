package ai

import (
	"strings"
	"unicode"
)

// SentenceChunker fragmenta texto contínuo em sentenças completas para síntese TTS de baixa latência.
type SentenceChunker struct {
	buffer strings.Builder
}

// NewSentenceChunker inicializa um novo chunker.
func NewSentenceChunker() *SentenceChunker {
	return &SentenceChunker{}
}

// Feed processa um delta de texto e retorna quaisquer sentenças completas encontradas.
func (c *SentenceChunker) Feed(delta string) []string {
	if delta == "" {
		return nil
	}

	c.buffer.WriteString(delta)
	text := c.buffer.String()

	var sentences []string
	startIdx := 0

	runes := []rune(text)
	n := len(runes)

	for i := 0; i < n; i++ {
		r := runes[i]
		if r == '.' || r == '!' || r == '?' || r == '\n' {
			// Verifica se é uma pontuação terminal real ou abreviação/número
			if r == '.' {
				// Evita quebra em números (ex: 3.5)
				if i > 0 && unicode.IsDigit(runes[i-1]) && i+1 < n && unicode.IsDigit(runes[i+1]) {
					continue
				}
				// Evita quebra em abreviações comuns
				wordBefore := getWordBefore(runes, i)
				if isCommonAbbreviation(wordBefore) {
					continue
				}
			}

			// Para considerar fim de frase, deve haver espaço, quebra de linha ou ser o fim absoluto
			isTerminal := false
			if r == '\n' {
				isTerminal = true
			} else if i+1 < n && (unicode.IsSpace(runes[i+1]) || runes[i+1] == '"' || runes[i+1] == '\'') {
				isTerminal = true
			}

			if isTerminal {
				sentence := strings.TrimSpace(string(runes[startIdx : i+1]))
				if len(sentence) > 0 {
					sentences = append(sentences, sentence)
				}
				// Avança o startIdx pulando espaços subsequentes
				j := i + 1
				for j < n && unicode.IsSpace(runes[j]) {
					j++
				}
				startIdx = j
				i = j - 1
			}
		}
	}

	// Preserva o restante não terminado no buffer
	if startIdx < n {
		remaining := string(runes[startIdx:])
		c.buffer.Reset()
		c.buffer.WriteString(remaining)
	} else {
		c.buffer.Reset()
	}

	return sentences
}

// Flush esvazia e retorna qualquer texto residual remanescente no buffer.
func (c *SentenceChunker) Flush() string {
	remaining := strings.TrimSpace(c.buffer.String())
	c.buffer.Reset()
	return remaining
}

func getWordBefore(runes []rune, dotIdx int) string {
	start := dotIdx - 1
	for start >= 0 && unicode.IsLetter(runes[start]) {
		start--
	}
	return strings.ToLower(string(runes[start+1 : dotIdx]))
}

func isCommonAbbreviation(word string) bool {
	switch word {
	case "sr", "sra", "dr", "dra", "prof", "ex", "etc", "av", "r", "num", "art", "vol":
		return true
	default:
		return false
	}
}
