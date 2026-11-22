# **Especificação Técnica de Engenharia: Ativação Global por Voz no Android — Vito AI (React Native \+ Go)**

# **1\. Visão Geral da Arquitetura**

Este documento define a implementação técnica para permitir que o **Vito** seja acionado de qualquer tela no Android, oferecendo ao usuário a escolha entre dois modos de operação dentro do aplicativo:

1. **Modo A — Coexistência com Gemini ("Ei Vito" em 2º Plano com Notificação Discreta):** O usuário mantém o Gemini como assistente padrão do botão Power, enquanto o Vito roda um motor neural leve *On-Device* (Porcupine) dentro de um `ForegroundService` nativo com notificação silenciosa minimizada (`IMPORTANCE_MIN`). Ao detectar "Ei Vito", abre o modal React Native sobre qualquer app e inicia o streaming com o backend em **Go**.  
2. **Modo B — Substituição da IA Padrão do Aparelho (Assistente Nativo Sem Notificação):** O usuário define o Vito como o `ROLE_ASSISTANT` padrão do Android (`VoiceInteractionService`). Não há consumo de bateria em segundo plano nem notificação na barra de status. O Vito é acionado segurando o botão Power ou pelo gesto de canto da tela, abrindo uma janela nativa de assistente integrada ao React Native.

# **2\. Comparativo Técnico dos Dois Modos**

## **Modo A: Coexistência ("Ei Vito" em 2º Plano)**

* **Gatilho Principal:** Hotword acústica `"Ei Vito"` processada localmente via Porcupine SDK.  
* **Componente Android Base:** `Service` com `foregroundServiceType="microphone"`.  
* **Notificação na Bandeja:** Sim, configurada com `IMPORTANCE_MIN` (recolhida no fim da gaveta, silenciosa e sem ícone na barra de status principal).  
* **Ponto Verde de Privacidade:** Visível enquanto o serviço de escuta estiver ativo.  
* **Camada de UI (Overlay):** `ReactActivity` Translúcida (`VitoOverlayActivity`).  
* **Comunicação com Backend Go:** WebSocket / gRPC Audio Streaming iniciado apenas após a detecção local do *Wake Word*.

## **Modo B: Substituir IA Padrão do Sistema (`ROLE_ASSISTANT`)**

* **Gatilho Principal:** Segurar o botão Power (1s) ou gesto diagonal a partir dos cantos inferiores da tela.  
* **Componente Android Base:** `VoiceInteractionService` \+ `VoiceInteractionSession`.  
* **Notificação na Bandeja:** **Nenhuma.**  
* **Ponto Verde de Privacidade:** Visível **apenas** durante os segundos em que o usuário está falando.  
* **Camada de UI (Overlay):** `VoiceInteractionSession` acionando o modal React Native e extraindo contexto de tela (`AssistStructure`).  
* **Comunicação com Backend Go:** WebSocket / gRPC Audio Streaming imediato ao abrir a sessão.

# **3\. Configuração do AndroidManifest.xml (Suporte Híbrido)**

Ambos os serviços ficam declarados no `android/app/src/main/AndroidManifest.xml`, mas são ativados ou desativados dinamicamente via **React Native Native Module** conforme a escolha do usuário:

1. 4\. Implementação do Modo A: "Ei Vito" em Conjunto com o Gemini (Notificação Discreta)

```xml
<manifest package="com.vito.app">

    <!-- Permissões para Captura de Áudio e Rede (Go Backend) -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />

    <!-- Permissões para o Modo A (Wake Word "Ei Vito" em 2º Plano) -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />

    <application
        android:name=".MainApplication"
        android:allowBackup="false"
        android:theme="@style/AppTheme">

        <!-- Activity Principal do React Native -->
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTask">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Activity Translúcida para o Modal Flutuante do Vito (Acionada pelo Modo A ou B) -->
        <activity
            android:name=".VitoOverlayActivity"
            android:theme="@style/Theme.AppCompat.Translucent.NoTitleBar"
            android:excludeFromRecents="true"
            android:launchMode="singleInstance"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.ASSIST" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
        </activity>

        <!-- MODO A: Foreground Service de Escuta "Ei Vito" -->
        <service
            android:name=".voice.VitoWakeWordService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="microphone" />

        <!-- MODO B: Serviço Oficial de Assistente Digital do Android -->
        <service
            android:name=".assistant.VitoVoiceInteractionService"
            android:label="Vito AI"
            android:permission="android.permission.BIND_VOICE_INTERACTION"
            android:exported="true">
            <meta-data
                android:name="android.voice_interaction"
                android:resource="@xml/vito_interaction_service" />
            <intent-filter>
                <action android:name="android.service.voice.VoiceInteractionService" />
            </intent-filter>
        </service>

        <service
            android:name=".assistant.VitoVoiceInteractionSessionService"
            android:permission="android.permission.BIND_VOICE_INTERACTION"
            android:exported="true" />
    </application>
</manifest>
```

# 

## **4.1 Serviço Nativo com Porcupine e Notificação IMPORTANCE\_MIN (`VitoWakeWordService.kt`)**

Para que o serviço sobreviva mesmo se o usuário fechar o React Native, criamos o serviço nativo em Kotlin que gerencia o `PorcupineManager` e dispara a `VitoOverlayActivity` quando detecta a frase `"Ei Vito"`:  
5\. Implementação do Modo B: Substituir a IA Padrão do Aparelho (Sem Notificação)

