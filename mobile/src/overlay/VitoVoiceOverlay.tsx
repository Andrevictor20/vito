import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  NativeModules,
  Animated,
  Easing,
  DeviceEventEmitter,
  BackHandler,
  Linking,
} from 'react-native';
import api from '../services/api';
import {
  ConversationState,
  calculateHarmonicBarHeights,
  getAuraColor,
  getStateLabel,
  extractWhatsAppCardData,
} from './voiceOverlayHelpers';
import { WhatsAppInlineCard } from './WhatsAppInlineCard';
import type { ChatWhatsAppMessage } from '../types';

const { VitoDuplexAudioModule } = NativeModules;

export interface VitoVoiceOverlayProps {
  triggerSource?: 'WAKE_WORD' | 'DEFAULT_ASSISTANT' | 'MANUAL';
  screenContext?: string;
}

export function VitoVoiceOverlay({
  triggerSource = 'DEFAULT_ASSISTANT',
}: VitoVoiceOverlayProps) {
  const [state, setState] = useState<ConversationState>('LISTENING');
  const [transcript, setTranscript] = useState<string>('Estou ouvindo... O que deseja fazer?');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [whatsappCard, setWhatsappCard] = useState<ChatWhatsAppMessage | null>(null);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState<boolean>(false);
  const [whatsAppSent, setWhatsAppSent] = useState<boolean>(false);

  const slideAnim = useRef(new Animated.Value(100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const phaseRef = useRef<number>(0);
  const [barHeights, setBarHeights] = useState<number[]>([12, 18, 26, 18, 12]);

  const stateRef = useRef(state);
  stateRef.current = state;
  const audioLevelRef = useRef(audioLevel);
  audioLevelRef.current = audioLevel;

  const handleClose = useCallback(() => {
    try {
      if (VitoDuplexAudioModule?.releaseDuplexAudio) {
        VitoDuplexAudioModule.releaseDuplexAudio();
      }
    } catch {}
    BackHandler.exitApp();
  }, []);

  const finishRecordingAndProcess = useCallback(async () => {
    if (stateRef.current !== 'LISTENING') return;
    setState('THINKING');
    setTranscript('Pensando...');

    try {
      let wavPath = '';
      if (VitoDuplexAudioModule?.stopRecording) {
        wavPath = await VitoDuplexAudioModule.stopRecording();
      }

      if (!wavPath) {
        setTranscript('Não consegui captar o áudio. Tente novamente.');
        setState('LISTENING');
        return;
      }

      const res = await api.assistantAudio(wavPath, 'audio.wav');
      const replyText = (res.reply || res.message || 'Comando executado.').trim();

      setState('SPEAKING');
      setTranscript(replyText);

      const card = extractWhatsAppCardData(res);
      if (card) {
        setWhatsappCard(card);
      }

      if (VitoDuplexAudioModule?.speakText) {
        VitoDuplexAudioModule.speakText(replyText).catch(() => {});
      }
    } catch (err: any) {
      setState('SPEAKING');
      setTranscript(err?.message || 'Erro ao processar áudio com o assistente.');
    }
  }, []);

  const handleConfirmWhatsApp = useCallback(async () => {
    if (!whatsappCard || isSendingWhatsApp || whatsAppSent) return;
    setIsSendingWhatsApp(true);
    try {
      const phone = (whatsappCard.recipient_phone || '').replace(/\D/g, '');
      const msg = encodeURIComponent(whatsappCard.message || '');
      if (phone) {
        await Linking.openURL(`https://wa.me/${phone}?text=${msg}`);
      } else {
        await Linking.openURL(`https://wa.me/?text=${msg}`);
      }
      setWhatsAppSent(true);
      setTimeout(() => handleClose(), 1800);
    } catch {
      setIsSendingWhatsApp(false);
    }
  }, [whatsappCard, isSendingWhatsApp, whatsAppSent, handleClose]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();

    if (VitoDuplexAudioModule?.startRecording) {
      VitoDuplexAudioModule.startRecording().catch(() => {});
    }

    const sub = DeviceEventEmitter.addListener('onAudioLevel', (event: { level?: number }) => {
      if (typeof event?.level === 'number') {
        setAudioLevel(event.level);
      }
    });

    const interval = setInterval(() => {
      phaseRef.current += 0.12;
      const heights = calculateHarmonicBarHeights(
        audioLevelRef.current,
        stateRef.current,
        phaseRef.current
      );
      setBarHeights(heights);
    }, 45);

    return () => {
      clearInterval(interval);
      sub.remove();
      try {
        if (VitoDuplexAudioModule?.releaseDuplexAudio) {
          VitoDuplexAudioModule.releaseDuplexAudio();
        }
      } catch {}
    };
  }, [slideAnim, fadeAnim]);

  const auraColor = getAuraColor(state);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleClose}
      />

      <Animated.View
        style={[
          styles.capsule,
          {
            borderColor: state === 'LISTENING' ? '#2A2E35' : auraColor,
            transform: [{ translateY: slideAnim }],
            opacity: fadeAnim,
          },
        ]}
      >
        <View style={[styles.glowLine, { backgroundColor: auraColor }]} />

        <View style={styles.header}>
          <View style={styles.badge}>
            <View style={[styles.statusDot, { backgroundColor: auraColor }]} />
            <Text style={styles.badgeText}>
              {triggerSource === 'DEFAULT_ASSISTANT' ? 'Vito Assistente' : 'Vito Voz'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.waveformContainer}>
          {barHeights.map((h, i) => (
            <View
              key={i}
              style={[
                styles.waveformBar,
                {
                  height: h,
                  backgroundColor: auraColor,
                },
              ]}
            />
          ))}
        </View>

        <Text style={[styles.stateLabel, { color: auraColor }]}>
          {getStateLabel(state)}
        </Text>

        <Text style={styles.transcript} numberOfLines={3}>
          {transcript}
        </Text>

        {whatsappCard && (
          <WhatsAppInlineCard
            card={whatsappCard}
            isSending={isSendingWhatsApp}
            sent={whatsAppSent}
            onConfirm={handleConfirmWhatsApp}
          />
        )}

        <View style={styles.footer}>
          {state === 'LISTENING' ? (
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: auraColor }]}
              onPress={finishRecordingAndProcess}
            >
              <View style={[styles.micIndicator, { backgroundColor: auraColor }]} />
              <Text style={styles.actionBtnText}>Pronto</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.dismissBtn} onPress={handleClose}>
              <Text style={styles.dismissBtnText}>Concluir</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  capsule: {
    backgroundColor: '#16161A',
    marginHorizontal: 14,
    marginBottom: 20,
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    borderWidth: 1.2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 12,
  },
  glowLine: {
    position: 'absolute',
    top: 0,
    left: 48,
    right: 48,
    height: 2.5,
    borderRadius: 2,
    opacity: 0.85,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2024',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  badgeText: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#24262B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    marginVertical: 4,
  },
  waveformBar: {
    width: 4.5,
    marginHorizontal: 3.5,
    borderRadius: 3,
  },
  stateLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  transcript: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  footer: {
    alignItems: 'center',
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22252B',
    paddingHorizontal: 22,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  micIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
  },
  dismissBtn: {
    backgroundColor: '#24262B',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 18,
  },
  dismissBtnText: {
    color: '#D4D4D8',
    fontSize: 13,
    fontWeight: '600',
  },
});
