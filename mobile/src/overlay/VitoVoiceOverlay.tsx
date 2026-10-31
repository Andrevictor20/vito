import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
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
  extractWhatsAppCardData,
  isGoodbyeUtterance,
} from './voiceOverlayHelpers';
import { VoiceFullscreenView } from './VoiceFullscreenView';
import { VoiceCompactView } from './VoiceCompactView';
import type { ChatWhatsAppMessage } from '../types';
import type { ChatHistoryItem } from '../services/api/types';

const { VitoDuplexAudioModule } = NativeModules;

export interface VitoVoiceOverlayProps {
  triggerSource?: 'WAKE_WORD' | 'DEFAULT_ASSISTANT' | 'MANUAL';
  screenContext?: string;
  variant?: 'fullscreen' | 'compact';
  onClose?: () => void;
  onMessageExchange?: (userText: string, aiReply: string) => void;
  onSwitchToText?: () => void;
}

export function VitoVoiceOverlay({
  triggerSource = 'DEFAULT_ASSISTANT',
  screenContext,
  variant,
  onClose,
  onMessageExchange,
  onSwitchToText,
}: VitoVoiceOverlayProps) {
  const [state, setState] = useState<ConversationState>('LISTENING');
  const [transcript, setTranscript] = useState<string>('Estou ouvindo... O que deseja fazer?');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [whatsappCard, setWhatsappCard] = useState<ChatWhatsAppMessage | null>(null);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState<boolean>(false);
  const [whatsAppSent, setWhatsAppSent] = useState<boolean>(false);
  const [preferredVoice, setPreferredVoice] = useState<'puck' | 'kore'>('puck');

  useEffect(() => {
    api.getAISettings().then((s) => {
      if (s?.preferred_voice) {
        const v = s.preferred_voice.toLowerCase();
        if (v.includes('kore') || v.includes('female') || v.includes('feminino')) {
          setPreferredVoice('kore');
        } else {
          setPreferredVoice('puck');
        }
      }
    }).catch(() => {});
  }, []);

  const handleToggleVoice = useCallback(() => {
    setPreferredVoice((prev) => {
      const next = prev === 'puck' ? 'kore' : 'puck';
      api.updateAISettings({ preferred_voice: next } as any).catch(() => {});
      return next;
    });
  }, []);

  // Animações de entrada para o modo compacto
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
  const conversationHistoryRef = useRef<ChatHistoryItem[]>([]);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Determina se deve renderizar o modo compacto (fora do app) ou fullscreen (dentro do app)
  const isCompact = variant === 'compact' || (!variant && triggerSource !== 'MANUAL');

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

  const handleSwitchToText = useCallback(() => {
    handleClose();
    onSwitchToText?.();
  }, [handleClose, onSwitchToText]);

  const handleTapOrb = useCallback(() => {
    if (stateRef.current === 'SPEAKING') {
      try {
        if (VitoDuplexAudioModule?.releaseDuplexAudio) {
          VitoDuplexAudioModule.releaseDuplexAudio();
        }
      } catch {}
      setState('LISTENING');
      setTranscript('Ouvindo você...');
      if (VitoDuplexAudioModule?.startRecording) {
        VitoDuplexAudioModule.startRecording().catch(() => {});
      }
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) {
        try {
          if (VitoDuplexAudioModule?.stopRecording) {
            VitoDuplexAudioModule.stopRecording().catch(() => {});
          }
        } catch {}
      } else {
        try {
          if (VitoDuplexAudioModule?.startRecording) {
            VitoDuplexAudioModule.startRecording().catch(() => {});
          }
        } catch {}
      }
      return next;
    });
  }, []);

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
    if (stateRef.current !== 'LISTENING' || isClosingRef.current || isMuted) return;
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

      const res = await api.assistantAudio(wavPath, 'audio.wav', {
        history: conversationHistoryRef.current,
      });
      const userText = (res.transcript || '').trim();
      const replyText = (res.reply || res.message || 'Comando executado.').trim();

      onMessageExchange?.(userText || 'Áudio enviado', replyText);

      if (userText) {
        conversationHistoryRef.current.push({ sender: 'user', text: userText });
      }
      conversationHistoryRef.current.push({ sender: 'vito', text: replyText });

      setState('SPEAKING');
      setTranscript(replyText);

      const card = extractWhatsAppCardData(res);
      if (card) {
        setWhatsappCard(card);
      }

      const isGoodbye = isGoodbyeUtterance(userText) || isGoodbyeUtterance(replyText);

      // TTS Neural (Gemini Live) com fallback silencioso para speakText nativo
      let ttsPlayed = false;
      try {
        const tts = await api.voiceTTS(replyText, preferredVoice);
        if (tts.audio_b64 && VitoDuplexAudioModule?.playTtsAudio) {
          await VitoDuplexAudioModule.playTtsAudio(tts.audio_b64);
          ttsPlayed = true;
        }
      } catch {
        // Silencioso
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
  }, [handleClose, onMessageExchange, resetInactivityTimer, isMuted]);

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

    // Cronômetro da sessão a cada 1 segundo
    const durationInterval = setInterval(() => {
      setDurationSeconds((d) => d + 1);
    }, 1000);

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

    const waveInterval = setInterval(() => {
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
      clearInterval(durationInterval);
      clearInterval(waveInterval);
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

  if (isCompact) {
    return (
      <VoiceCompactView
        state={state}
        transcript={transcript}
        barHeights={barHeights}
        durationSeconds={durationSeconds}
        triggerSource={triggerSource}
        slideAnim={slideAnim}
        fadeAnim={fadeAnim}
        onClose={handleClose}
        whatsappCard={whatsappCard}
        isSendingWhatsApp={isSendingWhatsApp}
        whatsAppSent={whatsAppSent}
        onConfirmWhatsApp={handleConfirmWhatsApp}
      />
    );
  }

  return (
    <VoiceFullscreenView
      state={state}
      transcript={transcript}
      audioLevel={audioLevel}
      durationSeconds={durationSeconds}
      isMuted={isMuted}
      onToggleMute={handleToggleMute}
      onClose={handleClose}
      onSwitchToText={handleSwitchToText}
      onTapOrb={handleTapOrb}
      whatsappCard={whatsappCard}
      isSendingWhatsApp={isSendingWhatsApp}
      whatsAppSent={whatsAppSent}
      onConfirmWhatsApp={handleConfirmWhatsApp}
      screenContext={screenContext}
      voice={preferredVoice}
      onToggleVoice={handleToggleVoice}
    />
  );
}
