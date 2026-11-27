package search

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/platform/netsec"
)

// lookupIPFunc permite injeção de resolução de DNS para testes de segurança determinísticos.
var lookupIPFunc = func(ctx context.Context, host string) ([]net.IP, error) {
	resolver := &net.Resolver{}
	return resolver.LookupIP(ctx, "ip", host)
}

// ValidateSafeURL inspeciona a URL fornecida e barra esquemas não HTTP/HTTPS, portas não padrão,
// endereços de loopback, faixas privadas RFC 1918, link-local e redes internas Docker (SSRF defense).
func ValidateSafeURL(rawURL string) (*url.URL, error) {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return nil, fmt.Errorf("url vazia")
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return nil, fmt.Errorf("url malformatada: %w", err)
	}

	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return nil, fmt.Errorf("esquema inválido %q: apenas http e https são permitidos", parsed.Scheme)
	}

	if parsed.Host == "" {
		return nil, fmt.Errorf("host não informado na url")
	}

	// Remove credenciais embutidas caso existam (ex: user:pass@host)
	if parsed.User != nil {
		return nil, fmt.Errorf("credenciais na url não são permitidas por segurança")
	}

	hostname := parsed.Hostname()
	if hostname == "" {
		return nil, fmt.Errorf("hostname inválido")
	}

	// Validação de porta (apenas 80 e 443 são permitidas)
	if portStr := parsed.Port(); portStr != "" {
		port, err := strconv.Atoi(portStr)
		if err != nil || (port != 80 && port != 443) {
			return nil, fmt.Errorf("porta %s não permitida: apenas portas 80 e 443 são suportadas", portStr)
		}
	}

	// Validação de hostnames internos Docker e sufixos locais (.local, .internal, etc.)
	if netsec.IsBlockedInternalHostname(hostname, true) {
		return nil, fmt.Errorf("acesso a rede interna/privada bloqueado: host %q", hostname)
	}

	// Se o hostname for um IP literal
	if ip := net.ParseIP(hostname); ip != nil {
		if err := netsec.CheckIP(ip, false); err != nil {
			return nil, err
		}
		return parsed, nil
	}

	// Resolução de DNS com verificação de todos os IPs retornados (Anti-DNS Rebinding)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	ips, err := lookupIPFunc(ctx, hostname)
	if err != nil {
		return nil, fmt.Errorf("falha ao resolver dns para o host %q: %w", hostname, err)
	}
	if len(ips) == 0 {
		return nil, fmt.Errorf("nenhum endereço ip resolvido para o host %q", hostname)
	}

	for _, ip := range ips {
		if err := netsec.CheckIP(ip, false); err != nil {
			return nil, fmt.Errorf("dns para host %q resolveu para ip não permitido (%s): %w", hostname, ip.String(), err)
		}
	}

	return parsed, nil
}