```kotlin
package com.vito.app.voice

import android.app.*
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import ai.picovoice.porcupine.PorcupineManager
import ai.picovoice.porcupine.PorcupineManagerCallback
import com.vito.app.R
import com.vito.app.VitoOverlayActivity

class VitoWakeWordService : Service() {

    private var porcupineManager: PorcupineManager? = null
    private val CHANNEL_ID = "vito_silent_wakeword_channel"
    private val NOTIFICATION_ID = 4001

    override fun onCreate() {
        super.onCreate()
        createDiscreteNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "ACTION_STOP_VITO_WAKEWORD") {
            stopSelf()
            return START_NOT_STICKY
        }

        val notification = buildDiscreteNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        startPorcupineWakeWord()
        return START_STICKY
    }

    private fun startPorcupineWakeWord() {
        try {
            porcupineManager = PorcupineManager.Builder()
                .setAccessKey("SUA_PICOVOICE_ACCESS_KEY")
                .setKeywordPath("ei_vito_pt_android.ppn")
                .setModelPath("porcupine_params_pt.pv")
                .setSensitivity(0.65f)
                .build(applicationContext, PorcupineManagerCallback { _ ->
                    // Pausa o Porcupine para liberar o microfone para o streaming com o backend Go
                    porcupineManager?.stop()
                    launchVitoVoiceOverlay(source = "WAKE_WORD")
                })
            porcupineManager?.start()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun launchVitoVoiceOverlay(source: String) {
        val overlayIntent = Intent(this, VitoOverlayActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("trigger_source", source)
        }
        startActivity(overlayIntent)
    }

    private fun createDiscreteNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // IMPORTANCE_MIN esconde o ícone da barra de status principal e colapsa na gaveta
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Escuta Rápida Ei Vito",
                NotificationManager.IMPORTANCE_MIN
            ).apply {
                description = "Mantém a ativação por voz Ei Vito ativa em segundo plano"
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_SECRET
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildDiscreteNotification(): Notification {
        val stopIntent = Intent(this, VitoWakeWordService::class.java).apply {
            action = "ACTION_STOP_VITO_WAKEWORD"
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 0, stopIntent, PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Vito pronto para ouvir")
            .setContentText("Diga \"Ei Vito\" para agendar")
            .setSmallIcon(R.drawable.ic_vito_monochrome)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setSilent(true)
            .setOngoing(true)
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
            .addAction(0, "Pausar escuta", stopPendingIntent)
            .build()
    }

    override fun onDestroy() {
        porcupineManager?.stop()
        porcupineManager?.delete()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
```

# 

Quando o usuário escolhe substituir a IA padrão do celular pelo Vito, o `VitoWakeWordService` (Modo A) é desligado, eliminando qualquer uso contínuo do microfone e qualquer notificação.

## **5.1 Configuração XML (`res/xml/vito_interaction_service.xml`)**

5.2 Sessão de Assistente com Contexto de Tela (`VitoVoiceInteractionSession.kt`)

```xml
<?xml version="1.0" encoding="utf-8"?>
<voice-interaction-service
    android:sessionService="com.vito.app.assistant.VitoVoiceInteractionSessionService"
    android:recognitionService="com.vito.app.assistant.VitoRecognitionService"
    android:settingsActivity="com.vito.app.MainActivity"
    android:supportsAssist="true"
    android:supportsLaunchVoiceAssistFromKeyguard="true" />
```

## 

Ao segurar o botão Power, o Android instancia esta sessão sobre qualquer aplicativo aberto, sem exigir `SYSTEM_ALERT_WINDOW` e fornecendo até o contexto do que está na tela (`AssistStructure`):

* 6\. Bridge React Native (Alternando entre Modo A e Modo B)

```kotlin
package com.vito.app.assistant

import android.app.assist.AssistContent
import android.app.assist.AssistStructure
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.service.voice.VoiceInteractionSession
import com.vito.app.VitoOverlayActivity

class VitoVoiceInteractionSession(context: Context) : VoiceInteractionSession(context) {

    private var screenContextText: String? = null

    override fun onHandleAssist(
        data: Bundle?,
        structure: AssistStructure?,
        content: AssistContent?
    ) {
        super.onHandleAssist(data, structure, content)
        // Extrai texto visível da tela (ex: conversa do WhatsApp com horário)
        // para enviar como metadado para a IA em Go facilitar o agendamento
        screenContextText = extractVisibleText(structure)
    }

    override fun onShow(args: Bundle?, showFlags: Int) {
        super.onShow(args, showFlags)
        // Aciona o BottomSheet React Native do Vito imediatamente no modo de escuta
        val intent = Intent(context, VitoOverlayActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("trigger_source", "DEFAULT_ASSISTANT")
            putExtra("screen_context", screenContextText ?: "")
        }
        context.startActivity(intent)
        hide()
    }

    private fun extractVisibleText(structure: AssistStructure?): String {
        if (structure == null) return ""
        val sb = StringBuilder()
        for (i in 0 until structure.windowNodeCount) {
            val rootNode = structure.getWindowNodeAt(i).rootViewNode
            traverseNode(rootNode, sb)
        }
        return sb.toString().take(1500)
    }

    private fun traverseNode(node: AssistStructure.ViewNode, sb: StringBuilder) {
        if (!node.text.isNullOrBlank()) {
            sb.append(node.text).append(" ")
        }
        for (i in 0 until node.childCount) {
            traverseNode(node.getChildAt(i), sb)
        }
    }
}
```

