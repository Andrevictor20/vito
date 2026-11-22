package adkengine

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"google.golang.org/adk/v2/model"
	"google.golang.org/genai"
)

func TestNewGeminiBYOKLLM_Validation(t *testing.T) {
	if _, err := NewGeminiBYOKLLM(context.Background(), "", "AIzaTestKey123456"); err == nil {
		t.Fatal("esperava erro quando modelID está vazio")
	}
	if _, err := NewGeminiBYOKLLM(context.Background(), "gemini-2.5-flash", ""); err == nil {
		t.Fatal("esperava erro quando apiKey está vazio")
	}
}

func TestGeminiBYOKLLM_SyncAndStreamingAgainstServer(t *testing.T) {
	var gotKey string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotKey = r.Header.Get("x-goog-api-key")
		if strings.Contains(r.URL.Path, "streamGenerateContent") {
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = fmt.Fprint(w, "data: {\"candidates\":[{\"content\":{\"role\":\"model\",\"parts\":[{\"text\":\"Olá via Gemini!\"}]},\"finishReason\":\"STOP\"}],\"usageMetadata\":{\"promptTokenCount\":10,\"candidatesTokenCount\":5,\"totalTokenCount\":15}}\n\n")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprint(w, `{
			"candidates": [{
				"content": {"role": "model", "parts": [{"text": "Resposta Gemini BYOK"}]},
				"finishReason": "STOP"
			}],
			"usageMetadata": {"promptTokenCount": 12, "candidatesTokenCount": 6, "totalTokenCount": 18}
		}`)
	}))
	defer srv.Close()

	llm, err := NewGeminiBYOKLLM(
		context.Background(),
		"gemini-2.5-flash",
		"AIzaTestBYOKKey123456",
		WithGeminiBaseURL(srv.URL),
		WithGeminiHTTPClient(srv.Client()),
	)
	if err != nil {
		t.Fatalf("NewGeminiBYOKLLM falhou: %v", err)
	}
	if llm.Name() != "gemini-2.5-flash" {
		t.Fatalf("Name() = %q, want gemini-2.5-flash", llm.Name())
	}

	meta := &TurnExecutionMeta{}
	ctx := WithTurnExecutionMeta(context.Background(), meta)
	req := &model.LLMRequest{
		Contents: []*genai.Content{genai.NewContentFromText("Oi Gemini", genai.RoleUser)},
	}

	var syncResps []*model.LLMResponse
	for resp, callErr := range llm.GenerateContent(ctx, req, false) {
		if callErr != nil {
			t.Fatalf("GenerateContent sync falhou: %v", callErr)
		}
		syncResps = append(syncResps, resp)
	}
	if gotKey != "AIzaTestBYOKKey123456" {
		t.Errorf("esperava header x-goog-api-key com a chave BYOK, obteve %q", gotKey)
	}
	if len(syncResps) != 1 || syncResps[0].Content.Parts[0].Text != "Resposta Gemini BYOK" {
		t.Fatalf("resposta sync inesperada: %+v", syncResps)
	}
	if meta.ProviderUsed != "google" || meta.TokensIn != 12 || meta.TokensOut != 6 {
		t.Errorf("meta inesperado: %+v", meta)
	}

	var streamTexts []string
	for resp, callErr := range llm.GenerateContent(context.Background(), req, true) {
		if callErr != nil {
			t.Fatalf("GenerateContent stream falhou: %v", callErr)
		}
		if resp != nil && resp.Content != nil {
			for _, p := range resp.Content.Parts {
				if p != nil && p.Text != "" {
					streamTexts = append(streamTexts, p.Text)
				}
			}
		}
	}
	if len(streamTexts) == 0 || !strings.Contains(strings.Join(streamTexts, ""), "Olá via Gemini!") {
		t.Fatalf("streaming Gemini inesperado: %v", streamTexts)
	}
}

func TestGeminiBYOKLLM_ErrorRedacted(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = fmt.Fprint(w, `{"error":{"code":401,"message":"API key not valid: AIzaSyDummyLeakTest1234567890","status":"UNAUTHENTICATED"}}`)
	}))
	defer srv.Close()

	llm, err := NewGeminiBYOKLLM(
		context.Background(),
		"gemini-2.5-flash",
		"AIzaSyDummyLeakTest1234567890",
		WithGeminiBaseURL(srv.URL),
		WithGeminiHTTPClient(srv.Client()),
	)
	if err != nil {
		t.Fatalf("NewGeminiBYOKLLM falhou: %v", err)
	}

	req := &model.LLMRequest{Contents: []*genai.Content{genai.NewContentFromText("Oi", genai.RoleUser)}}
	var gotErr error
	for _, callErr := range llm.GenerateContent(context.Background(), req, false) {
		gotErr = callErr
	}
	var httpErr *ProviderHTTPError
	if !errors.As(gotErr, &httpErr) || httpErr.StatusCode != http.StatusUnauthorized {
		t.Fatalf("esperava *ProviderHTTPError 401, obteve: %v", gotErr)
	}
	if strings.Contains(httpErr.Error(), "AIzaSyDummyLeakTest1234567890") {
		t.Errorf("erro vazou chave Gemini: %s", httpErr.Error())
	}
}
