package ai_test

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andrevmp/vito/backend/internal/ai"
)

func TestGroqWhisperTranscriber_Transcribe_Success(t *testing.T) {
	expectedTranscript := "Comprar pão na padaria hoje às 17h"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if auth := r.Header.Get("Authorization"); auth != "Bearer test-key" {
			t.Errorf("expected Authorization header 'Bearer test-key', got '%s'", auth)
		}

		err := r.ParseMultipartForm(10 << 20)
		if err != nil {
			t.Fatalf("failed to parse multipart form: %v", err)
		}

		model := r.FormValue("model")
		if model != "whisper-large-v3" {
			t.Errorf("expected model 'whisper-large-v3', got '%s'", model)
		}

		file, header, err := r.FormFile("file")
		if err != nil {
			t.Fatalf("failed to get file from form: %v", err)
		}
		defer file.Close()

		if header.Filename != "audio.m4a" {
			t.Errorf("expected filename 'audio.m4a', got '%s'", header.Filename)
		}

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"text": "%s"}`, expectedTranscript)
	}))
	defer server.Close()

	transcriber := ai.NewGroqWhisperWithBaseURL("test-key", server.URL)

	audioData := bytes.NewReader([]byte("fake-audio-bytes"))
	text, err := transcriber.Transcribe(context.Background(), audioData, "audio.m4a")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	if text != expectedTranscript {
		t.Errorf("expected '%s', got '%s'", expectedTranscript, text)
	}
}

func TestGroqWhisperTranscriber_Transcribe_APIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`{"error": {"message": "Invalid audio file"}}`))
	}))
	defer server.Close()

	transcriber := ai.NewGroqWhisperWithBaseURL("test-key", server.URL)

	audioData := bytes.NewReader([]byte("bad-audio"))
	_, err := transcriber.Transcribe(context.Background(), audioData, "bad.m4a")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}
