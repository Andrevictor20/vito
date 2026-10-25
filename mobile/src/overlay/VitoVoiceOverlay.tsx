import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  NativeModules,
  Animated,
  Easing,
  DeviceEventEmitter,
  BackHandler,
  Linking,
  ActivityIndicator,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import api from '../services/api';
import {
  ConversationState,
  calculateHarmonicBarHeights,
  getAuraColor,
  getStateLabel,
  extractWhatsAppCardData,
  isGoodbyeUtterance,
} from './voiceOverlayHelpers';
import { voiceOverlayStyles as styles } from './vitoVoiceOverlayStyles';
import type { ChatWhatsAppMessage } from '../types';

const { VitoDuplexAudioModule } = NativeModules;

export interface VitoVoiceOverlayProps {
  triggerSource?: 'WAKE_WORD' | 'DEFAULT_ASSISTANT' | 'MANUAL';
  screenContext?: string;
  onClose?: () => void;
  onMessageExchange?: (userText: string, aiReply: string) => void;
}

export function VitoVoiceOverlay({
  triggerSource = 'DEFAULT_ASSISTANT',
  onClose,
  onMessageExchange,
}: VitoVoiceOverlayProps) {
  const [state, setState] = useState<ConversationState>('LISTENING');
  const [transcript, setTranscript] = useState<string>('Estou ouvindo... O que deseja fazer?');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [whatsappCard, setWhatsappCard] = useState<ChatWhatsAppMessage | null>(null);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState<boolean>(false);
  const [whatsAppSent, setWhatsAppSent] = useState<boolean>(false);

  const slideAnim = useRef(new Animated.Value(80)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const phaseRef = useRef<number>(0);
  const [barHeights, setBarHeights] = useState<number[]>(
    [6, 8, 12, 16, 20, 24, 28, 24, 20, 16, 12, 8, 6]
  );

  const stateRef = useRef(state);
  stateRef.current = state;
  const audioLevelRef = useRef(audioLevel);
  audioLevelRef.current = audioLevel;
  const isClosingRef = useRef<boolean>(false);
  const conversationHistoryRef = useRef<{ role: string; content: string }[]>([]);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    try {
      if (VitoDuplexAudioModule?.stopRecording) {
        VitoDuplexAudioModule.stopRecording().catch(() => {});
      }
      if (VitoDuplexAudioModule?.releaseDuplexAudio) {
        VitoDuplexAudioModule.releaseDuplexAudio();
      }
    } catch {}

    if (onClose) {
      onClose();
    } else {
      BackHandler.exitApp();
    }
  }, [onClose]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      if (stateRef.current === 'LISTENING') {
        handleClose();
      }
    }, 15000);
  }, [handleClose]);

  const finishRecordingAndProcess = useCallback(async () => {
    if (stateRef.current !== 'LISTENING' || isClosingRef.current) return;
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
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
        resetInactivityTimer();
        if (VitoDuplexAudioModule?.startRecording) {
          await VitoDuplexAudioModule.startRecording();
        }
        return;
      }

      const res = await api.assistantAudio(wavPath, 'audio.wav');
      const userText = (res.transcript || '').trim();
      const replyText = (res.reply || res.message || 'Comando executado.').trim();

      onMessageExchange?.(userText || 'Áudio enviado', replyText);

      if (userText) {
        conversationHistoryRef.current.push({ role: 'user', content: userText });
      }
      conversationHistoryRef.current.push({ role: 'assistant', content: replyText });

      setState('SPEAKING');
      setTranscript(replyText);

      const card = extractWhatsAppCardData(res);
      if (card) {
        setWhatsappCard(card);
      }

      const isGoodbye = isGoodbyeUtterance(userText) || isGoodbyeUtterance(replyText);

      // TTS Neural (Edge-TTS) com fallback silencioso para speakText nativo.
      let ttsPlayed = false;
      try {
        const tts = await api.voiceTTS(replyText);
        if (tts.audio_b64 && VitoDuplexAudioModule?.playTtsAudio) {
          await VitoDuplexAudioModule.playTtsAudio(tts.audio_b64);
          ttsPlayed = true;
        }
      } catch {
        // silencioso: cai no speakText abaixo
      }
      if (!ttsPlayed && VitoDuplexAudioModule?.speakText) {
        try {
          await VitoDuplexAudioModule.speakText(replyText);
        } catch {}
      }

      if (isClosingRef.current) return;

      if (isGoodbye) {
        setTimeout(() => {
          handleClose();
        }, 1200);
      } else {
        setState('LISTENING');
        setTranscript('Ouvindo você...');
        resetInactivityTimer();
        if (VitoDuplexAudioModule?.startRecording) {
          await VitoDuplexAudioModule.startRecording();
        }
      }
    } catch (err: any) {
      if (isClosingRef.current) return;
      setState('SPEAKING');
      const errMsg = err?.message || 'Erro ao processar áudio com o assistente.';
      setTranscript(errMsg);
      if (VitoDuplexAudioModule?.speakText) {
        try {
          await VitoDuplexAudioModule.speakText(errMsg);
        } catch {}
      }
      setTimeout(async () => {
        if (!isClosingRef.current) {
          setState('LISTENING');
          setTranscript('Ouvindo você...');
          resetInactivityTimer();
          if (VitoDuplexAudioModule?.startRecording) {
            await VitoDuplexAudioModule.startRecording();
          }
        }
      }, 1500);
    }
  }, [handleClose, onMessageExchange, resetInactivityTimer]);

  const handleConfirmWhatsApp = useCallback(async () => {
    if (!whatsappCard || isSendingWhatsApp || whatsAppSent) return;
    setIsSendingWhatsApp(true);
    try {
      const phone = (whatsappCard.recipient_phone || '').replace(/\D/g, '');
      const msg = encodeURIComponent(whatsappCard.message || '');
      const url = phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
      await Linking.openURL(url);
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
    resetInactivityTimer();

    const levelSub = DeviceEventEmitter.addListener('onAudioLevel', (event: { level?: number }) => {
      if (typeof event?.level === 'number') {
        setAudioLevel(event.level);
      }
    });

    const speechEndSub = DeviceEventEmitter.addListener('onSpeechEnd', () => {
      if (stateRef.current === 'LISTENING') {
        finishRecordingAndProcess();
      }
    });

    const speechStartSub = DeviceEventEmitter.addListener('onSpeechStart', () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    });

    const interval = setInterval(() => {
      phaseRef.current += 0.12;
      const heights = calculateHarmonicBarHeights(
        audioLevelRef.current,
        stateRef.current,
        phaseRef.current,
        13,
        { minHeight: 4, maxHeight: 28 }
      );
      setBarHeights(heights);
    }, 45);

    return () => {
      clearInterval(interval);
      levelSub.remove();
      speechEndSub.remove();
      speechStartSub.remove();
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      try {
        if (VitoDuplexAudioModule?.releaseDuplexAudio) {
          VitoDuplexAudioModule.releaseDuplexAudio();
        }
      } catch {}
    };
  }, [slideAnim, fadeAnim, finishRecordingAndProcess, resetInactivityTimer]);

  const auraColor = getAuraColor(state);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleClose}
        accessibilityLabel="Fechar assistente"
      />

      <View pointerEvents="none" style={styles.vignetteWrapper}>
        <Svg width="100%" height={220} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="vitoVoiceVignette" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#0B0D13" stopOpacity="0" />
              <Stop offset="45%" stopColor="#0B0D13" stopOpacity="0.55" />
              <Stop offset="100%" stopColor="#0B0D13" stopOpacity="0.92" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height={220} fill="url(#vitoVoiceVignette)" />
        </Svg>
      </View>

      <Animated.View
        style={[
          styles.bottomSheet,
          {
            transform: [{ translateY: slideAnim }],
            opacity: fadeAnim,
          },
        ]}
      >
        {whatsappCard && (
          <View style={styles.whatsAppSatellite}>
            <View style={styles.whatsAppSatelliteLeft}>
              <Text style={styles.whatsAppSatelliteIcon}>💬</Text>
              <Text style={styles.whatsAppSatelliteText} numberOfLines={1}>
                {whatsappCard.recipient_name || whatsappCard.recipient_phone || 'Contato'}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.whatsAppSendBtn,
                (isSendingWhatsApp || whatsAppSent) && styles.whatsAppSendBtnDisabled,
              ]}
              onPress={handleConfirmWhatsApp}
              disabled={isSendingWhatsApp || whatsAppSent}
              activeOpacity={0.8}
            >
              {isSendingWhatsApp ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Text style={styles.whatsAppSendBtnText}>
                  {whatsAppSent ? 'Enviado ✓' : 'Enviar'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.transcriptChip}>
          <View style={styles.transcriptChipHeader}>
            <View style={[styles.statusDot, { backgroundColor: auraColor }]} />
            <Text style={[styles.stateLabel, { color: auraColor }]}>
              {getStateLabel(state)}
            </Text>
          </View>
          <Text style={styles.transcriptText} numberOfLines={3}>
            {transcript}
          </Text>
        </View>

        <View style={[styles.pill, { borderColor: state === 'LISTENING' ? '#2A2E35' : auraColor }]}>
          <View style={styles.pillLeft}>
            <View style={[styles.micIndicator, { backgroundColor: auraColor }]} />
            <Text style={styles.pillBadgeText}>
              {triggerSource === 'DEFAULT_ASSISTANT' ? 'Assistente' : 'Vito Voz'}
            </Text>
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

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Fechar assistente"
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}