# 

## **6.1 Native Module em Kotlin (`VitoAssistantModule.kt`)**

Expõe para o TypeScript no React Native o controle para ligar/desligar a escuta com notificação discreta (Modo A) ou abrir o seletor oficial do Android para substituir o Gemini pelo Vito (Modo B):  
6.2 Componente React Native (Seletor de Modo)

```kotlin
package com.vito.app.bridge

import android.content.Intent
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.*
import com.vito.app.voice.VitoWakeWordService

class VitoAssistantModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "VitoAssistantModule"

    @ReactMethod
    fun setActivationMode(mode: String, promise: Promise) {
        try {
            val serviceIntent = Intent(reactContext, VitoWakeWordService::class.java)
            when (mode) {
                "COEXIST_WAKE_WORD" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        reactContext.startForegroundService(serviceIntent)
                    } else {
                        reactContext.startService(serviceIntent)
                    }
                    promise.resolve("WAKE_WORD_ACTIVE")
                }
                "REPLACE_DEFAULT_ASSISTANT" -> {
                    reactContext.stopService(serviceIntent)
                    openSystemAssistantPicker()
                    promise.resolve("SYSTEM_PICKER_OPENED")
                }
                "DISABLED" -> {
                    reactContext.stopService(serviceIntent)
                    promise.resolve("DISABLED")
                }
            }
        } catch (e: Exception) {
            promise.reject("MODE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun isVitoDefaultAssistant(promise: Promise) {
        val setting = Settings.Secure.getString(
            reactContext.contentResolver,
            "voice_interaction_service"
        )
        val isDefault = setting?.contains(reactContext.packageName) == true
        promise.resolve(isDefault)
    }

    private fun openSystemAssistantPicker() {
        val intent = Intent(Settings.ACTION_VOICE_INPUT_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactContext.startActivity(intent)
    }
}
```

## 

No TypeScript (React Native), o usuário escolhe o modo e o app persiste a preferência:

```ts
import React, { useState, useEffect } from 'react';
import { NativeModules, View, Text, TouchableOpacity } from 'react-native';

const { VitoAssistantModule } = NativeModules;

export type ActivationMode = 'COEXIST_WAKE_WORD' | 'REPLACE_DEFAULT_ASSISTANT' | 'DISABLED';

export function VoiceActivationSettings() {
  const [selectedMode, setSelectedMode] = useState<ActivationMode>('COEXIST_WAKE_WORD');
  const [isDefaultAssistant, setIsDefaultAssistant] = useState(false);

  useEffect(() => {
    VitoAssistantModule.isVitoDefaultAssistant().then(setIsDefaultAssistant);
  }, []);

  const handleSelectMode = async (mode: ActivationMode) => {
    setSelectedMode(mode);
    await VitoAssistantModule.setActivationMode(mode);
  };

  return (
    <View>
      <TouchableOpacity onPress={() => handleSelectMode('COEXIST_WAKE_WORD')}>
        <Text>Modo 1: "Ei Vito" Sempre Ativo (Mantém o Gemini)</Text>
        <Text>
          Escuta "Ei Vito" em qualquer tela com um ícone discreto e silencioso na bandeja.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => handleSelectMode('REPLACE_DEFAULT_ASSISTANT')}>
        <Text>Modo 2: Assistente Padrão do Aparelho (Sem Notificação)</Text>
        <Text>
          Substitui o assistente padrão no botão Power. Zero notificação e zero gasto de bateria em 2º plano.
          {isDefaultAssistant ? ' (Ativo no Sistema)' : ' (Toque para definir como padrão)'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

# **7\. Arquitetura de Streaming de Áudio com o Backend em Go**

Assim que o Vito é acionado (seja pelo Porcupine no **Modo A** ou pelo botão Power no **Modo B**), o ciclo de baixa latência com o servidor em **Go** segue este pipeline:

## **7.1 Fluxo de Comunicação (WebSocket Binário)**

1. **Handshake Inicial:** O modal React Native abre uma conexão WebSocket (`/v1/voice/stream`) enviando o header `Authorization: Bearer <JWT>` e um pacote JSON de metadados contendo `trigger_source`, `timezone` e `screen_context` (caso acionado pelo Modo B).  
2. **Envio de Chunks PCM (16kHz, 16-bit, Mono):** O Android captura o áudio do usuário e envia frames binários de 20ms a 40ms diretamente pelo WebSocket.  
3. **Processamento Concorrente em Go:** O handler em Go recebe os frames binários em uma goroutine, processa o STT/LLM com *Function Calling* para criar/editar o agendamento no banco de dados e devolve eventos JSON de atualização de UI \+ áudio de resposta.

## **7.2 Exemplo de Handler WebSocket em Go (`internal/voice/handler.go`)**

```go
package voice

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

type SessionInitPayload struct {
	TriggerSource string `json:"trigger_source"` // "WAKE_WORD" ou "DEFAULT_ASSISTANT"
	Timezone      string `json:"timezone"`
	ScreenContext string `json:"screen_context,omitempty"`
}

