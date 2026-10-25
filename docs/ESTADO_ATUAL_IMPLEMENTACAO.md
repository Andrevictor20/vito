# 📡 Estado Atual da Implementação — Vito AI
> **Modo de Conversação Contínua Unificado & Assistente Nativo**  
> **Última Atualização:** 2026-10-25T02:08:00Z  
> **Commit Base:** `42226ac` (`FEAT/GEMINI-VOICE-OVERLAY-AND-BLUETOOTH-PIPELINE`)  
> **Versão Mobile:** APK `0.1.19` (`versionCode 19`) — Keystore oficial EAS verificada  
> **Status dos Testes:** Mobile 291/291 PASS (86 suítes) · Go 117/117 AI + 723/723 Backend PASS · TypeScript 0 erros · No God Files (<500L) 100% COMPLIANT  

---

## 🎯 Objetivo Global da Fase
Unificar a experiência de voz do Vito AI em um **Modo de Conversação Contínua** de baixíssima latência, com visual ultra-refinado estilo Google Gemini (pílula flutuante 58dp, waveform de 13 barras acústicas e halo ambiental SVG), VAD nativo em hardware (Kotlin), botão dedicado de acesso rápido no chat, diretrizes de IA calibradas para síntese falada concisa e voz neural humanizada via Edge-TTS.

---

## 📊 Status das 5 Frentes de Trabalho

| Frente | Descrição | Arquivos-Chave | Status | Detalhes |
| :--- | :--- | :--- | :---: | :--- |
| **Frente 1** | **VAD Nativo no Kotlin + Auto-Loop** | `mobile/android/app/src/main/java/com/andrevmp/vito/voice/VitoDuplexAudioModule.kt`<br>`mobile/src/overlay/VitoVoiceOverlay.tsx` | `100% (Concluído & Integrado)` | Máquina de estados VAD em hardware ativa (`speechThreshold = 0.12`, `silenceThreshold = 0.08`, `silenceDurationMs = 900L`, `maxDurationMs = 20s`). Eventos `onSpeechStart` e `onSpeechEnd` consumidos pelo overlay para envio sem toque. Loop contínuo rearmando escuta pós-resposta. |
| **Frente 2** | **UI Pílula 58dp Estilo Gemini, Waveform 13 Barras e Vignette SVG** | `mobile/src/overlay/VitoVoiceOverlay.tsx`<br>`mobile/src/overlay/vitoVoiceOverlayStyles.ts`<br>`mobile/src/overlay/voiceOverlayHelpers.ts`<br>`mobile/src/overlay/__tests__/voiceOverlayHelpers.test.ts` | `100% (Concluído & Testado)` | Pílula 58dp (`borderRadius: 29`), vinheta SVG de 220dp cobrindo apenas rodapé, 13 barras harmônicas com distribuição gaussiana de sino `[0.22 .. 1.0 .. 0.22]`, satélites compactos de WhatsApp e transcrição. Suíte de testes unitários 9/9 PASS. |
| **Frente 3** | **Botão Dedicado de Modo de Conversação no Chat** | `mobile/src/components/chat/ChatInputDock.tsx`<br>`mobile/src/screens/ChatScreen.tsx`<br>`mobile/src/hooks/useChatMessages.ts`<br>`mobile/src/hooks/useChat.ts` | `100% (Concluído & Integrado)` | Botão circular com ícone `graphic-eq` adicionado ao dock de digitação. Modal transparente do `VitoVoiceOverlay` montado sob demanda com sincronização bidirecional do histórico de mensagens (`appendUserMessage` e `appendAssistantMessage`). |
| **Frente 4** | **Calibração de Diretrizes de IA e Escopo** | `backend/internal/ai/prompt_booking_directives.go`<br>`backend/internal/ai/prompt_test.go` | `100% (Concluído & Testado)` | Seção 13 adicionada: fala humanizada sem clichês burocráticos, respostas concisas em 1-2 frases para voz, pesquisa de assuntos gerais (clima, trânsito, cotações, esportes, notícias) e **fronteira estrita de escopo** proibindo monografias/TCC, cálculo superior e código de programação com declínio bem-humorado. Teste Go PASS. |
| **Frente 5** | **Síntese de Voz Neural (Edge-TTS)** | `backend/internal/service/` ou `mobile/android/.../VitoDuplexAudioModule.kt` | `Pronto para Execução no OpenCode` | Arquitetura definida: endpoint `POST /api/v1/voice/tts` no backend Go gerando áudio natural pt-BR (`pt-BR-AntonioNeural`), com fallback transparente para o TextToSpeech do Android. |

