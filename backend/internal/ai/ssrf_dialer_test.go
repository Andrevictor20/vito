package ai

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type ssrfRoundTripFunc func(*http.Request) (*http.Response, error)

func (f ssrfRoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestValidateCustomBaseURL(t *testing.T) {
	tests := []struct {
		name        string
		rawURL      string
		blockedPort int
		wantOK      bool
	}{
		{"metadata_ip_rejected", "http://169.254.169.254/v1", 8180, false},
		{"metadata_google_internal_rejected", "https://metadata.google.internal/computeMetadata/v1", 8180, false},
		{"loopback_vito_port_rejected", "http://127.0.0.1:8180/v1", 8180, false},
		{"loopback_https_rejected", "https://127.0.0.1:8443/v1", 8180, false},
		{"localhost_rejected", "http://localhost:11434/v1", 8180, false},
		{"ipv6_loopback_rejected", "https://[::1]:11434/v1", 8180, false},
		{"ipv6_link_local_rejected", "http://[fe80::1]:11434/v1", 8180, false},
		{"unspecified_rejected", "http://0.0.0.0:11434/v1", 8180, false},
		{"cgnat_rejected", "https://100.64.1.10/v1", 8180, false},
		{"public_http_rejected", "http://example.com/v1", 8180, false},
		{"public_ip_http_rejected", "http://8.8.8.8/v1", 8180, false},
		{"userinfo_rejected", "https://user:secret@api.example.com/v1", 8180, false},
		{"invalid_scheme_rejected", "ftp://api.example.com/v1", 8180, false},
		{"invalid_port_rejected", "https://api.example.com:70000/v1", 8180, false},
		{"private_vito_port_blocked", "http://192.168.0.20:8180/v1", 8180, false},
		{"rfc1918_192_http_accepted", "http://192.168.0.20:11434/v1", 8180, true},
		{"rfc1918_10_http_accepted", "http://10.0.0.15:8000/v1", 8180, true},
		{"rfc1918_172_http_accepted", "http://172.16.5.10:11434/v1", 8180, true},
		{"public_https_accepted", "https://gateway.example.com/v1", 8180, true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			u, err := ValidateCustomBaseURL(tc.rawURL, tc.blockedPort)
			if tc.wantOK {
				if err != nil {
					t.Fatalf("esperava URL aceita (%s), obteve erro: %v", tc.rawURL, err)
				}
				if u == nil {
					t.Fatalf("esperava *url.URL não nulo")
				}
			} else if err == nil {
				t.Fatalf("esperava URL rejeitada (%s), mas foi aceita: %v", tc.rawURL, u)
			}
		})
	}
}

func TestNewSafeHTTPClient_BlocksLoopbackServer(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	client := NewSafeHTTPClient(5*time.Second, 1024*1024, 8180)
	resp, err := client.Get(srv.URL)
	if err == nil {
		resp.Body.Close()
		t.Fatalf("esperava dialer anti-SSRF bloquear loopback (%s)", srv.URL)
	}
}

func TestNewSafeHTTPClient_BlocksRedirects(t *testing.T) {
	client := NewSafeHTTPClient(10*time.Second, 1024*1024, 8180)
	client.Transport = ssrfRoundTripFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusFound,
			Header:     http.Header{"Location": []string{"http://169.254.169.254/latest/meta-data"}},
			Body:       io.NopCloser(strings.NewReader("")),
			Request:    req,
		}, nil
	})

	resp, err := client.Get("https://gateway.example.com/v1/models")
	if resp != nil && resp.Body != nil {
		resp.Body.Close()
	}
	if err == nil {
		t.Fatalf("esperava erro ao tentar seguir redirect")
	}
	if !errors.Is(err, errSSRFRedirectBlocked) {
		t.Fatalf("esperava errSSRFRedirectBlocked, obteve: %v", err)
	}
}

func TestNewSafeHTTPClient_EnforcesTimeoutAndMaxBodyCap(t *testing.T) {
	cappedClient := NewSafeHTTPClient(120*time.Second, 20*1024*1024, 8180)
	if cappedClient.Timeout != DefaultSSRFTimeout {
		t.Fatalf("esperava timeout limitado a %v, obteve %v", DefaultSSRFTimeout, cappedClient.Timeout)
	}

	client := NewSafeHTTPClient(10*time.Second, 1024, 8180)
	baseRT := client.Transport.(*cappedBodyRoundTripper)
	baseRT.base = ssrfRoundTripFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(bytes.NewReader(bytes.Repeat([]byte("a"), 2048))),
			Request:    req,
		}, nil
	})

	resp, err := client.Get("https://gateway.example.com/v1/models")
	if err != nil {
		t.Fatalf("erro inesperado na chamada: %v", err)
	}
	defer resp.Body.Close()

	_, readErr := io.ReadAll(resp.Body)
	if !errors.Is(readErr, errResponseTooLarge) {
		t.Fatalf("esperava errResponseTooLarge ao exceder limite, obteve: %v", readErr)
	}
}

func TestSafeDialContext_BlocksDNSRebindingToRestrictedIPs(t *testing.T) {
	cases := []struct {
		name string
		ips  []net.IPAddr
		addr string
	}{
		{
			name: "dns_returns_loopback",
			ips:  []net.IPAddr{{IP: net.ParseIP("127.0.0.1")}},
			addr: "rebind.example.com:443",
		},
		{
			name: "dns_returns_link_local_metadata",
			ips:  []net.IPAddr{{IP: net.ParseIP("169.254.169.254")}},
			addr: "rebind.example.com:80",
		},
		{
			name: "dns_returns_ipv6_link_local",
			ips:  []net.IPAddr{{IP: net.ParseIP("fe80::1")}},
			addr: "rebind.example.com:443",
		},
		{
			name: "dns_returns_cgnat",
			ips:  []net.IPAddr{{IP: net.ParseIP("100.64.0.10")}},
			addr: "rebind.example.com:443",
		},
		{
			name: "dns_mixed_public_and_loopback",
			ips:  []net.IPAddr{{IP: net.ParseIP("93.184.216.34")}, {IP: net.ParseIP("127.0.0.1")}},
			addr: "rebind.example.com:443",
		},
		{
			name: "dns_returns_rfc1918_on_blocked_vito_port",
			ips:  []net.IPAddr{{IP: net.ParseIP("192.168.1.10")}},
			addr: "internal.example.com:8180",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dial := newSafeDialContext(8180, func(_ context.Context, _ string) ([]net.IPAddr, error) {
				return tc.ips, nil
			})
			conn, err := dial(context.Background(), "tcp", tc.addr)
			if conn != nil {
				conn.Close()
			}
			if err == nil {
				t.Fatalf("esperava bloqueio do dialer para %s (%v)", tc.addr, tc.ips)
			}
		})
	}
}
