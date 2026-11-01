package ai

import (
	"context"
	"net"
	"testing"
)

func TestValidateSafeURL(t *testing.T) {
	// Preserva e restaura lookupIPFunc ao final
	origLookup := lookupIPFunc
	defer func() { lookupIPFunc = origLookup }()

	// Mock resolver para testes determinísticos sem depender de conexão de rede externa
	lookupIPFunc = func(ctx context.Context, host string) ([]net.IP, error) {
		switch host {
		case "example.com", "g1.globo.com", "techcrunch.com":
			return []net.IP{net.ParseIP("93.184.216.34")}, nil
		case "malicious-local.test":
			return []net.IP{net.ParseIP("127.0.0.1")}, nil
		case "malicious-private.test":
			return []net.IP{net.ParseIP("192.168.1.50")}, nil
		case "malicious-metadata.test":
			return []net.IP{net.ParseIP("169.254.169.254")}, nil
		case "unresolvable.invalid":
			return nil, &net.DNSError{Err: "no such host", Name: host}
		default:
			return []net.IP{net.ParseIP("93.184.216.34")}, nil
		}
	}

	tests := []struct {
		name    string
		url     string
		wantErr bool
	}{
		// URLs Válidas
		{name: "Valido HTTPS porta padrao", url: "https://g1.globo.com/economia/noticia.html", wantErr: false},
		{name: "Valido HTTP porta padrao", url: "http://example.com/artigo", wantErr: false},
		{name: "Valido porta 443 explicita", url: "https://techcrunch.com:443/2026/10/startup", wantErr: false},
		{name: "Valido porta 80 explicita", url: "http://example.com:80/docs", wantErr: false},

		// Esquemas Inválidos
		{name: "Rejeita FTP", url: "ftp://example.com/arquivo.txt", wantErr: true},
		{name: "Rejeita File", url: "file:///etc/passwd", wantErr: true},
		{name: "Rejeita Javascript", url: "javascript:alert(1)", wantErr: true},
		{name: "Rejeita Data URL", url: "data:text/html,<h1>oi</h1>", wantErr: true},
		{name: "Rejeita Scheme vazio", url: "://example.com", wantErr: true},
		{name: "Rejeita URL vazia", url: "   ", wantErr: true},

		// Portas Não Padrão (Port Scanning / SSRF)
		{name: "Rejeita porta 8180 interna", url: "http://example.com:8180/api", wantErr: true},
		{name: "Rejeita porta 22 ssh", url: "http://example.com:22/", wantErr: true},
		{name: "Rejeita porta 3000", url: "http://example.com:3000/dashboard", wantErr: true},
		{name: "Rejeita porta 8080", url: "http://example.com:8080/", wantErr: true},

		// Loopback & Localhost
		{name: "Rejeita localhost literal", url: "http://localhost:8180/users", wantErr: true},
		{name: "Rejeita localhost sem porta", url: "http://localhost/test", wantErr: true},
		{name: "Rejeita 127.0.0.1", url: "http://127.0.0.1/api", wantErr: true},
		{name: "Rejeita 127.0.0.2", url: "http://127.0.0.2:80/admin", wantErr: true},
		{name: "Rejeita 0.0.0.0", url: "http://0.0.0.0/debug", wantErr: true},

		// RFC 1918 Redes Privadas
		{name: "Rejeita 10.0.0.1 (Classe A)", url: "http://10.0.0.1/status", wantErr: true},
		{name: "Rejeita 172.16.0.1 (Classe B)", url: "http://172.16.0.1/keys", wantErr: true},
		{name: "Rejeita 172.20.0.2 (Docker subnet)", url: "http://172.20.0.2/", wantErr: true},
		{name: "Rejeita 192.168.1.1 (Classe C)", url: "http://192.168.1.1/router", wantErr: true},

		// Link-Local & Cloud Metadata (AWS/GCP/Azure)
		{name: "Rejeita 169.254.169.254 (Cloud Metadata)", url: "http://169.254.169.254/latest/meta-data", wantErr: true},
		{name: "Rejeita 100.100.100.200 (Alibaba Metadata)", url: "http://100.100.100.200/latest/meta-data", wantErr: true},

		// IPv6
		{name: "Rejeita IPv6 Loopback ::1", url: "http://[::1]/secret", wantErr: true},
		{name: "Rejeita IPv4-mapped IPv6 loopback", url: "http://[::ffff:127.0.0.1]/", wantErr: true},
		{name: "Rejeita IPv4-mapped IPv6 private", url: "http://[::ffff:192.168.1.1]/", wantErr: true},

		// Nomes Internos Docker / Sufixos Locais
		{name: "Rejeita host Docker backend", url: "http://backend/api/v1/users", wantErr: true},
		{name: "Rejeita host Docker evolution-api", url: "http://evolution-api:80/instance", wantErr: true},
		{name: "Rejeita host Docker searxng", url: "http://searxng/search", wantErr: true},
		{name: "Rejeita sufixo .local", url: "http://myservice.local/admin", wantErr: true},
		{name: "Rejeita sufixo .internal", url: "http://db.internal/", wantErr: true},
		{name: "Rejeita sufixo .localhost", url: "http://app.localhost/", wantErr: true},

		// DNS Rebinding / Domínios que resolvem para IPs privados
		{name: "Rejeita domínio resolvendo para 127.0.0.1", url: "http://malicious-local.test/exploit", wantErr: true},
		{name: "Rejeita domínio resolvendo para 192.168.1.50", url: "http://malicious-private.test/dump", wantErr: true},
		{name: "Rejeita domínio resolvendo para metadata", url: "http://malicious-metadata.test/", wantErr: true},

		// Credenciais Embutidas
		{name: "Rejeita credenciais embutidas na URL", url: "http://admin:secret@example.com/", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parsed, err := ValidateSafeURL(tt.url)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ValidateSafeURL(%q) err = %v, wantErr = %v (parsed=%v)", tt.url, err, tt.wantErr, parsed)
			}
			if !tt.wantErr && parsed == nil {
				t.Fatalf("ValidateSafeURL(%q) retornou URL nil sem erro", tt.url)
			}
		})
	}
}
