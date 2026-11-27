package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestTurnstileValidator_SendsFormBody(t *testing.T) {
	var gotContentType, gotSecret, gotResp, gotIP string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotContentType = r.Header.Get("Content-Type")
		_ = r.ParseForm()
		gotSecret = r.PostFormValue("secret")
		gotResp = r.PostFormValue("response")
		gotIP = r.PostFormValue("remoteip")

		w.Header().Set("Content-Type", "application/json")
		if gotSecret == "sec-123" && gotResp == "tok-abc" && gotIP == "1.2.3.4" {
			_, _ = w.Write([]byte(`{"success":true}`))
			return
		}
		_, _ = w.Write([]byte(`{"success":false,"error-codes":["missing-input-secret","missing-input-response"]}`))
	}))
	defer srv.Close()

	v := NewTurnstileValidator("sec-123")
	v.SetEndpoint(srv.URL)

	ok, err := v.Validate(context.Background(), "tok-abc", "1.2.3.4")
	if err != nil {
		t.Fatalf("erro inesperado em Validate: %v", err)
	}
	if !ok {
		t.Fatalf("esperava ok=true, obteve false (contentType=%q secret=%q resp=%q ip=%q)",
			gotContentType, gotSecret, gotResp, gotIP)
	}
	if !strings.Contains(gotContentType, "application/x-www-form-urlencoded") {
		t.Errorf("esperava Content-Type form-urlencoded, obteve %q", gotContentType)
	}
}