func HandleVoiceStream(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Erro no upgrade WebSocket: %v", err)
		return
	}
	defer conn.Close()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	// 1. Lê o primeiro frame JSON com o contexto da ativação
	_, msg, err := conn.ReadMessage()
	if err != nil {
		return
	}
	var initPayload SessionInitPayload
	_ = json.Unmarshal(msg, &initPayload)

	// 2. Loop de leitura de chunks binários PCM 16kHz enviados pelo React Native
	for {
		messageType, audioChunk, err := conn.ReadMessage()
		if err != nil {
			break
		}

		if messageType == websocket.BinaryMessage {
			// Envia o chunk PCM para o pipeline de STT / Agente de Agendamento
			processAudioChunk(ctx, conn, audioChunk, initPayload)
		}
	}
}

func processAudioChunk(ctx context.Context, conn *websocket.Conn, pcm []byte, meta SessionInitPayload) {
	// Integração com motor STT/LLM e execução de Tool Call (CreateAppointment)
}
```

# **8\. Implementação da VitoOverlayActivity e Captura de Áudio PCM 16kHz (React Native \-\> Go)**

## **8.1 Activity Translúcida de Overlay no Android (`VitoOverlayActivity.kt`)**

Esta `ReactActivity` carrega um componente registrado separadamente no React Native (`"VitoVoiceOverlay"`), permitindo que um *BottomSheet* flutuante apareça instantaneamente sobre qualquer aplicativo sem carregar toda a árvore da tela principal do Vito:

```kotlin
package com.vito.app

import android.os.Bundle
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate

class VitoOverlayActivity : ReactActivity() {

    override fun getMainComponentName(): String = "VitoVoiceOverlay"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Permite abrir sobre a tela de bloqueio se acionado pelo botão Power ou Wake Word
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        )
    }

    override fun createReactActivityDelegate(): ReactActivityDelegate {
        return object : ReactActivityDelegate(this, mainComponentName) {
            override fun getLaunchOptions(): Bundle {
                val initialProps = Bundle()
                initialProps.putString("triggerSource", intent?.getStringExtra("trigger_source") ?: "MANUAL")
                initialProps.putString("screenContext", intent?.getStringExtra("screen_context") ?: "")
                return initialProps
            }
        }
    }
}
```

## **8.2 Registro do Componente Flutuante (`index.js`)**

No ponto de entrada do React Native, registramos tanto o app principal quanto o overlay leve:

```js
import { AppRegistry } from 'react-native';
import App from './src/App';
import { VitoVoiceOverlay } from './src/overlay/VitoVoiceOverlay';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerComponent('VitoVoiceOverlay', () => VitoVoiceOverlay);
```

## **8.3 Captura de Chunks PCM 16kHz no React Native e Envio via WebSocket para o Go**

Usando `react-native-live-audio-stream` (ou módulo nativo `AudioRecord` em 16kHz, 16-bit, Mono), capturamos os chunks em tempo real, convertemos de Base64 para `Uint8Array` (binário puro) e fazemos o streaming direto para o handler em **Go**:

```ts
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, NativeModules } from 'react-native';
import LiveAudioStream from 'react-native-live-audio-stream';
import { Buffer } from 'buffer';

const { VitoAssistantModule } = NativeModules;

interface OverlayProps {
  triggerSource: 'WAKE_WORD' | 'DEFAULT_ASSISTANT' | 'MANUAL';
  screenContext?: string;
}

