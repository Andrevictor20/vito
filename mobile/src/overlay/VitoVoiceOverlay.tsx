import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  NativeModules,
  Animated,
  Easing,
  DeviceEventEmitter,
  BackHandler,
  Linking,
} from 'react-native';
import { ThemeProvider } from '../context/ThemeContext';
import api from '../services/api';
import {
  ConversationState,
  OverlayActionCardData,
  calculateCompact5BarHeights,
  extractWhatsAppCardData,
  extractOverlayActionCard,
  splitReplyWordsForHighlight,
  isGoodbyeUtterance,
} from './voiceOverlayHelpers';
import { VoiceFullscreenView } from './VoiceFullscreenView';
import { VoiceCompactView } from './VoiceCompactView';
import type { ChatWhatsAppMessage } from '../types';
import type { ChatHistoryItem } from '../services/api/types';

const { VitoDuplexAudioModule, VitoAssistantModule } = NativeModules;

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
  screenContext: initialScreenContext,
  variant,
  onClose,
  onMessageExchange,
  onSwitchToText,
}: VitoVoiceOverlayProps) {
  const [state, setState] = useState<ConversationState>('LISTENING');
  const [transcript, setTranscript] = useState<string>('Estou ouvindo... O que deseja fazer?');
  const [userTranscript, setUserTranscript] = useState<string>('');
  const [replyText, setReplyText] = useState<string>('');
  const [highlightedWordCount, setHighlightedWordCount] = useState<number>(0);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [screenContext, setScreenContext] = useState<string>(initialScreenContext || '');
  const [screenContextVisible, setScreenContextVisible] = useState<boolean>(Boolean(initialScreenContext));
  const [actionCard, setActionCard] = useState<OverlayActionCardData | null>(null);
  const [whatsappCard, setWhatsappCard] = useState<ChatWhatsAppMessage | null>(null);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState<boolean>(false);
  const [whatsAppSent, setWhatsAppSent] = useState<boolean>(false);
  const [preferredVoice, setPreferredVoice] = useState<'puck' | 'kore'>('puck');
  const [barHeights5, setBarHeights5] = useState<number[]>([4, 8, 12, 8, 4]);

  const slideAnim = useRef(new Animated.Value(80)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const phaseRef = useRef<number>(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const audioLevelRef = useRef(audioLevel);
  audioLevelRef.current = audioLevel;
  const isClosingRef = useRef<boolean>(false);
  const conversationHistoryRef = useRef<ChatHistoryItem[]>([]);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wordTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isCompact = variant === 'compact' || (!variant && triggerSource !== 'MANUAL');

  useEffect(() => {
    api.init().catch(() => {});
    api.getAISettings().then((s) => {
      if (s?.preferred_voice) {
        const v = s.preferred_voice.toLowerCase();
        setPreferredVoice(v.includes('kore') || v.includes('female') || v.includes('feminino') ? 'kore' : 'puck');
      }
    }).catch(() => {});

    if (isCompact && VitoAssistantModule?.getOverlayLaunchParams) {
      VitoAssistantModule.getOverlayLaunchParams()
        .then((params: { screenContext?: string }) => {
          if (params?.screenContext) {
            setScreenContext(params.screenContext);
            setScreenContextVisible(true);
          }
        })
        .catch(() => {});
    }
  }, [isCompact]);

  const clearWordTimer = useCallback(() => {
    if (wordTimerRef.current) {
      clearInterval(wordTimerRef.current);
      wordTimerRef.current = null;
    }
  }, []);

  const startWordHighlightProgress = useCallback((text: string) => {
    clearWordTimer();
    const words = splitReplyWordsForHighlight(text);
    if (words.length === 0) {
      setHighlightedWordCount(0);
      return;
    }
    setHighlightedWordCount(1);
    let idx = 1;
    wordTimerRef.current = setInterval(() => {
      idx += 1;
      setHighlightedWordCount(idx);
      if (idx >= words.length) clearWordTimer();
    }, 135);
  }, [clearWordTimer]);

  const handleToggleVoice = useCallback(() => {
    setPreferredVoice((prev) => {
      const next = prev === 'puck' ? 'kore' : 'puck';
      api.updateAISettings({ preferred_voice: next }).catch(() => {});
      return next;
    });
  }, []);

  const handleClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    clearWordTimer();
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    try {
      VitoDuplexAudioModule?.stopRecording?.().catch(() => {});
      VitoDuplexAudioModule?.releaseDuplexAudio?.();
    } catch {}

    if (onClose) {
      onClose();
      return;
    }
    if (VitoAssistantModule?.closeOverlayActivity) {
      VitoAssistantModule.closeOverlayActivity()
        .then((closed: boolean) => { if (!closed) BackHandler.exitApp(); })
        .catch(() => BackHandler.exitApp());
    } else {
      BackHandler.exitApp();
    }
  }, [onClose, clearWordTimer]);

  const resetInactivityTimer = useCallback((nextState: ConversationState = 'LISTENING') => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      if (isClosingRef.current) return;
      if (isCompact && (stateRef.current === 'IDLE' || stateRef.current === 'LISTENING')) {
        VitoDuplexAudioModule?.stopRecording?.().catch(() => {});
        setState('MINI');
      } else if (!isCompact && stateRef.current === 'LISTENING') {
        handleClose();
      }
    }, nextState === 'IDLE' ? 11000 : 15000);
  }, [isCompact, handleClose]);

  const playNeuralVoiceReply = useCallback(async (textToSpeak: string, inlineAudioB64?: string) => {
    let played = false;
    if (inlineAudioB64 && VitoDuplexAudioModule?.playTtsAudio) {
      try {
        await VitoDuplexAudioModule.playTtsAudio(inlineAudioB64);
        played = true;
      } catch {
        played = false;
      }
    }
    if (!played) {
      try {
        const tts = await api.voiceTTS(textToSpeak, preferredVoice);
        if (tts?.audio_b64 && VitoDuplexAudioModule?.playTtsAudio) {
          await VitoDuplexAudioModule.playTtsAudio(tts.audio_b64);
          played = true;
        }
      } catch {
        played = false;
      }
    }
    return played;
  }, [preferredVoice]);

  const handleAssistantTurnResult = useCallback(
    async (userText: string, rawReply: string, resPayload: any) => {
      const cleanReply = (rawReply || 'Pronto.').trim();
      setUserTranscript(userText);
      setReplyText(cleanReply);
      setTranscript(cleanReply);
      onMessageExchange?.(userText || 'Áudio enviado', cleanReply);

      if (userText) conversationHistoryRef.current.push({ sender: 'user', text: userText });
      conversationHistoryRef.current.push({ sender: 'vito', text: cleanReply });

      setWhatsappCard(extractWhatsAppCardData(resPayload));
      setActionCard(extractOverlayActionCard(resPayload));

      setState('SPEAKING');
      startWordHighlightProgress(cleanReply);

      const isGoodbye = isGoodbyeUtterance(userText) || isGoodbyeUtterance(cleanReply);
      await playNeuralVoiceReply(cleanReply, resPayload?.tts_audio_b64);
      clearWordTimer();
      setHighlightedWordCount(splitReplyWordsForHighlight(cleanReply).length);

      if (isClosingRef.current) return;
      if (isGoodbye) {
        setTimeout(() => handleClose(), 900);
        return;
      }

      // Pequena drenagem acústica (120ms) para dissipar a reverberação do alto-falante viva-voz
      await new Promise((r) => setTimeout(r, 120));

      const nextListenState: ConversationState = isCompact ? 'IDLE' : 'LISTENING';
      setState(nextListenState);
      if (!isCompact) setTranscript('Ouvindo você...');
      resetInactivityTimer(nextListenState);
      if (!isMutedRef.current && VitoDuplexAudioModule?.startRecording) {
        await VitoDuplexAudioModule.startRecording().catch(() => {});
      }
    },
    [isCompact, onMessageExchange, startWordHighlightProgress, playNeuralVoiceReply, clearWordTimer, handleClose, resetInactivityTimer]
  );

  const finishRecordingAndProcess = useCallback(async () => {
    if ((stateRef.current !== 'LISTENING' && stateRef.current !== 'IDLE') || isClosingRef.current || isMutedRef.current) {
      return;
    }
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    setState('THINKING');
    setTranscript('Pensando...');

    try {
      const wavPath = (await VitoDuplexAudioModule?.stopRecording?.()) || '';
      if (!wavPath) {
        setState('LISTENING');
        resetInactivityTimer('LISTENING');
        VitoDuplexAudioModule?.startRecording?.().catch(() => {});
        return;
      }

      const res = await api.assistantAudio(wavPath, 'audio.wav', {
        history: conversationHistoryRef.current,
        screen_context: screenContextVisible ? screenContext : undefined,
        voice: preferredVoice,
        include_tts: true,
      });

      const spokenUser = (res.transcript || '').trim();
      const spokenReply = (res.reply || res.message || 'Comando executado.').trim();
      await handleAssistantTurnResult(spokenUser, spokenReply, res);
    } catch (err: any) {
      if (isClosingRef.current) return;
      const errMsg = err?.message || 'Não consegui processar o áudio agora. Pode repetir?';
      setReplyText(errMsg);
      setTranscript(errMsg);
      setState('SPEAKING');
      startWordHighlightProgress(errMsg);
      await playNeuralVoiceReply(errMsg);
      clearWordTimer();
      setHighlightedWordCount(splitReplyWordsForHighlight(errMsg).length);

      if (!isClosingRef.current) {
        await new Promise((r) => setTimeout(r, 120));
        setState('LISTENING');
        resetInactivityTimer('LISTENING');
        if (!isMutedRef.current) VitoDuplexAudioModule?.startRecording?.().catch(() => {});
      }
    }
  }, [screenContext, screenContextVisible, preferredVoice, handleAssistantTurnResult, startWordHighlightProgress, playNeuralVoiceReply, clearWordTimer, resetInactivityTimer]);

  const handleSelectSuggestion = useCallback(async (promptText: string) => {
    if (isClosingRef.current) return;
    VitoDuplexAudioModule?.stopRecording?.().catch(() => {});
    VitoDuplexAudioModule?.stopSpeaking?.();
    setUserTranscript(promptText);
    setState('THINKING');
    setTranscript(promptText);
    try {
      const res = await api.assistantChat(promptText, { history: conversationHistoryRef.current });
      await handleAssistantTurnResult(promptText, (res.reply || res.message || 'Pronto.').trim(), res);
    } catch (err: any) {
      const errMsg = err?.message || 'Não consegui responder agora.';
      setReplyText(errMsg);
      setTranscript(errMsg);
      setState('IDLE');
    }
  }, [handleAssistantTurnResult]);

  const handleTapOrb = useCallback(() => {
    if (stateRef.current === 'SPEAKING') {
      clearWordTimer();
      VitoDuplexAudioModule?.stopSpeaking?.();
      setState('LISTENING');
      setUserTranscript('');
      setTranscript('Ouvindo você...');
      if (!isMutedRef.current) VitoDuplexAudioModule?.startRecording?.().catch(() => {});
      resetInactivityTimer('LISTENING');
      return;
    }
    if (stateRef.current === 'IDLE' || stateRef.current === 'MINI') {
      setState('LISTENING');
      setUserTranscript('');
      if (!isMutedRef.current) VitoDuplexAudioModule?.startRecording?.().catch(() => {});
      resetInactivityTimer('LISTENING');
    }
  }, [clearWordTimer, resetInactivityTimer]);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;
      if (next) {
        VitoDuplexAudioModule?.stopRecording?.().catch(() => {});
        VitoDuplexAudioModule?.stopSpeaking?.();
      } else {
        setState('LISTENING');
        VitoDuplexAudioModule?.startRecording?.().catch(() => {});
      }
      return next;
    });
  }, []);

  const handleOpenInVito = useCallback(() => {
    if (VitoAssistantModule?.openMainApp) {
      VitoAssistantModule.openMainApp().catch(() => {});
    } else {
      handleClose();
    }
  }, [handleClose]);

  const handleUndoAction = useCallback(() => {
    setActionCard(null);
    setWhatsappCard(null);
    setReplyText('Ação desfeita.');
    setHighlightedWordCount(2);
  }, []);

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
      Animated.timing(slideAnim, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();

    VitoDuplexAudioModule?.startRecording?.().catch(() => {});
    resetInactivityTimer('LISTENING');

    const durationInterval = setInterval(() => setDurationSeconds((d) => d + 1), 1000);
    const levelSub = DeviceEventEmitter.addListener('onAudioLevel', (event: { level?: number }) => {
      if (typeof event?.level === 'number') setAudioLevel(event.level);
    });
    const speechEndSub = DeviceEventEmitter.addListener('onSpeechEnd', () => {
      if (stateRef.current === 'LISTENING' || stateRef.current === 'IDLE') finishRecordingAndProcess();
    });
    const speechStartSub = DeviceEventEmitter.addListener('onSpeechStart', () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (stateRef.current === 'IDLE') setState('LISTENING');
    });
    const newIntentSub = DeviceEventEmitter.addListener('onVitoOverlayNewIntent', (payload: { screenContext?: string }) => {
      isClosingRef.current = false;
      if (payload?.screenContext !== undefined) {
        setScreenContext(payload.screenContext);
        setScreenContextVisible(Boolean(payload.screenContext));
      }
      setState('LISTENING');
      if (!isMutedRef.current) VitoDuplexAudioModule?.startRecording?.().catch(() => {});
      resetInactivityTimer('LISTENING');
    });
    const waveInterval = setInterval(() => {
      phaseRef.current += 0.14;
      setBarHeights5(calculateCompact5BarHeights(audioLevelRef.current, stateRef.current, isMutedRef.current, phaseRef.current));
    }, 50);

    return () => {
      clearInterval(durationInterval);
      clearInterval(waveInterval);
      clearWordTimer();
      levelSub.remove();
      speechEndSub.remove();
      speechStartSub.remove();
      newIntentSub.remove();
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      VitoDuplexAudioModule?.releaseDuplexAudio?.();
    };
  }, [slideAnim, fadeAnim, finishRecordingAndProcess, resetInactivityTimer, clearWordTimer]);

  if (isCompact) {
    return (
      <VoiceCompactView
        state={state}
        transcript={transcript}
        userTranscript={userTranscript}
        replyText={replyText}
        highlightedWordCount={highlightedWordCount}
        barHeights5={barHeights5}
        isMuted={isMuted}
        screenContextLabel="Vendo esta tela"
        screenContextVisible={screenContextVisible && Boolean(screenContext)}
        actionCard={actionCard}
        slideAnim={slideAnim}
        fadeAnim={fadeAnim}
        onClose={handleClose}
        onToggleMute={handleToggleMute}
        onTapAvatar={handleTapOrb}
        onDismissScreenContext={() => setScreenContextVisible(false)}
        onSelectSuggestion={handleSelectSuggestion}
        onOpenInVito={handleOpenInVito}
        onUndoAction={handleUndoAction}
        onExpandFromMini={handleTapOrb}
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
      onSwitchToText={() => { handleClose(); onSwitchToText?.(); }}
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

export function VitoVoiceOverlayRoot(props: VitoVoiceOverlayProps) {
  return (
    <ThemeProvider>
      <VitoVoiceOverlay {...props} />
    </ThemeProvider>
  );
}
