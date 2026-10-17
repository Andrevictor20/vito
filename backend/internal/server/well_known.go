package server

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
)

const (
	defaultAndroidPackage     = "com.andrevmp.vito"
	defaultAndroidFingerprint = "FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C"
	defaultAppleAppID         = "TEAMID.com.andrevmp.vito"
)

// handleAssetLinks serve /.well-known/assetlinks.json para verificação nativa de Android App Links (Sprint 14).
func (s *Server) handleAssetLinks(w http.ResponseWriter, r *http.Request) {
	pkg := strings.TrimSpace(os.Getenv("ANDROID_PACKAGE_NAME"))
	if pkg == "" {
		pkg = defaultAndroidPackage
	}

	rawFingerprints := strings.TrimSpace(os.Getenv("ANDROID_SHA256_CERT_FINGERPRINTS"))
	var fingerprints []string
	if rawFingerprints != "" {
		for _, fp := range strings.Split(rawFingerprints, ",") {
			if clean := strings.TrimSpace(fp); clean != "" {
				fingerprints = append(fingerprints, clean)
			}
		}
	}
	if len(fingerprints) == 0 {
		fingerprints = []string{defaultAndroidFingerprint}
	}

	payload := []map[string]any{
		{
			"relation": []string{"delegate_permission/common.handle_all_urls"},
			"target": map[string]any{
				"namespace":                "android_app",
				"package_name":             pkg,
				"sha256_cert_fingerprints": fingerprints,
			},
		},
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(payload)
}

// handleAppleAppSiteAssociation serve /.well-known/apple-app-site-association para iOS Universal Links (Sprint 14).
func (s *Server) handleAppleAppSiteAssociation(w http.ResponseWriter, r *http.Request) {
	appID := strings.TrimSpace(os.Getenv("APPLE_APP_ID"))
	if appID == "" {
		appID = defaultAppleAppID
	}

	payload := map[string]any{
		"applinks": map[string]any{
			"apps": []string{},
			"details": []map[string]any{
				{
					"appIDs": []string{appID},
					"components": []map[string]string{
						{"/": "/chat*"},
						{"/": "/agenda*"},
						{"/": "/tarefas*"},
						{"/": "/radares*"},
						{"/": "/booking*"},
						{"/": "/perfil*"},
						{"/": "/meet/*"},
						{"/": "/book/*"},
						{"/": "/verify-phone/*"},
					},
				},
			},
		},
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(payload)
}
