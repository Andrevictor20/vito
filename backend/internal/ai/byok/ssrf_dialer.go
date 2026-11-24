package byok

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const (
	// DefaultSSRFTimeout é o tempo máximo de requisição para endpoints customizados (§5.4).
	DefaultSSRFTimeout = 60 * time.Second
	// DefaultSSRFMaxBodyBytes é o limite máximo de leitura de resposta (8 MB, §5.4).
	DefaultSSRFMaxBodyBytes int64 = 8 * 1024 * 1024
)

var (
	cgnatPrefix     = netip.MustParsePrefix("100.64.0.0/10")
	rfc1918Prefixes = []netip.Prefix{
		netip.MustParsePrefix("10.0.0.0/8"),
		netip.MustParsePrefix("172.16.0.0/12"),
		netip.MustParsePrefix("192.168.0.0/16"),
	}
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

	if isBlockedHostname(host) {
		return nil, fmt.Errorf("host %q bloqueado por política anti-SSRF", host)
	}

	effectivePort, err := resolveAndValidatePort(parsed.Port(), scheme)
	if err != nil {
		return nil, err
	}

	ip := net.ParseIP(host)
	if ip != nil {
		if isBlockedIP(ip) {
			return nil, fmt.Errorf("endereço IP %s bloqueado por política anti-SSRF", ip.String())
		}
		if scheme == "http" && !isRFC1918IP(ip) {
			return nil, errors.New("http:// só é permitido para IPs privados RFC1918; use https:// para hosts públicos")
		}
		if blockedLocalPort > 0 && effectivePort == blockedLocalPort && isRFC1918IP(ip) {
			return nil, fmt.Errorf("porta %d reservada ao backend do Vito está bloqueada", blockedLocalPort)
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
	if lookup == nil {
		lookup = net.DefaultResolver.LookupIPAddr
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
	return func(ctx context.Context, network, addr string) (net.Conn, error) {
		host, portStr, err := net.SplitHostPort(addr)
		if err != nil {
			return nil, fmt.Errorf("endereço inválido %q: %w", addr, err)
		}

		portNum, err := strconv.Atoi(portStr)
		if err != nil || portNum < 1 || portNum > 65535 {
			return nil, fmt.Errorf("porta inválida %q", portStr)
		}

		cleanHost := strings.TrimSuffix(strings.ToLower(strings.TrimSpace(host)), ".")
		if isBlockedHostname(cleanHost) {
			return nil, fmt.Errorf("host %q bloqueado por política anti-SSRF", cleanHost)
		}

		var candidates []net.IP
		if literalIP := net.ParseIP(cleanHost); literalIP != nil {
			candidates = []net.IP{literalIP}
		} else {
			resolved, err := lookup(ctx, cleanHost)
			if err != nil {
				return nil, fmt.Errorf("falha ao resolver DNS de %q: %w", cleanHost, err)
			}
			if len(resolved) == 0 {
				return nil, fmt.Errorf("nenhum endereço IP retornado para %q", cleanHost)
			}
			for _, ipAddr := range resolved {
				candidates = append(candidates, ipAddr.IP)
			}
		}

		// Valida cada IP retornado pelo DNS antes de tentar qualquer conexão.
		for _, ip := range candidates {
			if err := validateTargetIPAndPort(ip, portNum, blockedLocalPort); err != nil {
				return nil, err
			}
		}

		dialer := &net.Dialer{
			Timeout:   15 * time.Second,
			KeepAlive: 30 * time.Second,
			Control: func(_ string, rawAddr string, _ syscall.RawConn) error {
				ipStr, pStr, splitErr := net.SplitHostPort(rawAddr)
				if splitErr != nil {
					return splitErr
				}
				pNum, _ := strconv.Atoi(pStr)
				return validateTargetIPAndPort(net.ParseIP(ipStr), pNum, blockedLocalPort)
			},
		}

		// Conecta diretamente no IP validado para eliminar TOCTOU / DNS rebinding.
		var lastErr error
		for _, ip := range candidates {
			conn, dialErr := dialer.DialContext(ctx, network, net.JoinHostPort(ip.String(), portStr))
			if dialErr == nil {
				return conn, nil
			}
			lastErr = dialErr
		}
		if lastErr != nil {
			return nil, lastErr
		}
		return nil, fmt.Errorf("falha ao conectar a %q", addr)
	}
}

func validateTargetIPAndPort(ip net.IP, port int, blockedLocalPort int) error {
	if isBlockedIP(ip) {
		return fmt.Errorf("conexão bloqueada para IP restrito (%s)", ip)
	}
	if blockedLocalPort > 0 && port == blockedLocalPort && isRFC1918IP(ip) {
		return fmt.Errorf("porta %d bloqueada em host privado", blockedLocalPort)
	}
	return nil
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

func isBlockedHostname(host string) bool {
	if host == "localhost" || strings.HasSuffix(host, ".localhost") {
		return true
	}
	if host == "metadata.google.internal" || strings.HasSuffix(host, ".metadata.google.internal") {
		return true
	}
	return false
}

func isBlockedIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if v4 := ip.To4(); v4 != nil {
		ip = v4
	}
	if ip.IsLoopback() || ip.IsUnspecified() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsMulticast() {
		return true
	}
	addr, ok := netip.AddrFromSlice(ip)
	if !ok {
		return true
	}
	addr = addr.Unmap()
	if addr.Is4() {
		b := addr.As4()
		if b[0] == 0 || b[0] == 127 {
			return true
		}
	}
	return cgnatPrefix.Contains(addr)
}

func isRFC1918IP(ip net.IP) bool {
	if ip == nil {
		return false
	}
	if v4 := ip.To4(); v4 != nil {
		ip = v4
	}
	addr, ok := netip.AddrFromSlice(ip)
	if !ok {
		return false
	}
	addr = addr.Unmap()
	for _, p := range rfc1918Prefixes {
		if p.Contains(addr) {
			return true
		}
	}
	return false
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
