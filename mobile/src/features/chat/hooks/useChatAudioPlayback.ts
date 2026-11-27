import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, NativeModules } from 'react-native';
import { api } from '../../../services/api';
import { preparePlainTextForCopy } from '../utils/chatActions';

const { VitoDuplexAudioModule } = NativeModules;

let ExpoAudioMod: {
  createAudioPlayer?: (source: string | { uri: string }) => {
    play: () => void;
    pause: () => void;
    remove: () => void;
    addListener?: (ev: string, cb: (status: { didJustFinish?: boolean }) => void) => { remove?: () => void };
  };
} | null = null;
try {
  ExpoAudioMod = require('expo-audio');
} catch {
  ExpoAudioMod = null;
}

export function useChatAudioPlayback() {
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const playerRef = useRef<{ remove: () => void } | null>(null);
  const subRef = useRef<{ remove?: () => void } | null>(null);

  const stopPlayback = useCallback(() => {
    subRef.current?.remove?.();
    subRef.current = null;
    try {
      playerRef.current?.remove();
    } catch {}
    playerRef.current = null;
    try {
      VitoDuplexAudioModule?.stopSpeaking?.();
    } catch {}
    setPlayingMessageId(null);
  }, []);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const togglePlayAudio = useCallback(
    async (messageId: string, rawText: string) => {
      if (playingMessageId === messageId) {
        stopPlayback();
        return;
      }
      stopPlayback();
      const speechText = preparePlainTextForCopy(rawText);
      if (!speechText) return;

      setPlayingMessageId(messageId);
      try {
        const res = await api.voiceTTS(speechText);
        if (!res?.audio_b64) {
          setPlayingMessageId(null);
          return;
        }
        if (VitoDuplexAudioModule?.playTtsAudio) {
          await VitoDuplexAudioModule.playTtsAudio(res.audio_b64);
          setPlayingMessageId((cur) => (cur === messageId ? null : cur));
          return;
        }
        if (ExpoAudioMod?.createAudioPlayer) {
          const mime = res.mime || 'audio/mp3';
          const player = ExpoAudioMod.createAudioPlayer({ uri: `data:${mime};base64,${res.audio_b64}` });
          playerRef.current = player;
          if (player.addListener) {
            subRef.current = player.addListener('playbackStatusUpdate', (s) => {
              if (s?.didJustFinish) {
                setPlayingMessageId((cur) => (cur === messageId ? null : cur));
              }
            });
          }
          player.play();
          return;
        }
        setPlayingMessageId(null);
        Alert.alert('Áudio', 'Reprodução de voz indisponível neste ambiente.');
      } catch {
        setPlayingMessageId(null);
        Alert.alert('Áudio', 'Não foi possível gerar o áudio desta resposta agora.');
      }
    },
    [playingMessageId, stopPlayback],
  );

  return { playingMessageId, togglePlayAudio, stopPlayback };
}
