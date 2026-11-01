package ai

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

func TestWebReaderService_NativeL1(t *testing.T) {
	origLookup := lookupIPFunc
	defer func() { lookupIPFunc = origLookup }()

	// Servidor mock simulando página estática de notícia
	var nativeHits int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&nativeHits, 1)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`<!DOCTYPE html>
<html>
<head>
  <title>Notícia Importante - Portal Confiável</title>
  <meta property="og:title" content="Notícia Importante">
</head>
<body>
  <nav><a href="/">Início</a></nav>
  <article>
    <h1>Título da Reportagem Completa</h1>
    <p>O mercado de tecnologia no Brasil registrou um crescimento expressivo de 15%% no último trimestre, impulsionado pela adoção contínua de inteligência artificial aplicada à produtividade e automação corporativa.</p>
    <p>Especialistas apontam que investimentos em servidores locais, privacidade de dados e conformidade com a LGPD lideram a lista de prioridades das empresas nacionais.</p>
    <h2>Dados do Setor</h2>
    <p>A pesquisa detalhou que mais de 500 companhias participaram do levantamento nacional em São Paulo e Florianópolis.</p>
  </article>
  <footer>Rodapé com direitos reservados.</footer>
</body>
</html>`))
	}))
	defer server.Close()

	lookupIPFunc = func(ctx context.Context, host string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("93.184.216.34")}, nil
	}

	mockClient := &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			if strings.Contains(req.URL.String(), "example.com") {
				testReq, _ := http.NewRequest(req.Method, server.URL, req.Body)
				return server.Client().Transport.RoundTrip(testReq)
			}
			return http.DefaultTransport.RoundTrip(req)
		}),
	}
	reader := NewWebReaderService(mockClient)

	page, err := reader.ReadURL(context.Background(), "https://example.com/noticia")
	if err != nil {
		t.Fatalf("ReadURL falhou: %v", err)
	}

	if page.Source != "native" {
		t.Errorf("esperava source 'native', obteve %q", page.Source)
	}
	if !strings.Contains(page.Title, "Notícia Importante") {
		t.Errorf("título inesperado: %q", page.Title)
	}
	if !strings.Contains(page.Markdown, "crescimento expressivo") {
		t.Errorf("conteúdo markdown ausente no texto extraído: %q", page.Markdown)
	}
	if strings.Contains(page.Markdown, "Rodapé com direitos") {
		t.Errorf("rodapé não foi filtrado: %q", page.Markdown)
	}

	// Testa Cache: segunda chamada não deve bater no transport
	cachedHitsBefore := atomic.LoadInt32(&nativeHits)
	cachedPage, err := reader.ReadURL(context.Background(), "https://example.com/noticia")
	if err != nil {
		t.Fatalf("ReadURL cache falhou: %v", err)
	}
	if cachedPage.Markdown != page.Markdown {
		t.Errorf("conteúdo do cache difere do original")
	}
	if atomic.LoadInt32(&nativeHits) != cachedHitsBefore {
		t.Errorf("esperava acerto de cache, mas o servidor foi acionado novamente")
	}
}

func TestWebReaderService_FallbackJina_OnSPA(t *testing.T) {
	origLookup := lookupIPFunc
	defer func() { lookupIPFunc = origLookup }()

	lookupIPFunc = func(ctx context.Context, host string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("93.184.216.34")}, nil
	}

	var jinaCalled int32
	mockTransport := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		if strings.Contains(req.URL.String(), "r.jina.ai") {
			atomic.AddInt32(&jinaCalled, 1)
			recorder := httptest.NewRecorder()
			recorder.WriteHeader(http.StatusOK)
			_, _ = recorder.Write([]byte(`Title: SPA Web Application Rendered
Markdown Content:
# SPA Web Application Rendered
Este é o conteúdo renderizado via motor Jina com execução completa de JavaScript.
A aplicação Next.js renderizou a lista de recursos e dados em tempo real.`))
			return recorder.Result(), nil
		}

		// L1: Retorna HTML de SPA vazio (<200 chars)
		recorder := httptest.NewRecorder()
		recorder.WriteHeader(http.StatusOK)
		_, _ = recorder.Write([]byte(`<!DOCTYPE html><html><head><title>SPA App</title></head><body><div id="root"></div></body></html>`))
		return recorder.Result(), nil
	})

	reader := NewWebReaderService(&http.Client{Transport: mockTransport})
	page, err := reader.ReadURL(context.Background(), "https://example.com/spa-app")
	if err != nil {
		t.Fatalf("ReadURL com fallback Jina falhou: %v", err)
	}

	if atomic.LoadInt32(&jinaCalled) == 0 {
		t.Errorf("Jina Reader deveria ter sido acionado para SPA vazio")
	}
	if page.Source != "jina_reader" {
		t.Errorf("esperava source 'jina_reader', obteve %q", page.Source)
	}
	if !strings.Contains(page.Markdown, "renderizado via motor Jina") {
		t.Errorf("conteúdo retornado não veio do Jina: %q", page.Markdown)
	}
}

