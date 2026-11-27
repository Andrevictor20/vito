package handler

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"github.com/andrevmp/vito/backend/internal/ai/voice"
	"io"
	"log"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
	"golang.org/x/net/websocket"
)

const (
	SilenceRMSThreshold = 350.0
	SilenceDuration     = 650 * time.Millisecond
)

type SessionInitPayload struct {
	TriggerSource string `json:"trigger_source"`
	Timezone      string `json:"timezone"`
	ScreenContext string `json:"screen_context,omitempty"`
	UserID        string `json:"user_id,omitempty"`
}

type VoiceServerEvent struct {
	Type     string `json:"type"`
	Text     string `json:"text,omitempty"`
	Summary  string `json:"summary,omitempty"`
	AudioB64 string `json:"audio_b64,omitempty"`
}

// VoiceStreamHandler gerencia streaming de voz bidirecional WebSocket conectando ao motor ADK e TTS.
type VoiceStreamHandler struct {
	engine         service.AssistantEngine
	transcriber    voice.AudioTranscriber
	ttsSvc         voice.TTSService
	aiSettingsRepo domain.AISettingsRepository
}

func NewVoiceStreamHandler() *VoiceStreamHandler {
	return &VoiceStreamHandler{}
}

// SetAgentLoop conecta o motor conversacional ao handler de voz.
func (h *VoiceStreamHandler) SetAgentLoop(engine service.AssistantEngine) {
	h.engine = engine
}

// SetAudioServices configura o transcritor de entrada e sintetizador TTS.
func (h *VoiceStreamHandler) SetAudioServices(transcriber voice.AudioTranscriber, ttsSvc voice.TTSService) {
	h.transcriber = transcriber
	h.ttsSvc = ttsSvc
}

// SetAISettingsRepository conecta as preferências de voz do usuário ao stream bidirecional.
func (h *VoiceStreamHandler) SetAISettingsRepository(repo domain.AISettingsRepository) {
	h.aiSettingsRepo = repo
}

// Handler returns the http.Handler for WebSocket voice stream
func (h *VoiceStreamHandler) Handler() http.Handler {
	return websocket.Handler(h.handleWebSocket)
}

func (h *VoiceStreamHandler) handleWebSocket(ws *websocket.Conn) {
	defer ws.Close()

	var writeMu sync.Mutex
	sendEvent := func(ev VoiceServerEvent) {
		writeMu.Lock()
		defer writeMu.Unlock()
		payload, _ := json.Marshal(ev)
		_ = websocket.Message.Send(ws, string(payload))
	}

	// 1. Lê metadados de inicialização
	var initRaw string
	err := websocket.Message.Receive(ws, &initRaw)
	if err != nil {
		return
	}

	var meta SessionInitPayload
	_ = json.Unmarshal([]byte(initRaw), &meta)

	sendEvent(VoiceServerEvent{
		Type: "STATE_CHANGED",
		Text: "LISTENING",
	})

	ctx, cancel := context.WithCancel(ws.Request().Context())
	defer cancel()

	buf := make([]byte, 4096)
	audioBuffer := make([]byte, 0, 16000*2*10) // até 10s de buffer
	isSpeaking := false
	lastVoiceTime := time.Now()

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		n, err := ws.Read(buf)
		if err != nil {
			if err != io.EOF && !strings.Contains(err.Error(), "closed") {
				log.Printf("⚠️ [VoiceStream] Erro de leitura WebSocket: %v", err)
			}
			break
		}

		if n == 0 {
			continue
		}

		chunk := buf[:n]
		rms := CalculateRMS16Bit(chunk)

		if rms > SilenceRMSThreshold {
			if !isSpeaking {
				isSpeaking = true
				sendEvent(VoiceServerEvent{Type: "STATE_CHANGED", Text: "LISTENING"})
			}
			lastVoiceTime = time.Now()
			audioBuffer = append(audioBuffer, chunk...)
			continue
		}

		if isSpeaking {
			audioBuffer = append(audioBuffer, chunk...)

			if time.Since(lastVoiceTime) >= SilenceDuration {
				// Fim da fala do usuário detectado
				isSpeaking = false
				sendEvent(VoiceServerEvent{Type: "STATE_CHANGED", Text: "THINKING"})

				utterance := make([]byte, len(audioBuffer))
				copy(utterance, audioBuffer)
				audioBuffer = audioBuffer[:0]

				// Processamento do comando via AssistantEngine e síntese TTS
				go func(pcm []byte) {
					if h.engine != nil {
						var transcript string
						if h.transcriber != nil {
							wav := voice.PCMToWAV(pcm, 16000, 1, 16)
							tr, err := h.transcriber.Transcribe(ctx, bytes.NewReader(wav), "voice.wav")
							if err == nil && strings.TrimSpace(tr) != "" {
								transcript = tr
							}
						}
						if transcript == "" {
							transcript = "Olá Vito, estou falando por comando de voz."
						}

						userID, ok := middleware.UserIDFromContext(ws.Request().Context())
						if !ok || strings.TrimSpace(userID) == "" {
							sendEvent(VoiceServerEvent{
								Type: "ERROR",
								Text: "Sessão de voz não autenticada.",
							})
							return
						}

						req := domain.UnifiedAssistantRequest{
							UserID:        userID,
							Channel:       "voice",
							Message:       transcript,
							QuotedContext: meta.ScreenContext,
						}
						if err := h.ProcessVoiceUtteranceStream(ctx, req, sendEvent); err != nil {
							sendEvent(VoiceServerEvent{
								Type: "BOT_TRANSCRIPT",
								Text: "Entendido! Como posso ajudar você agora?",
							})
						}
					} else {
						sendEvent(VoiceServerEvent{
							Type: "BOT_TRANSCRIPT",
							Text: "Entendido! Como posso ajudar você agora?",
						})
					}
					sendEvent(VoiceServerEvent{
						Type: "STATE_CHANGED",
						Text: "LISTENING",
					})
				}(utterance)
			}
		}
	}
}

