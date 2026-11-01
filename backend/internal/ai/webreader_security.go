package ai

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"
	"time"
)

var (
	// lookupIPFunc permite injeção de resolução de DNS para testes de segurança determinísticos.
	lookupIPFunc = func(ctx context.Context, host string) ([]net.IP, error) {
		resolver := &net.Resolver{}
		return resolver.LookupIP(ctx, "ip", host)
	}

	// blockedInternalHostnames lista nomes canônicos de infraestrutura e serviços locais/Docker.
	blockedInternalHostnames = map[string]bool{
		"localhost":     true,
		"backend":       true,
		"evolution-api": true,
		"searxng":       true,
		"redis":         true,
		"postgres":      true,
		"mail":          true,
		"gateway":       true,
		"host.docker.internal": true,
	}

	// blockedDomainSuffixes bloqueia TLDs e sufixos reservados para redes locais e privadas.
	blockedDomainSuffixes = []string{
		".localhost",
		".local",
		".internal",
		".lan",
		".home",
		".arpa",
		".corp",
	}

	// blockedIPNets redes CIDR adicionais reservadas/especiais além das tratadas por net.IP.
	_, carrierGradeNAT, _ = net.ParseCIDR("100.64.0.0/10")
	_, currentNetwork, _  = net.ParseCIDR("0.0.0.0/8")
)

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

	rawHost := parsed.Host
	if rawHost == "" {
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
	portStr := parsed.Port()
	if portStr != "" {
		port, err := strconv.Atoi(portStr)
		if err != nil || (port != 80 && port != 443) {
			return nil, fmt.Errorf("porta %s não permitida: apenas portas 80 e 443 são suportadas", portStr)
		}
	}

	// Validação de hostnames internos e sufixos locais
	lowerHost := strings.ToLower(hostname)
	if blockedInternalHostnames[lowerHost] {
		return nil, fmt.Errorf("acesso a rede interna/privada bloqueado: host %q", hostname)
	}
	for _, suffix := range blockedDomainSuffixes {
		if strings.HasSuffix(lowerHost, suffix) {
			return nil, fmt.Errorf("acesso a domínio local/privado bloqueado: host %q", hostname)
		}
	}

	// Se o hostname for um IP literal
	if ip := net.ParseIP(hostname); ip != nil {
		if err := checkIPSecurity(ip); err != nil {
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
		if err := checkIPSecurity(ip); err != nil {
			return nil, fmt.Errorf("dns para host %q resolveu para ip não permitido (%s): %w", hostname, ip.String(), err)
		}
	}

	return parsed, nil
}

// checkIPSecurity verifica se o IP pertence a faixas privadas, de loopback ou reservadas.
func checkIPSecurity(ip net.IP) error {
	// Se for IPv4 mapeado em IPv6 (::ffff:127.0.0.1)
	if v4 := ip.To4(); v4 != nil {
		return checkIPv4Security(v4)
	}
	return checkIPv6Security(ip)
}

func checkIPv4Security(ip net.IP) error {
	if ip.IsLoopback() {
		return fmt.Errorf("ip de loopback bloqueado: %s", ip.String())
	}
	if ip.IsPrivate() {
		return fmt.Errorf("ip privado RFC 1918 bloqueado: %s", ip.String())
	}
	if ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return fmt.Errorf("ip link-local RFC 3927 bloqueado: %s", ip.String())
	}
	if ip.IsMulticast() {
		return fmt.Errorf("ip multicast bloqueado: %s", ip.String())
	}
	if ip.IsUnspecified() {
		return fmt.Errorf("ip não especificado bloqueado: %s", ip.String())
	}
	if currentNetwork.Contains(ip) {
		return fmt.Errorf("ip da rede corrente bloqueado: %s", ip.String())
	}
	if carrierGradeNAT.Contains(ip) {
		return fmt.Errorf("ip de carrier-grade nat bloqueado: %s", ip.String())
	}
	// AWS / Cloud Metadata endpoint (169.254.169.254)
	if ip.String() == "169.254.169.254" || ip.String() == "100.100.100.200" {
		return fmt.Errorf("endpoint de metadados de nuvem bloqueado: %s", ip.String())
	}
	return nil
}

func checkIPv6Security(ip net.IP) error {
	if ip.IsLoopback() {
		return fmt.Errorf("ipv6 de loopback bloqueado: %s", ip.String())
	}
	if ip.IsPrivate() {
		return fmt.Errorf("ipv6 privado bloqueado: %s", ip.String())
	}
	if ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return fmt.Errorf("ipv6 link-local bloqueado: %s", ip.String())
	}
	if ip.IsMulticast() {
		return fmt.Errorf("ipv6 multicast bloqueado: %s", ip.String())
	}
	if ip.IsUnspecified() {
		return fmt.Errorf("ipv6 não especificado bloqueado: %s", ip.String())
	}
	return nil
}