func TestWebReaderService_FallbackJina_On403Forbidden(t *testing.T) {
	origLookup := lookupIPFunc
	defer func() { lookupIPFunc = origLookup }()

	lookupIPFunc = func(ctx context.Context, host string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("93.184.216.34")}, nil
	}

	var jinaCalled int32
	mockTransport := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		if strings.Contains(req.URL.String(), "r.jina.ai") {
			atomic.AddInt32(&jinaCalled, 1)
			recorder := httptest.NewRecorder()
			recorder.WriteHeader(http.StatusOK)
			_, _ = recorder.Write([]byte(`Title: Notícia Desbloqueada
Markdown Content:
# Conteúdo Desbloqueado com Sucesso
Acesso permitido pelo Jina Reader contornando proteção de bot ou Cloudflare.`))
			return recorder.Result(), nil
		}

		// L1: Retorna 403 Forbidden (Cloudflare)
		recorder := httptest.NewRecorder()
		recorder.WriteHeader(http.StatusForbidden)
		_, _ = recorder.Write([]byte(`<html><body>Error 403: Forbidden Cloudflare</body></html>`))
		return recorder.Result(), nil
	})

	reader := NewWebReaderService(&http.Client{Transport: mockTransport})
	page, err := reader.ReadURL(context.Background(), "https://example.com/protected-article")
	if err != nil {
		t.Fatalf("ReadURL com 403 falhou: %v", err)
	}

	if atomic.LoadInt32(&jinaCalled) == 0 {
		t.Errorf("esperava chamada ao Jina após 403")
	}
	if page.Source != "jina_reader" {
		t.Errorf("esperava source 'jina_reader', obteve %q", page.Source)
	}
	if !strings.Contains(page.Markdown, "Desbloqueado com Sucesso") {
		t.Errorf("conteúdo esperado não retornado: %q", page.Markdown)
	}
}

func TestWebReaderService_Truncation(t *testing.T) {
	hugeText := strings.Repeat("Texto longo para teste de truncamento do leitor web. ", 400)
	truncated := TruncateMarkdown(hugeText, 500)
	if len(truncated) > 600 { // 500 + margem do marker
		t.Errorf("truncamento falhou, tamanho %d", len(truncated))
	}
	if !strings.Contains(truncated, "[conteúdo intermediário resumido") {
		t.Errorf("marcador de truncamento não encontrado")
	}
}

func TestWebReaderService_RedirectToSSRFBlocked(t *testing.T) {
	origLookup := lookupIPFunc
	defer func() { lookupIPFunc = origLookup }()

	lookupIPFunc = func(ctx context.Context, host string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("93.184.216.34")}, nil
	}

	mockTransport := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		recorder := httptest.NewRecorder()
		recorder.Header().Set("Location", "http://127.0.0.1:8180/api/v1/users")
		recorder.WriteHeader(http.StatusFound)
		return recorder.Result(), nil
	})

	reader := NewWebReaderService(&http.Client{Transport: mockTransport})
	_, err := reader.ReadURL(context.Background(), "https://example.com/redirect-to-internal")
	if err == nil {
		t.Fatalf("esperava erro ao tentar redirecionar para IP local 127.0.0.1")
	}
	if !strings.Contains(err.Error(), "SSRF") && !strings.Contains(err.Error(), "loopback") && !strings.Contains(err.Error(), "bloqueado") {
		t.Errorf("mensagem de erro esperada sobre SSRF, obteve: %v", err)
	}
}

type roundTripFunc func(req *http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}
