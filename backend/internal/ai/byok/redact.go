package byok

import "regexp"

var secretRedactionRules = []struct {
	pattern     *regexp.Regexp
	replacement string
}{
	{
		pattern:     regexp.MustCompile(`(?i)(authorization\s*:\s*bearer\s+)([^\s"';,]+)`),
		replacement: `${1}[REDACTED]`,
	},
	{
		pattern:     regexp.MustCompile(`(?i)((?:x-api-key|x-goog-api-key)\s*[:=]\s*)([^\s"';,]+)`),
		replacement: `${1}[REDACTED]`,
	},
	{
		pattern:     regexp.MustCompile(`sk-ant-[A-Za-z0-9_-]{8,}`),
		replacement: `[REDACTED]`,
	},
	{
		pattern:     regexp.MustCompile(`sk-or-(?:v1-)?[A-Za-z0-9_-]{8,}`),
		replacement: `[REDACTED]`,
	},
	{
		pattern:     regexp.MustCompile(`sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{12,}`),
		replacement: `[REDACTED]`,
	},
	{
		pattern:     regexp.MustCompile(`gsk_[A-Za-z0-9_-]{12,}`),
		replacement: `[REDACTED]`,
	},
	{
		pattern:     regexp.MustCompile(`AIza[0-9A-Za-z_-]{16,}`),
		replacement: `[REDACTED]`,
	},
}

// RedactSecrets mascara chaves de API e cabeçalhos de autenticação em logs e mensagens de erro.
func RedactSecrets(s string) string {
	if s == "" {
		return ""
	}
	out := s
	for _, rule := range secretRedactionRules {
		out = rule.pattern.ReplaceAllString(out, rule.replacement)
	}
	return out
}
