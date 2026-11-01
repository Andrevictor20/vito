package ai

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// WebPageContent encapsula o conteúdo extraído de uma página web.
type WebPageContent struct {
	URL       string    `json:"url"`
	Title     string    `json:"title"`
	Markdown  string    `json:"markdown"`
	Source    string    `json:"source"` // "native" ou "jina_reader"
	FetchedAt time.Time `json:"fetched_at"`
}

// WebReader define o contrato de leitura aprofundada de páginas web.
type WebReader interface {
	ReadURL(ctx context.Context, targetURL string) (*WebPageContent, error)
}

type cachedPage struct {
	content   *WebPageContent
	expiresAt time.Time
}

// WebReaderService implementa o motor de leitura em dupla camada: nativo em Go (Camada 1)
// com fallback automático e transparente para o Jina Reader (Camada 2).
type WebReaderService struct {
	httpClient  *http.Client
	jinaBaseURL string
	cacheTTL    time.Duration
	maxChars    int
	cache       sync.Map
}

var (
	defaultWebReaderMu sync.RWMutex
	defaultWebReader   WebReader
)

// DefaultWebReader retorna a instância global configurada do leitor web.
func DefaultWebReader() WebReader {
	defaultWebReaderMu.RLock()
	defer defaultWebReaderMu.RUnlock()
	if defaultWebReader == nil {
		return NewWebReaderService(nil)
	}
	return defaultWebReader
}

// SetDefaultWebReader registra a instância global do leitor web.
func SetDefaultWebReader(r WebReader) {
	defaultWebReaderMu.Lock()
	defer defaultWebReaderMu.Unlock()
	defaultWebReader = r
}

// NewWebReaderService cria uma nova instância do serviço de leitura web.
func NewWebReaderService(client *http.Client) *WebReaderService {
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	if client.CheckRedirect == nil {
		client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return fmt.Errorf("limite de 10 redirecionamentos excedido")
			}
			if _, err := ValidateSafeURL(req.URL.String()); err != nil {
				return fmt.Errorf("redirecionamento bloqueado por segurança (SSRF): %w", err)
			}
			return nil
		}
	}
	return &WebReaderService{
		httpClient:  client,
		jinaBaseURL: "https://r.jina.ai",
		cacheTTL:    30 * time.Minute,
		maxChars:    DefaultMaxContentChars,
	}
}

// SetJinaBaseURL configura a URL base do Jina Reader (ex: para testes ou proxy).
func (s *WebReaderService) SetJinaBaseURL(baseURL string) {
	s.jinaBaseURL = strings.TrimRight(baseURL, "/")
}

// SetMaxChars configura o limite máximo de caracteres permitidos por extração.
func (s *WebReaderService) SetMaxChars(maxChars int) {
	s.maxChars = maxChars
}

// ReadURL executa a leitura aprofundada da URL solicitada com cache, proteção SSRF e fallback.
func (s *WebReaderService) ReadURL(ctx context.Context, targetURL string) (*WebPageContent, error) {
	parsedURL, err := ValidateSafeURL(targetURL)
	if err != nil {
		return nil, fmt.Errorf("url rejeitada por segurança (SSRF): %w", err)
	}

	canonicalURL := parsedURL.String()

	// 1. Checagem em Cache
	if val, ok := s.cache.Load(canonicalURL); ok {
		cp := val.(*cachedPage)
		if time.Now().Before(cp.expiresAt) {
			return cp.content, nil
		}
		s.cache.Delete(canonicalURL)
	}

	// 2. Camada 1: Fetch HTTP Nativo Go
	content, l1Err := s.fetchNativeL1(ctx, canonicalURL)
	if l1Err == nil && len(strings.TrimSpace(content.Markdown)) >= 200 {
		s.saveToCache(canonicalURL, content)
		return content, nil
	}

	// 3. Camada 2: Fallback Jina Reader (para SPAs, Cloudflare 403 ou conteúdo insuficiente)
	jinaContent, jinaErr := s.fetchJinaL2(ctx, canonicalURL)
	if jinaErr == nil {
		s.saveToCache(canonicalURL, jinaContent)
		return jinaContent, nil
	}

	// Se a Camada 1 obteve algum texto (mesmo <200 chars) e o Jina falhou, retorna o que conseguiu
	if content != nil && len(strings.TrimSpace(content.Markdown)) > 0 {
		s.saveToCache(canonicalURL, content)
		return content, nil
	}

	if l1Err != nil {
		return nil, fmt.Errorf("falha ao ler página web (L1: %v | Jina L2: %v)", l1Err, jinaErr)
	}
	return nil, fmt.Errorf("falha ao ler página web via Jina: %w", jinaErr)
}

func (s *WebReaderService) fetchNativeL1(ctx context.Context, targetURL string) (*WebPageContent, error) {
	reqCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 VitoAssistant/1.0")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("status http restrito %d (requer fallback)", resp.StatusCode)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status http %d", resp.StatusCode)
	}

	// Limita leitura a 5MB para evitar exaustão de memória
	lr := io.LimitReader(resp.Body, 5*1024*1024)
	bodyBytes, err := io.ReadAll(lr)
	if err != nil {
		return nil, err
	}

	rawHTML := string(bodyBytes)
	title, markdown := ExtractTitleAndMarkdown(rawHTML)
	truncated := TruncateMarkdown(markdown, s.maxChars)

	return &WebPageContent{
		URL:       targetURL,
		Title:     title,
		Markdown:  truncated,
		Source:    "native",
		FetchedAt: time.Now(),
	}, nil
}

func (s *WebReaderService) fetchJinaL2(ctx context.Context, targetURL string) (*WebPageContent, error) {
	reqCtx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()

	jinaURL := s.jinaBaseURL + "/" + targetURL
	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, jinaURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "text/plain")
	req.Header.Set("User-Agent", "VitoAssistant/1.0 (+https://vitoassistant.rasppi.cloud)")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("jina reader retornou status %d: %s", resp.StatusCode, string(b))
	}

	lr := io.LimitReader(resp.Body, 5*1024*1024)
	bodyBytes, err := io.ReadAll(lr)
	if err != nil {
		return nil, err
	}

	jinaOutput := string(bodyBytes)
	title, markdown := parseJinaOutput(jinaOutput, targetURL)
	truncated := TruncateMarkdown(markdown, s.maxChars)

	return &WebPageContent{
		URL:       targetURL,
		Title:     title,
		Markdown:  truncated,
		Source:    "jina_reader",
		FetchedAt: time.Now(),
	}, nil
}

func parseJinaOutput(output, fallbackURL string) (title string, markdown string) {
	lines := strings.Split(output, "\n")
	var mdLines []string
	captureMD := false

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "Title:") && title == "" {
			title = strings.TrimSpace(strings.TrimPrefix(trimmed, "Title:"))
			continue
		}
		if strings.HasPrefix(trimmed, "Markdown Content:") {
			captureMD = true
			continue
		}
		if captureMD {
			mdLines = append(mdLines, line)
		}
	}

	if len(mdLines) > 0 {
		markdown = strings.TrimSpace(strings.Join(mdLines, "\n"))
	} else {
		markdown = strings.TrimSpace(output)
	}

	if title == "" {
		title = fallbackTitleFromMarkdown(markdown)
	}
	if title == "" {
		title = fallbackURL
	}
	return title, markdown
}

func (s *WebReaderService) saveToCache(url string, content *WebPageContent) {
	s.cache.Store(url, &cachedPage{
		content:   content,
		expiresAt: time.Now().Add(s.cacheTTL),
	})
}
