package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSprint14_WellKnownUniversalAndAppLinks(t *testing.T) {
	srv := New()
	router := srv.Router()

	// 1. Android App Links: /.well-known/assetlinks.json
	reqAndroid := httptest.NewRequest(http.MethodGet, "/.well-known/assetlinks.json", nil)
	recAndroid := httptest.NewRecorder()
	router.ServeHTTP(recAndroid, reqAndroid)

	if recAndroid.Code != http.StatusOK {
		t.Fatalf("esperava 200 em /.well-known/assetlinks.json, obteve %d", recAndroid.Code)
	}
	if ct := recAndroid.Header().Get("Content-Type"); !strings.Contains(ct, "application/json") {
		t.Fatalf("esperava Content-Type application/json, obteve %s", ct)
	}

	var assetLinks []map[string]any
	if err := json.Unmarshal(recAndroid.Body.Bytes(), &assetLinks); err != nil {
		t.Fatalf("JSON inválido em assetlinks.json: %v", err)
	}
	if len(assetLinks) == 0 {
		t.Fatal("assetlinks.json não pode ser vazio")
	}
	target, _ := assetLinks[0]["target"].(map[string]any)
	if pkg, _ := target["package_name"].(string); pkg != "com.andrevmp.vito" {
		t.Fatalf("esperava package_name com.andrevmp.vito, obteve %v", pkg)
	}

	// 2. iOS Universal Links: /.well-known/apple-app-site-association
	reqIOS := httptest.NewRequest(http.MethodGet, "/.well-known/apple-app-site-association", nil)
	recIOS := httptest.NewRecorder()
	router.ServeHTTP(recIOS, reqIOS)

	if recIOS.Code != http.StatusOK {
		t.Fatalf("esperava 200 em /.well-known/apple-app-site-association, obteve %d", recIOS.Code)
	}
	var aasa map[string]any
	if err := json.Unmarshal(recIOS.Body.Bytes(), &aasa); err != nil {
		t.Fatalf("JSON inválido em apple-app-site-association: %v", err)
	}
	if _, ok := aasa["applinks"]; !ok {
		t.Fatal("apple-app-site-association deve conter chave 'applinks'")
	}
}

func TestSprint14_DockerfileNonRootVitoUID10001(t *testing.T) {
	dockerfilePath := filepath.Join("..", "..", "Dockerfile")
	raw, err := os.ReadFile(dockerfilePath)
	if err != nil {
		t.Fatalf("falha ao ler Dockerfile: %v", err)
	}
	content := string(raw)

	if !strings.Contains(content, "10001") {
		t.Fatal("Dockerfile deve configurar usuário non-root com UID 10001")
	}
	if !strings.Contains(content, "USER vito") && !strings.Contains(content, "USER 10001") {
		t.Fatal("Dockerfile deve definir diretiva USER vito (UID 10001)")
	}
	if !strings.Contains(content, "/app/data") {
		t.Fatal("Dockerfile deve configurar permissões para /app/data")
	}
}

func TestDeployWorkflow_FixesVolumeOwnershipForNonRootVitoAndRetriesHealthcheck(t *testing.T) {
	ciPath := filepath.Join("..", "..", "..", ".github", "workflows", "ci.yml")
	raw, err := os.ReadFile(ciPath)
	if err != nil {
		t.Fatalf("falha ao ler .github/workflows/ci.yml: %v", err)
	}
	content := string(raw)

	if !strings.Contains(content, "chown -R 10001:10001 /app/data") {
		t.Fatal("ci.yml deve corrigir a propriedade do volume /app/data para UID 10001:10001 antes de subir o container non-root no Pi")
	}
	if !strings.Contains(content, "docker logs") {
		t.Fatal("ci.yml deve exibir docker logs do vito-backend caso o healthcheck falhe")
	}
}