export function VitoVoiceOverlay({ triggerSource, screenContext }: OverlayProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<'CONNECTING' | 'LISTENING' | 'PROCESSING'>('CONNECTING');
  const [transcript, setTranscript] = useState<string>('Ouvindo você...');

  useEffect(() => {
    startStreamingSession();
    return () => {
      stopStreamingSession();
    };
  }, []);

  const startStreamingSession = () => {
    const ws = new WebSocket('wss://api.vito.app/v1/voice/stream');
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      // 1. Envia o primeiro frame JSON com metadados e contexto da tela
      ws.send(
        JSON.stringify({
          trigger_source: triggerSource,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          screen_context: screenContext || '',
        })
      );

      // 2. Inicia captura de áudio PCM 16kHz, 16-bit, Mono
      LiveAudioStream.init({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        audioSource: 6, // VOICE_RECOGNITION (aplica cancelamento de ruído nativo do Android)
        bufferSize: 2048,
      });

      LiveAudioStream.on('data', (base64Chunk: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          const pcmBytes = Buffer.from(base64Chunk, 'base64');
          ws.send(pcmBytes);
        }
      });

      LiveAudioStream.start();
      setStatus('LISTENING');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'PARTIAL_TRANSCRIPT') {
        setTranscript(data.text);
      } else if (data.type === 'APPOINTMENT_CONFIRMED') {
        setStatus('PROCESSING');
        setTranscript(`Agendado: ${data.summary}`);
      }
    };
  };

  const stopStreamingSession = async () => {
    LiveAudioStream.stop();
    wsRef.current?.close();

    // Se o usuário usa o Modo A ("Ei Vito"), reativa o Porcupine ao fechar o modal
    if (triggerSource === 'WAKE_WORD') {
      await VitoAssistantModule.setActivationMode('COEXIST_WAKE_WORD');
    }
  };

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <Text style={styles.badge}>
          {triggerSource === 'WAKE_WORD' ? 'Ei Vito' : 'Assistente Vito'}
        </Text>
        <Text style={styles.transcript}>{transcript}</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={stopStreamingSession}>
          <Text style={styles.closeText}>Concluir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: '#121214',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 220,
  },
  badge: {
    color: '#A1A1AA',
    fontSize: 12,
    marginBottom: 8,
  },
  transcript: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: '#27272A',
    borderRadius: 12,
  },
  closeText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
});
```

# **9\. Pipeline Backend em Go: Detecção de Fim de Fala (VAD) e Function Calling de Agendamento**

Para que o Vito responda com latência mínima assim que o usuário terminar de falar (ex: *"Marca dentista amanhã às 14h"*), o servidor em **Go** combina um detector de atividade de voz (VAD) sobre os frames PCM 16kHz com a execução de *Function Calling* do LLM.

## **9.1 Arquitetura do Pipeline em Go**

4. **Acumulação de Buffer \+ Cálculo de Energia RMS (VAD):**  
   1. Cada chunk binário PCM 16-bit recebido no WebSocket passa por um analisador de energia acústica (ou wrapper CGo do `WebRTC VAD` / `Silero VAD`).  
   2. Quando o usuário começa a falar, o estado muda para `SPEAKING`.  
   3. Quando o silêncio contínuo ultrapassa **700ms** após a fala, o servidor dispara o gatilho de `End-Of-Speech`.  
5. **Transcrição \+ LLM Function Calling:**  
   1. O buffer de áudio acumulado (ou stream direto via Gemini Multimodal Live / OpenAI Realtime) é processado junto com o `screen_context` (caso o usuário tenha acionado pelo botão Power lendo uma conversa no WhatsApp) e o `timezone`.  
   2. O LLM invoca a tool `create_appointment(title, start_time, duration_min, notes)`.  
6. **Retorno Instantâneo para o Overlay React Native:**  
   1. O Go grava o evento no PostgreSQL, envia o evento JSON `APPOINTMENT_CONFIRMED` pelo WebSocket para o modal flutuante do React Native atualizar a UI e fecha ou reinicia o ciclo.

## **9.2 Implementação Completa em Go (`internal/voice/pipeline.go`)**

```go
package voice

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"math"
	"time"

	"github.com/gorilla/websocket"
)

const (
	SampleRate       = 16000
	SilenceThreshold = 350.0 // Limiar RMS para PCM 16-bit
	SilenceDuration  = 700 * time.Millisecond
)

type ServerEvent struct {
	Type    string `json:"type"`
	Text    string `json:"text,omitempty"`
	Summary string `json:"summary,omitempty"`
}

type AppointmentArgs struct {
	Title       string `json:"title"`
	StartTime   string `json:"start_time"` // ISO-8601
	DurationMin int    `json:"duration_min"`
}

type VoiceSession struct {
	Conn          *websocket.Conn
	Meta          SessionInitPayload
	AudioBuffer   bytes.Buffer
	IsSpeaking    bool
	LastVoiceTime time.Time
}

func NewVoiceSession(conn *websocket.Conn, meta SessionInitPayload) *VoiceSession {
	return &VoiceSession{
		Conn:          conn,
		Meta:          meta,
		LastVoiceTime: time.Now(),
	}
}

// ProcessChunk analisa cada frame PCM 16kHz (16-bit Little Endian) e detecta fim de fala (VAD)
func (s *VoiceSession) ProcessChunk(ctx context.Context, pcmChunk []byte) {
	rms := calculateRMS16Bit(pcmChunk)

	if rms > SilenceThreshold {
		if !s.IsSpeaking {
			s.IsSpeaking = true
			s.sendEvent(ServerEvent{Type: "PARTIAL_TRANSCRIPT", Text: "Ouvindo..."})
		}
		s.LastVoiceTime = time.Now()
		s.AudioBuffer.Write(pcmChunk)
		return
	}

	// Se já estava falando, continua guardando o final do áudio até atingir o tempo de silêncio
	if s.IsSpeaking {
		s.AudioBuffer.Write(pcmChunk)

		if time.Since(s.LastVoiceTime) >= SilenceDuration {
			// Fim da fala detectado! Dispara processamento de IA
			audioData := make([]byte, s.AudioBuffer.Len())
			copy(audioData, s.AudioBuffer.Bytes())

			s.AudioBuffer.Reset()
			s.IsSpeaking = false

			go s.executeSchedulingIntent(ctx, audioData)
		}
	}
}

func (s *VoiceSession) executeSchedulingIntent(ctx context.Context, pcmAudio []byte) {
	s.sendEvent(ServerEvent{
		Type: "PARTIAL_TRANSCRIPT",
		Text: "Processando agendamento...",
	})

	// 1. Transcrição + LLM Tool Call ( usando contexto da tela se disponível no Modo B)
	// Exemplo: O LLM analisa o áudio + s.Meta.ScreenContext e retorna os argumentos da Tool
	args, err := callLLMWithSchedulingTools(ctx, pcmAudio, s.Meta)
	if err != nil {
		s.sendEvent(ServerEvent{Type: "PARTIAL_TRANSCRIPT", Text: "Não consegui entender, pode repetir?"})
		return
	}

	// 2. Persiste no banco de dados (PostgreSQL)
	err = saveAppointmentInDB(ctx, args)
	if err != nil {
		s.sendEvent(ServerEvent{Type: "PARTIAL_TRANSCRIPT", Text: "Erro ao salvar na agenda."})
		return
	}

	// 3. Notifica o modal React Native em tempo real
	s.sendEvent(ServerEvent{
		Type:    "APPOINTMENT_CONFIRMED",
		Summary: args.Title + " (" + args.StartTime + ")",
	})
}

