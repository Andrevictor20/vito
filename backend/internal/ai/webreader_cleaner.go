package ai

import (
	"bytes"
	"strings"

	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

// DefaultMaxContentChars limite padrão de caracteres (aproximadamente 3.000 tokens) para o contexto de IA.
const DefaultMaxContentChars = 12000

// ExtractTitleAndMarkdown extrai o título canônico e converte o corpo relevante do HTML em Markdown limpo.
func ExtractTitleAndMarkdown(rawHTML string) (title string, markdown string) {
	doc, err := html.Parse(strings.NewReader(rawHTML))
	if err != nil {
		return "", strings.TrimSpace(rawHTML)
	}

	title = extractTitle(doc)

	var buf bytes.Buffer
	renderNodeToMarkdown(&buf, doc)

	rawMD := buf.String()
	cleanMD := cleanMarkdownWhitespace(rawMD)

	if title == "" {
		title = fallbackTitleFromMarkdown(cleanMD)
	}

	return title, cleanMD
}

// TruncateMarkdown limita o texto a maxChars mantendo introdução e conclusão para compreensão da IA.
func TruncateMarkdown(content string, maxChars int) string {
	if maxChars <= 0 {
		maxChars = DefaultMaxContentChars
	}
	content = strings.TrimSpace(content)
	if len(content) <= maxChars {
		return content
	}

	const marker = "\n\n... [conteúdo intermediário resumido para otimização de contexto] ...\n\n"
	budget := maxChars - len(marker)
	if budget <= 0 {
		return content[:maxChars]
	}

	headChars := (budget * 7) / 10
	tailChars := budget - headChars

	// Tenta quebrar em quebras de linha limpas
	head := content[:headChars]
	if lastNL := strings.LastIndex(head, "\n"); lastNL > headChars/2 {
		head = head[:lastNL]
	}

	tailStart := len(content) - tailChars
	tail := content[tailStart:]
	if firstNL := strings.Index(tail, "\n"); firstNL != -1 && firstNL < tailChars/2 {
		tail = tail[firstNL+1:]
	}

	return strings.TrimSpace(head) + marker + strings.TrimSpace(tail)
}

func extractTitle(n *html.Node) string {
	var ogTitle, metaTitle, docTitle string

	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if node.Type == html.ElementNode {
			if node.DataAtom == atom.Title && node.FirstChild != nil {
				docTitle = strings.TrimSpace(node.FirstChild.Data)
			}
			if node.DataAtom == atom.Meta {
				var prop, name, content string
				for _, a := range node.Attr {
					switch strings.ToLower(a.Key) {
					case "property":
						prop = a.Val
					case "name":
						name = a.Val
					case "content":
						content = strings.TrimSpace(a.Val)
					}
				}
				if strings.EqualFold(prop, "og:title") && content != "" {
					ogTitle = content
				} else if (strings.EqualFold(name, "twitter:title") || strings.EqualFold(name, "title")) && content != "" {
					metaTitle = content
				}
			}
		}
		for c := node.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(n)

	t := ogTitle
	if t == "" {
		t = metaTitle
	}
	if t == "" {
		t = docTitle
	}

	return cleanTitleSuffix(t)
}

func cleanTitleSuffix(t string) string {
	t = strings.TrimSpace(t)
	// Remove sufixos comuns de portais (ex: "Notícia - G1", "Tech - UOL")
	for _, sep := range []string{" | ", " - ", " – ", " — "} {
		if idx := strings.LastIndex(t, sep); idx != -1 && idx > len(t)/3 {
			t = strings.TrimSpace(t[:idx])
		}
	}
	return t
}

func fallbackTitleFromMarkdown(md string) string {
	lines := strings.Split(md, "\n")
	for _, l := range lines {
		l = strings.TrimSpace(l)
		if strings.HasPrefix(l, "# ") {
			return strings.TrimSpace(strings.TrimPrefix(l, "# "))
		}
	}
	return "Página Web"
}

func isIgnoredTag(a atom.Atom) bool {
	switch a {
	case atom.Script, atom.Style, atom.Svg, atom.Noscript, atom.Iframe,
		atom.Nav, atom.Footer, atom.Header, atom.Aside, atom.Form,
		atom.Button, atom.Input, atom.Select, atom.Textarea, atom.Template,
		atom.Audio, atom.Video, atom.Source, atom.Canvas:
		return true
	default:
		return false
	}
}

func renderNodeToMarkdown(buf *bytes.Buffer, n *html.Node) {
	if n == nil {
		return
	}

	if n.Type == html.ElementNode {
		if isIgnoredTag(n.DataAtom) {
			return
		}
		// Ignora nós com classes ou IDs de ruído/anúncios
		for _, a := range n.Attr {
			val := strings.ToLower(a.Val)
			if (a.Key == "class" || a.Key == "id") &&
				(strings.Contains(val, "ad-") || strings.Contains(val, "banner") ||
					strings.Contains(val, "cookie") || strings.Contains(val, "social-share")) {
				return
			}
		}
	}

	switch n.Type {
	case html.TextNode:
		text := strings.ReplaceAll(n.Data, "\n", " ")
		text = strings.ReplaceAll(text, "\t", " ")
		buf.WriteString(text)

	case html.ElementNode:
		prefix, suffix := getTagMarkdownWrapper(n)
		buf.WriteString(prefix)

		for c := n.FirstChild; c != nil; c = c.NextSibling {
			renderNodeToMarkdown(buf, c)
		}

		buf.WriteString(suffix)

	default:
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			renderNodeToMarkdown(buf, c)
		}
	}
}

func getTagMarkdownWrapper(n *html.Node) (prefix, suffix string) {
	switch n.DataAtom {
	case atom.H1:
		return "\n\n# ", "\n\n"
	case atom.H2:
		return "\n\n## ", "\n\n"
	case atom.H3:
		return "\n\n### ", "\n\n"
	case atom.H4, atom.H5, atom.H6:
		return "\n\n#### ", "\n\n"
	case atom.P:
		return "\n\n", "\n\n"
	case atom.Br:
		return "\n", ""
	case atom.Li:
		return "\n- ", ""
	case atom.Blockquote:
		return "\n\n> ", "\n\n"
	case atom.Strong, atom.B:
		return "**", "**"
	case atom.Em, atom.I:
		return "*", "*"
	case atom.Code:
		return "`", "`"
	case atom.Pre:
		return "\n\n```\n", "\n```\n\n"
	case atom.Tr:
		return "\n| ", " |"
	case atom.Td, atom.Th:
		return "", " | "
	default:
		return "", ""
	}
}

func cleanMarkdownWhitespace(md string) string {
	lines := strings.Split(md, "\n")
	var cleaned []string
	consecutiveBlank := 0

	for _, line := range lines {
		trimmed := strings.TrimRight(line, " \t\r")
		if strings.TrimSpace(trimmed) == "" {
			consecutiveBlank++
			if consecutiveBlank <= 2 {
				cleaned = append(cleaned, "")
			}
		} else {
			consecutiveBlank = 0
			// Reduz múltiplos espaços internos para 1 espaço
			trimmed = strings.Join(strings.Fields(trimmed), " ")
			cleaned = append(cleaned, trimmed)
		}
	}
	return strings.TrimSpace(strings.Join(cleaned, "\n"))
}
