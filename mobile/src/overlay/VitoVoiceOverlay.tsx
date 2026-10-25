import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  NativeModules,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';

const { VitoAssistantModule, VitoDuplexAudioModule } = NativeModules;
const { width } = Dimensions.get('window');

export interface VitoVoiceOverlayProps {
  triggerSource?: 'WAKE_WORD' | 'DEFAULT_ASSISTANT' | 'MANUAL';
  screenContext?: string;
}

export type ConversationState = 'LISTENING' | 'THINKING' | 'SPEAKING';

export function VitoVoiceOverlay({
  triggerSource = 'MANUAL',
  screenContext = '',
}: VitoVoiceOverlayProps) {
  const [state, setState] = useState<ConversationState>('LISTENING');
  const [transcript, setTranscript] = useState<string>('Estou ouvindo...');
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Animação de pulso do orbe
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Inicia loop de respiração do orbe
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // Inicializa módulo nativo duplex de áudio com AEC
    if (VitoDuplexAudioModule?.startFullDuplexAudio) {
      VitoDuplexAudioModule.startFullDuplexAudio().catch(() => {});
    }

    // Inicializa conexão de voz
    connectVoiceStream();

    return () => {
      pulseLoop.stop();
      cleanupSession();
    };
  }, []);

  const connectVoiceStream = () => {
    try {
      const wsUrl = 'wss://vito.rasppi.cloud/v1/voice/stream';
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Envia frame de inicialização com metadados e contexto da tela
        ws.send(
          JSON.stringify({
            trigger_source: triggerSource,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            screen_context: screenContext || '',
          })
        );
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            handleServerEvent(msg);
          } catch {
            // Ignora frames não-JSON
          }
        }
      };

      ws.onerror = () => {
        setState('LISTENING');
        setTranscript('Diga algo como "Marca dentista amanhã às 14h"...');
      };
    } catch {
      // Falha graciosa
    }
  };

  const handleServerEvent = (msg: { type: string; text?: string; summary?: string }) => {
    switch (msg.type) {
      case 'STATE_CHANGED':
        if (msg.text === 'LISTENING' || msg.text === 'THINKING' || msg.text === 'SPEAKING') {
          setState(msg.text as ConversationState);
        }
        break;

      case 'BARGE_IN_STOP_AUDIO':
        if (VitoDuplexAudioModule?.stopBotPlaybackImmediately) {
          VitoDuplexAudioModule.stopBotPlaybackImmediately();
        }
        setState('LISTENING');
        setTranscript('Ouvindo você...');
        break;

      case 'BOT_TRANSCRIPT':
        setState('SPEAKING');
        if (msg.text) setTranscript(msg.text);
        break;

      case 'TASK_EXECUTED':
        if (msg.summary) {
          setCompletedTasks((prev) => [...prev, msg.summary as string]);
        }
        break;

      case 'END_CONVERSATION':
        handleClose();
        break;
    }
  };

  const cleanupSession = async () => {
    try {
      wsRef.current?.close();
      if (VitoDuplexAudioModule?.releaseDuplexAudio) {
        VitoDuplexAudioModule.releaseDuplexAudio();
      }
    } catch {
      // Ignora erro de cleanup
    }
  };

  const handleClose = () => {
    cleanupSession();
  };

  const getOrbColor = () => {
    switch (state) {
      case 'LISTENING':
        return '#10B981'; // Esmeralda / Verde
      case 'THINKING':
        return '#3B82F6'; // Azul sereno
      case 'SPEAKING':
        return '#8B5CF6'; // Roxo vibrante
    }
  };

  const getStateLabel = () => {
    switch (state) {
      case 'LISTENING':
        return 'Ouvindo você...';
      case 'THINKING':
        return 'Pensando...';
      case 'SPEAKING':
        return 'Vito respondendo';
    }
  };

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        {/* Header com indicador de gatilho */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {triggerSource === 'WAKE_WORD'
                ? 'Ei Vito'
                : triggerSource === 'DEFAULT_ASSISTANT'
                ? 'Assistente Nativo'
                : 'Vito Voz'}
            </Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Orbe Central Animado */}
        <View style={styles.orbContainer}>
          <Animated.View
            style={[
              styles.orb,
              {
                backgroundColor: getOrbColor(),
                transform: [{ scale: pulseAnim }],
                shadowColor: getOrbColor(),
              },
            ]}
          />
          <Text style={[styles.stateLabel, { color: getOrbColor() }]}>
            {getStateLabel()}
          </Text>
        </View>

        {/* Transcrição / Resposta da IA */}
        <Text style={styles.transcript} numberOfLines={4}>
          {transcript}
        </Text>

        {/* Lista de tarefas concluídas */}
        {completedTasks.length > 0 && (
          <View style={styles.tasksContainer}>
            {completedTasks.map((t, idx) => (
              <View key={idx} style={styles.taskCard}>
                <Text style={styles.taskCheck}>✓</Text>
                <Text style={styles.taskText}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Rodapé com botão Concluir */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleClose}>
            <Text style={styles.actionBtnText}>Concluir</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#121214',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  badge: {
    backgroundColor: '#1C2026',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  badgeText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#27272A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#E4E4E7',
    fontSize: 12,
    fontWeight: '700',
  },
  orbContainer: {
    alignItems: 'center',
    marginVertical: 18,
  },
  orb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 18,
    elevation: 8,
  },
  stateLabel: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  transcript: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'center',
    minHeight: 48,
    marginBottom: 16,
  },
  tasksContainer: {
    marginBottom: 16,
    gap: 8,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  taskCheck: {
    color: '#10B981',
    fontWeight: '700',
    marginRight: 10,
  },
  taskText: {
    color: '#F4F4F5',
    fontSize: 13.5,
    fontWeight: '500',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  actionBtn: {
    backgroundColor: '#27272A',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