---

## 🔍 Detalhamento dos Arquivos Modificados & Linhas

1. **`mobile/src/overlay/voiceOverlayHelpers.ts` (127 linhas)**
   - 13 barras harmônicas gaussianas via `calculateHarmonicBarHeights`.
   - `isGoodbyeUtterance` para encerramento por comandos naturais ("tchau", "valeu", "pode fechar", "só isso").
   - `getAuraColor` e `getStateLabel` com suporte a `LISTENING`, `THINKING`, `SPEAKING`.

2. **`mobile/src/overlay/__tests__/voiceOverlayHelpers.test.ts` (111 linhas)**
   - 9 testes unitários nativos cobrindo as 13 barras gaussianas, valores mínimos de silêncio, detecção de despedidas em português e extração de cards WhatsApp.

3. **`mobile/src/overlay/VitoVoiceOverlay.tsx` (374 linhas)**
   - Pílula fixa 58dp, vinheta SVG suave de 220dp (`react-native-svg`), waveform de 13 barras de 2.5dp.
   - Escuta `onSpeechEnd` e `onSpeechStart` do VAD em hardware.
   - Turn-taking contínuo reabrindo o microfone após o assistente falar, com encerramento automático após 15s de inatividade ou despedida.
   - Suporte aos callbacks `onClose` e `onMessageExchange` para integração com telas hospedeiras.

4. **`mobile/src/overlay/vitoVoiceOverlayStyles.ts` (168 linhas)**
   - Estilos desacoplados para garantir rigorosa observância da regra No God Files (< 500 linhas).

5. **`mobile/src/components/chat/ChatInputDock.tsx` (403 linhas)**
   - Prop `onPressLiveVoice?: () => void`.
   - Botão circular interativo com ícone `graphic-eq` em `colors.primary`.

6. **`mobile/src/screens/ChatScreen.tsx` (484 linhas)**
   - Estado `isVoiceModeActive`.
   - Modal com `VitoVoiceOverlay` transparente acionado pelo botão `graphic-eq`.
   - Integração com `appendUserMessage` e `appendAssistantMessage` mantendo o histórico da conversa sincronizado.

7. **`mobile/src/hooks/useChatMessages.ts` (456 linhas) e `useChat.ts` (100 linhas)**
   - Novo método `appendUserMessage(text: string)` persistindo a transcrição de voz da fala do usuário no storage e na sessão ativa do chat.

8. **`backend/internal/ai/prompt_booking_directives.go` (98 linhas) e `prompt_test.go`**
   - Diretriz de assistente de voz conciso (1 a 2 frases).
   - Pesquisa de assuntos gerais (clima, trânsito, cotações, esportes, fatos do dia a dia).
   - Proibição estrita de monografias, TCC, cálculos avançados de nível superior e geração/depuração de código de programação.

---

## 🚀 Guia de Retomada Instantânea para o OpenCode

Se o limite de tokens terminar aqui e você for continuar no **OpenCode**, basta rodar:

```bash
# 1. Verifique os testes para garantir integridade total
cd mobile && npm test
cd ../backend && go test ./internal/ai/...

# 2. Implementar a Frente 5 (Síntese Neural Edge-TTS):
# Crie o serviço de streaming ou geração de áudio Edge-TTS pt-BR (pt-BR-AntonioNeural)
# no backend Go e no VitoDuplexAudioModule.kt para reprodução direta de alta fidelidade.
```
