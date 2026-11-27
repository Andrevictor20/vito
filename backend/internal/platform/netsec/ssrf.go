package netsec

import (
	"context"
	"fmt"
	"net"
	"net/netip"
	"strconv"
	"strings"
	"syscall"
	"time"
)

var (
	cgnatPrefix     = netip.MustParsePrefix("100.64.0.0/10")
	rfc1918Prefixes = []netip.Prefix{
		netip.MustParsePrefix("10.0.0.0/8"),
		netip.MustParsePrefix("172.16.0.0/12"),
		netip.MustParsePrefix("192.168.0.0/16"),
	}
	dockerInternalHostnames = map[string]bool{
		"localhost":            true,
		"backend":              true,
		"evolution-api":        true,
		"searxng":              true,
		"redis":                true,
		"postgres":             true,
		"mail":                 true,
		"gateway":              true,
		"host.docker.internal": true,
	}
	localDomainSuffixes = []string{
		".localhost",
		".local",
		".internal",
		".lan",
		".home",
		".arpa",
		".corp",
	}
)

// SafeDialOptions configura a política anti-SSRF aplicada ao resolver/conectar em hosts.
type SafeDialOptions struct {
	AllowRFC1918      bool
	BlockedLocalPort  int
	StrictDockerHosts bool
	Lookup            func(ctx context.Context, host string) ([]net.IPAddr, error)
}

// IsRFC1918IP informa se o IP pertence às faixas privadas IPv4 RFC 1918.
func IsRFC1918IP(ip net.IP) bool {
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

// IsBlockedSpecialIP verifica se o IP pertence a faixas sempre proibidas (loopback, link-local,
// CGNAT, multicast, unspecified, 0.0.0.0/8, metadata cloud e ::1).
func IsBlockedSpecialIP(ip net.IP) bool {
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
		s := addr.String()
		if s == "169.254.169.254" || s == "100.100.100.200" {
			return true
		}
	}
	return cgnatPrefix.Contains(addr)
}

// CheckIP valida um IP conforme a política anti-SSRF; quando allowRFC1918 == false,
// bloqueia também endereços privados RFC1918 / IPv6 ULA.
func CheckIP(ip net.IP, allowRFC1918 bool) error {
	if IsBlockedSpecialIP(ip) {
		return fmt.Errorf("conexão bloqueada para IP restrito (%s)", ip)
	}
	if !allowRFC1918 && ip.IsPrivate() {
		return fmt.Errorf("ip privado bloqueado: %s", ip.String())
	}
	return nil
}

// IsBlockedInternalHostname verifica hostnames reservados/internos. Quando strictDocker == true,
// bloqueia também nomes de serviços Docker e TLDs/sufixos locais (.local, .internal, .lan, etc.).
func IsBlockedInternalHostname(host string, strictDocker bool) bool {
	clean := strings.TrimSuffix(strings.ToLower(strings.TrimSpace(host)), ".")
	if clean == "" {
		return true
	}
	if clean == "localhost" || strings.HasSuffix(clean, ".localhost") ||
		clean == "metadata.google.internal" || strings.HasSuffix(clean, ".metadata.google.internal") {
		return true
	}
	if !strictDocker {
		return false
	}
	if dockerInternalHostnames[clean] {
		return true
	}
	for _, suffix := range localDomainSuffixes {
		if strings.HasSuffix(clean, suffix) {
			return true
		}
	}
	return false
}

// NewSafeDialContext cria um DialContext com validação prévia de DNS, bloqueio na camada de syscall.RawConn
// (anti-DNS-rebinding) e conexão direta pelo IP validado.
func NewSafeDialContext(opts SafeDialOptions) func(ctx context.Context, network, addr string) (net.Conn, error) {
	lookup := opts.Lookup
	if lookup == nil {
		lookup = net.DefaultResolver.LookupIPAddr
	}
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
		if IsBlockedInternalHostname(cleanHost, opts.StrictDockerHosts) {
			return nil, fmt.Errorf("host %q bloqueado por política anti-SSRF", cleanHost)
		}

		candidates, err := resolveHostIPs(ctx, cleanHost, lookup)
		if err != nil {
			return nil, err
		}

		for _, ip := range candidates {
			if err := ValidateTargetIPAndPort(ip, portNum, opts.AllowRFC1918, opts.BlockedLocalPort); err != nil {
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
				return ValidateTargetIPAndPort(net.ParseIP(ipStr), pNum, opts.AllowRFC1918, opts.BlockedLocalPort)
			},
		}

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

// ValidateTargetIPAndPort valida IP e porta segundo as opções configuradas.
func ValidateTargetIPAndPort(ip net.IP, port int, allowRFC1918 bool, blockedLocalPort int) error {
	if err := CheckIP(ip, allowRFC1918); err != nil {
		return err
	}
	if blockedLocalPort > 0 && port == blockedLocalPort && IsRFC1918IP(ip) {
		return fmt.Errorf("porta %d bloqueada em host privado", blockedLocalPort)
	}
	return nil
}

func resolveHostIPs(ctx context.Context, cleanHost string, lookup func(context.Context, string) ([]net.IPAddr, error)) ([]net.IP, error) {
	if literalIP := net.ParseIP(cleanHost); literalIP != nil {
		return []net.IP{literalIP}, nil
	}
	resolved, err := lookup(ctx, cleanHost)
	if err != nil {
		return nil, fmt.Errorf("falha ao resolver DNS de %q: %w", cleanHost, err)
	}
	if len(resolved) == 0 {
		return nil, fmt.Errorf("nenhum endereço IP retornado para %q", cleanHost)
	}
	candidates := make([]net.IP, 0, len(resolved))
	for _, ipAddr := range resolved {
		candidates = append(candidates, ipAddr.IP)
	}
	return candidates, nil
}
