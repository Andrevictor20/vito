package byok

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/platform/netsec"
)

const (
	// DefaultSSRFTimeout é o tempo máximo de requisição para endpoints customizados (§5.4).
	DefaultSSRFTimeout = 60 * time.Second
	// DefaultSSRFMaxBodyBytes é o limite máximo de leitura de resposta (8 MB, §5.4).
	DefaultSSRFMaxBodyBytes int64 = 8 * 1024 * 1024
)

var (
	errSSRFRedirectBlocked = errors.New("redirecionamento HTTP bloqueado por política anti-SSRF")
	errResponseTooLarge    = errors.New("resposta do endpoint excedeu o limite máximo permitido")
)

type ipLookupFunc func(ctx context.Context, host string) ([]net.IPAddr, error)

// ValidateCustomBaseURL valida URLs de endpoints compatíveis OpenAI contra SSRF (§5.4).
// Permite http:// exclusivamente para IPs privados RFC1918; hosts públicos exigem https://.
func ValidateCustomBaseURL(rawURL string, blockedLocalPort int) (*url.URL, error) {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return nil, errors.New("endereço do endpoint é obrigatório")
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return nil, fmt.Errorf("endereço inválido: %w", err)
	}

	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return nil, errors.New("O endereço precisa começar com http:// ou https://.")
	}
	parsed.Scheme = scheme

	if parsed.User != nil {
		return nil, errors.New("credenciais na URL não são permitidas")
	}

	host := strings.TrimSuffix(strings.ToLower(strings.TrimSpace(parsed.Hostname())), ".")
	if host == "" {
		return nil, errors.New("host da URL é obrigatório")
	}

	if netsec.IsBlockedInternalHostname(host, false) {
		return nil, fmt.Errorf("host %q bloqueado por política anti-SSRF", host)
	}

	effectivePort, err := resolveAndValidatePort(parsed.Port(), scheme)
	if err != nil {
		return nil, err
	}

	if ip := net.ParseIP(host); ip != nil {
		if err := netsec.ValidateTargetIPAndPort(ip, effectivePort, true, blockedLocalPort); err != nil {
			return nil, err
		}
		if scheme == "http" && !netsec.IsRFC1918IP(ip) {
			return nil, errors.New("http:// só é permitido para IPs privados RFC1918; use https:// para hosts públicos")
		}
		return parsed, nil
	}

	// Hostname (não IP literal): http:// não é permitido para hosts públicos.
	if scheme == "http" {
		return nil, errors.New("http:// só é permitido para IPs privados RFC1918; use https:// para hosts públicos")
	}

	return parsed, nil
}

// NewSafeHTTPClient cria um *http.Client com proteção anti-SSRF e anti-DNS-rebinding (§5.4).
// Revalida todo IP resolvido no momento da conexão, bloqueia redirecionamentos, limita timeout a 60s
// e impõe teto de 8MB no corpo da resposta.
func NewSafeHTTPClient(timeout time.Duration, maxBytes int64, blockedLocalPort int) *http.Client {
	return newSafeHTTPClientWithLookup(timeout, maxBytes, blockedLocalPort, nil)
}

func newSafeHTTPClientWithLookup(
	timeout time.Duration,
	maxBytes int64,
	blockedLocalPort int,
	lookup ipLookupFunc,
) *http.Client {
	if timeout <= 0 || timeout > DefaultSSRFTimeout {
		timeout = DefaultSSRFTimeout
	}
	if maxBytes <= 0 || maxBytes > DefaultSSRFMaxBodyBytes {
		maxBytes = DefaultSSRFMaxBodyBytes
	}

	transport := &http.Transport{
		Proxy:                 nil, // Impede bypass via HTTP_PROXY/HTTPS_PROXY
		DialContext:           newSafeDialContext(blockedLocalPort, lookup),
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          16,
		IdleConnTimeout:       30 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	return &http.Client{
		Timeout:   timeout,
		Transport: &cappedBodyRoundTripper{base: transport, maxBytes: maxBytes},
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return errSSRFRedirectBlocked
		},
	}
}

func newSafeDialContext(
	blockedLocalPort int,
	lookup ipLookupFunc,
) func(ctx context.Context, network, addr string) (net.Conn, error) {
	return netsec.NewSafeDialContext(netsec.SafeDialOptions{
		AllowRFC1918:      true,
		BlockedLocalPort:  blockedLocalPort,
		StrictDockerHosts: false,
		Lookup:            lookup,
	})
}

func resolveAndValidatePort(rawPort, scheme string) (int, error) {
	if rawPort != "" {
		portNum, err := strconv.Atoi(rawPort)
		if err != nil || portNum < 1 || portNum > 65535 {
			return 0, fmt.Errorf("porta inválida %q: deve estar entre 1 e 65535", rawPort)
		}
		return portNum, nil
	}
	if scheme == "https" {
		return 443, nil
	}
	return 80, nil
}

type cappedBodyRoundTripper struct {
	base     http.RoundTripper
	maxBytes int64
}

func (rt *cappedBodyRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	resp, err := rt.base.RoundTrip(req)
	if err != nil {
		return nil, err
	}
	if resp != nil && resp.Body != nil {
		resp.Body = &maxBytesReadCloser{
			rc:       resp.Body,
			maxBytes: rt.maxBytes,
		}
	}
	return resp, nil
}

type maxBytesReadCloser struct {
	rc       io.ReadCloser
	maxBytes int64
	read     int64
}

func (m *maxBytesReadCloser) Read(p []byte) (int, error) {
	if m.read >= m.maxBytes {
		var probe [1]byte
		n, err := m.rc.Read(probe[:])
		if n > 0 {
			return 0, fmt.Errorf("%w (%d bytes)", errResponseTooLarge, m.maxBytes)
		}
		if err != nil {
			return 0, err
		}
		return 0, io.EOF
	}
	remaining := m.maxBytes - m.read
	if int64(len(p)) > remaining {
		p = p[:remaining]
	}
	n, err := m.rc.Read(p)
	m.read += int64(n)
	return n, err
}

func (m *maxBytesReadCloser) Close() error {
	return m.rc.Close()
}
