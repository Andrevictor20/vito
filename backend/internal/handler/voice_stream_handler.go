package handler

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"io"
	"log"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"

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
}

type VoiceServerEvent struct {
	Type    string `json:"type"`
	Text    string `json:"text,omitempty"`
	Summary string `json:"summary,omitempty"`
}

type VoiceStreamHandler struct {
	astSvc *service.AssistantService
}

func NewVoiceStreamHandler(astSvc *service.AssistantService) *VoiceStreamHandler {
	return &VoiceStreamHandler{
		astSvc: astSvc,
	}
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

				// Processamento concorrente do comando
				go func(pcm []byte) {
					// Fallback amigável de transcrição ou processamento
					sendEvent(VoiceServerEvent{
						Type: "BOT_TRANSCRIPT",
						Text: "Entendido! Como posso ajudar você agora?",
					})
					sendEvent(VoiceServerEvent{
						Type: "STATE_CHANGED",
						Text: "LISTENING",
					})
				}(utterance)
			}
		}
	}
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