func (s *VoiceSession) sendEvent(ev ServerEvent) {
	payload, _ := json.Marshal(ev)
	_ = s.Conn.WriteMessage(websocket.TextMessage, payload)
}

// calculateRMS16Bit calcula a energia acústica (Root Mean Square) de um chunk PCM 16-bit
func calculateRMS16Bit(pcm []byte) float64 {
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

func callLLMWithSchedulingTools(ctx context.Context, pcm []byte, meta SessionInitPayload) (*AppointmentArgs, error) {
	// Integração com Gemini API (enviando inlineData audio/pcm + Function Declaration "create_appointment")
	return &AppointmentArgs{
		Title:       "Consulta Dentista",
		StartTime:   "2026-10-23T14:00:00-03:00",
		DurationMin: 60,
	}, nil
}

func saveAppointmentInDB(ctx context.Context, args *AppointmentArgs) error {
	// INSERT INTO appointments (title, start_time, duration_min) VALUES ($1, $2, $3)
	return nil
}
```

# **10\. Modo Conversa Contínua Full-Duplex (Estilo Gemini Live / ChatGPT Voice) — Go \+ React Native**

Para proporcionar uma experiência fluida onde o usuário conversa naturally com o **Vito** em múltiplos turnos (sem precisar tocar em botões a cada frase e podendo interromper o assistente a qualquer momento), a arquitetura evolui de um modelo *Half-Duplex* (fala única \-\> fecha sessão) para um modelo **Full-Duplex Bidirecional com Barge-In (Interrupção)**.

## **10.1 Pilares Técnicos do Modo Conversa Contínua**

7. **Canal Bidirecional Persistente (Full-Duplex WebSocket):**  
   1. O microfone continua capturando áudio PCM 16kHz durante toda a conversa, inclusive enquanto o Vito está respondendo por voz (TTS).  
   2. Para evitar que o Vito "ouça a própria voz" saindo do alto-falante do celular e entre em loop infinito, o Android utiliza obrigatoriamente o `AudioSource.VOICE_COMMUNICATION` (7) com `AcousticEchoCanceler` (AEC) e `NoiseSuppressor` (NS) nativos do hardware ativados.  
8. **Barge-In (Interrupção Natural em Tempo Real):**  
   1. Se o Vito estiver falando (*"Na terça-feira você tem horário livre às 14h e às 16h, qual você..."*) e o usuário o interromper no meio da frase (*"Pode ser às 16h"*), o detector de voz (VAD) no Go identifica a voz do usuário, cancela imediatamente o `context.Context` da geração/streaming de áudio atual e envia um evento `CLEAR_AUDIO_BUFFER` para o React Native silenciar o alto-falante no mesmo milissegundo.  
9. **Memória Conversacional Multi-Turno \+ Execução Assíncrona de Tools:**  
   1. A sessão mantém o histórico de mensagens (`[]ChatMessage`) em memória no Go (ou sincronizado com Redis) enquanto o modal estiver aberto.  
   2. O usuário pode encadear ações: *"O que eu tenho pra amanhã?"* \-\> Vito responde \-\> *"Passa essa reunião das 10h para as 15h"* \-\> Vito executa a tool `reschedule_appointment` e responde confirmando \-\> *"Beleza, só isso, valeu\!"* \-\> Vito detecta intenção de encerramento e invoca a tool `end_conversation`, fechando o modal sozinho.

## **10.2 Máquina de Estados da Conversa (Go \<-\> React Native)**

* `LISTENING`: Microfone aberto, aguardando ou capturando a fala do usuário.  
* `THINKING`: Silêncio pós-fala detectado (500ms–600ms); o Go está processando a resposta ou executando *Tool Calls* no banco (ex: consultando/alterando agenda).  
* `SPEAKING`: O Go está enviando chunks binários de áudio TTS (PCM 24kHz/16kHz) de volta pelo WebSocket e o celular está reproduzindo a voz do Vito.  
* `INTERRUPTED (Barge-In)`: O usuário falou durante o estado `SPEAKING`. O playback para instantaneamente e a sessão volta para `LISTENING`.

## **10.3 Implementação no Backend em Go: Sessão Full-Duplex com Barge-In e Multi-Turn Tools (`internal/voice/live_conversation.go`)**

```go
package voice

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type ConversationTurn struct {
	Role    string `json:"role"` // "user", "assistant", "tool"
	Content string `json:"content"`
}

type LiveConversationSession struct {
	Conn             *websocket.Conn
	WriteMu          sync.Mutex
	Meta             SessionInitPayload
	History          []ConversationTurn
	AudioBuffer      bytes.Buffer
	IsUserSpeaking   bool
	IsBotSpeaking    bool
	LastVoiceTime    time.Time
	CancelBotSpeech  context.CancelFunc // Cancela a fala atual do Vito se o usuário interromper (Barge-In)
}

func NewLiveConversationSession(conn *websocket.Conn, meta SessionInitPayload) *LiveConversationSession {
	return &LiveConversationSession{
		Conn:          conn,
		Meta:          meta,
		History:       make([]ConversationTurn, 0),
		LastVoiceTime: time.Now(),
	}
}

// HandleIncomingPCM processa continuamente os chunks PCM enviados pelo celular
func (s *LiveConversationSession) HandleIncomingPCM(ctx context.Context, pcmChunk []byte) {
	rms := calculateRMS16Bit(pcmChunk)

	// 1. Detectou voz humana acima do limiar
	if rms > SilenceThreshold {
		// BARGE-IN: Se o Vito estava falando e o usuário começou a falar por cima, interrompe o Vito imediatamente!
		if s.IsBotSpeaking && s.CancelBotSpeech != nil {
			s.CancelBotSpeech()
			s.IsBotSpeaking = false
			s.sendJSONEvent(ServerEvent{
				Type: "BARGE_IN_STOP_AUDIO",
				Text: "Ouvindo você...",
			})
		}

		if !s.IsUserSpeaking {
			s.IsUserSpeaking = true
			s.sendJSONEvent(ServerEvent{
				Type: "STATE_CHANGED",
				Text: "LISTENING",
			})
		}

		s.LastVoiceTime = time.Now()
		s.AudioBuffer.Write(pcmChunk)
		return
	}

	// 2. Usuário estava falando e fez pausa (Fim do turno do usuário)
	if s.IsUserSpeaking {
		s.AudioBuffer.Write(pcmChunk)

		if time.Since(s.LastVoiceTime) >= 600*time.Millisecond {
			utterancePCM := make([]byte, s.AudioBuffer.Len())
			copy(utterancePCM, s.AudioBuffer.Bytes())

			s.AudioBuffer.Reset()
			s.IsUserSpeaking = false

			// Cria um contexto cancelável para o turno de resposta do Vito (permite Barge-In)
			botCtx, cancel := context.WithCancel(ctx)
			s.CancelBotSpeech = cancel

			go s.processConversationTurn(botCtx, utterancePCM)
		}
	}
}

func (s *LiveConversationSession) processConversationTurn(ctx context.Context, userAudioPCM []byte) {
	s.sendJSONEvent(ServerEvent{
		Type: "STATE_CHANGED",
		Text: "THINKING",
	})

	// 1. Envia o áudio do turno atual + Histórico da Conversa + Tools da Agenda para o LLM
	// Tools disponíveis: list_appointments, create_appointment, reschedule_appointment, cancel_appointment, end_conversation
	userText, botReplyText, toolAction, shouldEnd, err := runMultiTurnSchedulingAgent(ctx, userAudioPCM, s.History, s.Meta)
	if err != nil || ctx.Err() != nil {
		return // Turno foi cancelado por Barge-In do usuário
	}

	// Atualiza a memória conversacional da sessão
	s.History = append(s.History,
		ConversationTurn{Role: "user", Content: userText},
		ConversationTurn{Role: "assistant", Content: botReplyText},
	)

	// Se alguma tarefa foi executada na agenda, atualiza o card visual no React Native sem interromper a conversa
	if toolAction != "" {
		s.sendJSONEvent(ServerEvent{
			Type:    "TASK_EXECUTED",
			Summary: toolAction,
		})
	}

	// 2. Inicia o streaming da voz de resposta do Vito (TTS em chunks PCM binários)
	s.IsBotSpeaking = true
	s.sendJSONEvent(ServerEvent{
		Type: "BOT_TRANSCRIPT",
		Text: botReplyText,
	})

	err = s.streamTTSResponseToClient(ctx, botReplyText)
	if err == nil && ctx.Err() == nil {
		s.IsBotSpeaking = false
		if shouldEnd {
			// Usuário se despediu ("Valeu Vito, era só isso") -> fecha o modal automaticamente
			s.sendJSONEvent(ServerEvent{Type: "END_CONVERSATION"})
		} else {
			// Continua a conversa aguardando a próxima frase do usuário!
			s.sendJSONEvent(ServerEvent{Type: "STATE_CHANGED", Text: "LISTENING"})
		}
	}
}

// streamTTSResponseToClient sintetiza a resposta do Vito e envia frames binários de áudio pelo WebSocket
func (s *LiveConversationSession) streamTTSResponseToClient(ctx context.Context, replyText string) error {
	audioChunks := synthesizeStreamingPCM(ctx, replyText)

	for chunk := range audioChunks {
		select {
		case <-ctx.Done():
			// Usuário interrompeu o Vito no meio da fala! Para de enviar áudio imediatamente.
			return ctx.Err()
		default:
			s.WriteMu.Lock()
			err := s.Conn.WriteMessage(websocket.BinaryMessage, chunk)
			s.WriteMu.Unlock()
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *LiveConversationSession) sendJSONEvent(ev ServerEvent) {
	s.WriteMu.Lock()
	defer s.WriteMu.Unlock()
	payload, _ := json.Marshal(ev)
	_ = s.Conn.WriteMessage(websocket.TextMessage, payload)
}

func runMultiTurnSchedulingAgent(
	ctx context.Context,
	pcm []byte,
	history []ConversationTurn,
	meta SessionInitPayload,
) (userTranscript string, assistantReply string, executedTaskSummary string, endSession bool, err error) {
	// Integração com Gemini Live / Gemini 2.5 Flash com histórico multi-turn e Function Calling:
	// - create_appointment
	// - reschedule_appointment
	// - list_appointments
	// - end_conversation (acionada quando o usuário diz "obrigado, só isso", "pode fechar")
	log.Printf("Turnos na memória: %d", len(history))
	return "Marca dentista amanhã às 14h e vê se tenho algo depois",
		"Pronto! Marquei seu dentista para amanhã às 14h. Depois disso você tem reunião de projeto às 16h. Quer mudar algo?",
		"Dentista agendado (Amanhã, 14:00)",
		false,
		nil
}

func synthesizeStreamingPCM(ctx context.Context, text string) <-chan []byte {
	ch := make(chan []byte)
	go func() {
		defer close(ch)
		// Stream de chunks PCM 16-bit do motor de TTS (ex: Gemini Audio Out / ElevenLabs PCM)
	}()
	return ch
}
```

## **10.4 Cancelamento de Eco Acústico (AEC) e Player de Baixa Latência no Android/React Native**

Para que o usuário possa falar enquanto o Vito responde sem que o microfone capture a voz do próprio Vito saindo pelo alto-falante, configuramos o `AudioRecord` e o `AudioTrack` nativos no Android em modo `MODE_IN_COMMUNICATION`:

### **Módulo Nativo de Áudio Full-Duplex com AEC (`VitoDuplexAudioModule.kt`)**

```kotlin
package com.vito.app.voice

import android.content.Context
import android.media.*
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.NoiseSuppressor
import com.facebook.react.bridge.*

class VitoDuplexAudioModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var audioRecord: AudioRecord? = null
    private var audioTrack: AudioTrack? = null
    private var echoCanceler: AcousticEchoCanceler? = null
    private var noiseSuppressor: NoiseSuppressor? = null

    override fun getName(): String = "VitoDuplexAudioModule"

    @ReactMethod
    fun startFullDuplexAudio() {
        val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        // Ativa o roteamento de conversação com cancelamento de eco por hardware do Android
        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
        audioManager.isSpeakerphoneOn = true

        val sampleRate = 16000
        val minBufferSize = AudioRecord.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )

        // VOICE_COMMUNICATION (7) habilita o DSP de cancelamento de eco acústico do aparelho
        audioRecord = AudioRecord(
            MediaRecorder.AudioSource.VOICE_COMMUNICATION,
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            minBufferSize * 2
        )

        val sessionId = audioRecord!!.audioSessionId
        if (AcousticEchoCanceler.isAvailable()) {
            echoCanceler = AcousticEchoCanceler.create(sessionId)?.apply { enabled = true }
        }
        if (NoiseSuppressor.isAvailable()) {
            noiseSuppressor = NoiseSuppressor.create(sessionId)?.apply { enabled = true }
        }

        // Inicializa o AudioTrack atrelado à mesma sessão para reprodução instantânea do TTS do Go
        val outBufferSize = AudioTrack.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        audioTrack = AudioTrack(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build(),
            AudioFormat.Builder()
                .setSampleRate(sampleRate)
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build(),
            outBufferSize,
            AudioTrack.MODE_STREAM,
            sessionId // Compartilha o sessionId com o AudioRecord para o AEC subtrair a voz do Vito!
        )
        audioTrack?.play()
    }

    @ReactMethod
    fun stopBotPlaybackImmediately() {
        // Acionado no evento BARGE_IN_STOP_AUDIO quando o usuário interrompe o Vito
        audioTrack?.pause()
        audioTrack?.flush()
        audioTrack?.play()
    }
}
```

## **10.5 Tratamento dos Eventos da Conversa Contínua no React Native (`VitoVoiceOverlay.tsx`)**

No componente React Native, o WebSocket agora opera em loop contínuo, exibindo um orbe animado que alterna entre `Ouvindo`, `Pensando` e `Falando`, empilhando os cards de tarefas concluídas e só fechando quando o próprio Vito (ou o usuário) encerra o papo:

```ts
ws.onmessage = (event) => {
  // 1. Se for binário, são chunks de áudio da voz do Vito vindos do Go -> envia direto para o AudioTrack
  if (event.data instanceof ArrayBuffer) {
    VitoDuplexAudioModule.writePCMChunkToSpeaker(Buffer.from(event.data).toString('base64'));
    return;
  }

  // 2. Se for texto, são eventos de controle da conversa contínua
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case 'STATE_CHANGED':
      setConversationState(msg.text); // 'LISTENING' | 'THINKING' | 'SPEAKING'
      break;

    case 'BARGE_IN_STOP_AUDIO':
      // Usuário falou por cima do Vito: limpa o buffer de áudio imediatamente
      VitoDuplexAudioModule.stopBotPlaybackImmediately();
      setConversationState('LISTENING');
      break;

    case 'BOT_TRANSCRIPT':
      setConversationState('SPEAKING');
      setTranscript(msg.text);
      break;

    case 'TASK_EXECUTED':
      // Adiciona o card da tarefa feita (ex: "Reunião remarcada para 16h") na tela e continua a conversa
      setCompletedTasks((prev) => [...prev, msg.summary]);
      break;

    case 'END_CONVERSATION':
      // Usuário se despediu ("Valeu, era só isso") -> encerra a sessão e fecha o modal sozinho
      stopStreamingSession();
      break;
  }
};
```