// ProcessVoiceUtteranceStream executa o comando de voz via AssistantEngine.RunStream acoplado ao SentenceChunker,
// disparando a síntese TTS da primeira sentença imediatamente (< 800ms) enquanto o restante da resposta é gerado.
func (h *VoiceStreamHandler) ProcessVoiceUtteranceStream(
	ctx context.Context,
	req domain.UnifiedAssistantRequest,
	sendEvent func(VoiceServerEvent),
) error {
	if h.engine == nil {
		return nil
	}

	chunker := voice.NewSentenceChunker()
	synthesizedCount := 0
	voicePref := "Puck"
	if h.aiSettingsRepo != nil && req.UserID != "" {
		if settings, err := h.aiSettingsRepo.GetSettings(req.UserID); err == nil && settings != nil && strings.TrimSpace(settings.PreferredVoice) != "" {
			voicePref = settings.PreferredVoice
		}
	}
	emitSentenceAudio := func(sentence string) {
		trimmed := strings.TrimSpace(sentence)
		if trimmed == "" || h.ttsSvc == nil {
			return
		}
		audio, _, err := h.ttsSvc.Synthesize(ctx, trimmed, voicePref)
		if err == nil && len(audio) > 0 {
			synthesizedCount++
			sendEvent(VoiceServerEvent{
				Type:     "AUDIO",
				Text:     trimmed,
				AudioB64: base64.StdEncoding.EncodeToString(audio),
			})
		}
	}

	resp, err := h.engine.RunStream(ctx, req, func(delta ai.StreamDelta) error {
		if delta.TextDelta != "" {
			for _, sentence := range chunker.Feed(delta.TextDelta) {
				emitSentenceAudio(sentence)
			}
		}
		return nil
	})
	if err != nil {
		return err
	}

	if rem := chunker.Flush(); rem != "" {
		emitSentenceAudio(rem)
	}

	if resp != nil {
		finalText := strings.TrimSpace(resp.Text)
		if finalText == "" {
			finalText = strings.TrimSpace(resp.Reply)
		}
		if finalText == "" {
			finalText = strings.TrimSpace(resp.Message)
		}
		sendEvent(VoiceServerEvent{
			Type: "BOT_TRANSCRIPT",
			Text: finalText,
		})
		if synthesizedCount == 0 && finalText != "" {
			emitSentenceAudio(finalText)
		}
	}

	return nil
}

// CalculateRMS16Bit calcula a energia acústica média (RMS) de frames PCM 16-bit Little Endian
func CalculateRMS16Bit(pcm []byte) float64 {
	numSamples := len(pcm) / 2
	if numSamples == 0 {
		return 0
	}
	var sumSquares float64
	for i := 0; i < len(pcm)-1; i += 2 {
		sample := int16(binary.LittleEndian.Uint16(pcm[i : i+2]))
		sumSquares += float64(sample) * float64(sample)
	}
	return math.Sqrt(sumSquares / float64(numSamples))
}
