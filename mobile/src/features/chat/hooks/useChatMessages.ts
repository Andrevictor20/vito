import { useState, useCallback, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatMessage, ConversationSession } from '../../../types';
import { api } from '../../../services/api';
import { isAbortError, truncateMessagesForEdit } from '../utils/chatActions';
import { humanizePreview } from '../utils/chatPreview';
import { toChatMeeting, toChatBooking, sanitizeErrorMessage } from '../utils/chatCards';
import type { ChatStorageKeys } from '../services/chatStorageService';
import { getChatStorageKeys } from '../services/chatStorageService';
import {
  buildAssistantMessage,
  notifyAssistantResult,
  handleAssistantSideEffects,
} from './chatMessageEffects';
import { formatHistoryForStream, runAssistantStreamTurn } from './chatStreamRunner';
import {
  buildUpdatedSessionList,
  createChatMessage,
  createStoppedChatMessage,
  resolveMediaErrorText,
} from './chatMessageHelpers';

export {
  toChatMeeting,
  toChatBooking,
  sanitizeErrorMessage,
  buildAssistantMessage,
  notifyAssistantResult,
  handleAssistantSideEffects,
  humanizePreview,
};

export interface UseChatMessagesOptions {
  keys?: ChatStorageKeys;
  activeSessionIdRef?: React.MutableRefObject<string>;
  onDataChanged?: () => void;
}

export interface UseChatMessagesResult {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  loading: boolean;
  streamingSteps: string[];
  saveMessages: (newMessages: ChatMessage[]) => void;
  sendMessage: (text: string, focusMode?: string) => Promise<void>;
  appendUserMessage: (text: string) => void;
  appendAssistantMessage: (text: string) => void;
  editAndResendMessage: (messageId: string, newText: string, focusMode?: string) => Promise<void>;
  stopGeneration: () => void;
  resolveConfirmation: (messageId: string, pendingId: string, reject: boolean) => Promise<void>;
  sendAudio: (audioUri: string, focusMode?: string) => Promise<void>;
  sendImage: (imageUri: string, prompt?: string, base64Override?: string, mimeType?: string) => Promise<void>;
  clearHistory: () => Promise<void>;
}

/**
 * A3: dono de messages/loading/abort/send/stop/retry. Recebe o
 * activeSessionId + setter de sessions para persistir preview/título via saveMessages.
 */
export function useChatMessages(
  activeSessionId: string,
  setSessions: React.Dispatch<React.SetStateAction<ConversationSession[]>>,
  options?: UseChatMessagesOptions,
): UseChatMessagesResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingSteps, setStreamingSteps] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isUserStoppedRef = useRef<boolean>(false);

  const onDataChanged = options?.onDataChanged;
  const keys = options?.keys ?? getChatStorageKeys();

  const internalRef = useRef<string>(activeSessionId);
  useEffect(() => {
    internalRef.current = activeSessionId;
    if (options?.activeSessionIdRef) {
      internalRef.current = options.activeSessionIdRef.current || activeSessionId;
    }
  }, [activeSessionId, options?.activeSessionIdRef]);
  const activeRef = options?.activeSessionIdRef ?? internalRef;

  const stopGeneration = useCallback(() => {
    isUserStoppedRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  }, []);

  const saveMessages = useCallback(
    (newMessages: ChatMessage[]) => {
      setMessages(newMessages);
      const currentId = activeRef.current || activeSessionId;

      setSessions((prevSessions) => {
        const finalList = buildUpdatedSessionList(prevSessions, currentId, newMessages);
        const sliced = newMessages.slice(-100);
        AsyncStorage.setItem(keys.sessionsKey, JSON.stringify(finalList)).catch(() => {});
        AsyncStorage.setItem(keys.chatKey, JSON.stringify(sliced)).catch(() => {});

        const activeTarget = finalList.find((s) => s.id === currentId);
        if (activeTarget) {
          api.syncChatSession(activeTarget, sliced).catch(() => {});
        }
        return finalList;
      });
    },
    [activeSessionId, keys.sessionsKey, keys.chatKey, setSessions],
  );

  const runManagedTurn = useCallback(
    async (
      baseMessages: ChatMessage[],
      runStream: (signal: AbortSignal) => ReturnType<typeof runAssistantStreamTurn>,
      warnLabel: string,
    ) => {
      setMessages(baseMessages);
      saveMessages(baseMessages);
      setLoading(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;
      isUserStoppedRef.current = false;
      setStreamingSteps([]);

      try {
        const { res, vitoMsg } = await runStream(controller.signal);
        const withVito = [...baseMessages, vitoMsg];
        setMessages(withVito);
        saveMessages(withVito);
        handleAssistantSideEffects(res, onDataChanged);
      } catch (err: unknown) {
        if (isUserStoppedRef.current && isAbortError(err)) {
          const withStopped = [...baseMessages, createStoppedChatMessage()];
          setMessages(withStopped);
          saveMessages(withStopped);
          return;
        }
        console.warn(warnLabel, err);
        const errorMsg = createChatMessage('err', 'vito', sanitizeErrorMessage(err));
        const withError = [...baseMessages, errorMsg];
        setMessages(withError);
        saveMessages(withError);
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        isUserStoppedRef.current = false;
        setStreamingSteps([]);
        setLoading(false);
      }
    },
    [onDataChanged, saveMessages],
  );

  const sendMessage = useCallback(
    async (text: string, focusMode?: string) => {
      if (!text.trim() || loading) return;
      const trimmed = text.trim();
      const withUser = [...messages, createChatMessage('user', 'user', trimmed)];
      await runManagedTurn(
        withUser,
        (signal) =>
          runAssistantStreamTurn({
            prompt: trimmed,
            baseMessages: withUser,
            historySource: messages,
            threadId: activeRef.current || activeSessionId,
            focusMode,
            signal,
            setMessages,
            setStreamingSteps,
          }),
        '[useChat] falha no assistente:',
      );
    },
    [messages, loading, activeSessionId, runManagedTurn],
  );

  const editAndResendMessage = useCallback(
    async (messageId: string, newText: string, focusMode?: string) => {
      if (!newText.trim() || loading) return;
      const targetIdx = messages.findIndex((m) => m.id === messageId);
      if (targetIdx === -1) return;

      const truncatedList = truncateMessagesForEdit(messages, messageId, newText);
      const historySlice = messages.slice(0, targetIdx);
      await runManagedTurn(
        truncatedList,
        (signal) =>
          runAssistantStreamTurn({
            prompt: newText.trim(),
            baseMessages: truncatedList,
            historySource: historySlice,
            threadId: activeRef.current || activeSessionId,
            focusMode,
            resetHistory: true,
            signal,
            setMessages,
            setStreamingSteps,
          }),
        '[useChat] falha na re-geração após edição:',
      );
    },
    [messages, loading, activeSessionId, runManagedTurn],
  );

  const sendAudio = useCallback(
    async (audioUri: string, focusMode?: string) => {
      if (loading) return;
      const userMsg = createChatMessage('user-audio', 'user', 'Mensagem de voz enviada');
      const withUser = [...messages, userMsg];
      setMessages(withUser);
      saveMessages(withUser);
      setLoading(true);

      try {
        const res = await api.assistantAudio(audioUri, 'audio.m4a', {
          thread_id: activeRef.current || activeSessionId,
          channel: 'app_mobile',
          history: formatHistoryForStream(messages),
          focus_mode: focusMode,
          include_tts: false,
        });
        const transcriptText = res.transcript ? `"${res.transcript}"` : 'Voz processada';
        const updatedUserMsg: ChatMessage = { ...userMsg, text: transcriptText };
        const vitoMsg = buildAssistantMessage('vito-audio', res, 'Instrução de voz processada.');
        const withVito = [...messages, updatedUserMsg, vitoMsg];
        setMessages(withVito);
        saveMessages(withVito);
        handleAssistantSideEffects(res, onDataChanged);
      } catch (err: unknown) {
        console.warn('[useChat] falha no assistente:', err);
        const fallbackText = resolveMediaErrorText(
          err,
          'Não consegui entender o áudio agora. Pode tentar de novo ou digitar o pedido?',
          'O processamento do áudio demorou mais do que o esperado ou houve instabilidade de rede. Verifique sua conexão e tente novamente.',
        );
        const withError = [...withUser, createChatMessage('err-audio', 'vito', fallbackText)];
        setMessages(withError);
        saveMessages(withError);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, activeSessionId, onDataChanged, saveMessages],
  );

  const sendImage = useCallback(
    async (imageUri: string, prompt?: string, base64Override?: string, mimeType?: string) => {
      if (loading) return;
      const userMsg = createChatMessage(
        'user-img',
        'user',
        prompt?.trim() || 'Imagem enviada para análise',
        { imageUri },
      );
      const withUser = [...messages, userMsg];
      setMessages(withUser);
      saveMessages(withUser);
      setLoading(true);

      try {
        const res = await api.assistantVision(
          imageUri,
          prompt,
          'image.jpg',
          undefined,
          base64Override,
          mimeType,
          activeRef.current || activeSessionId,
        );
        const vitoMsg = buildAssistantMessage('vito-img', res, 'Imagem analisada com sucesso.');
        const withVito = [...withUser, vitoMsg];
        setMessages(withVito);
        saveMessages(withVito);
        handleAssistantSideEffects(res, onDataChanged);
      } catch (err: unknown) {
        console.warn('[useChat] falha no assistente:', err);
        const fallbackText = resolveMediaErrorText(
          err,
          'Não consegui analisar a imagem agora. Pode tentar de novo em instantes?',
          'O envio da imagem demorou mais do que o esperado ou houve instabilidade de rede. Verifique sua conexão e tente novamente.',
        );
        const withError = [...withUser, createChatMessage('err-img', 'vito', fallbackText)];
        setMessages(withError);
        saveMessages(withError);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, onDataChanged, saveMessages],
  );

  const clearHistory = useCallback(async () => {
    setMessages([]);
    saveMessages([]);
  }, [saveMessages]);

  const appendUserMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const userMsg = createChatMessage('user-voice', 'user', trimmed);
      setMessages((prev) => {
        const nextList = [...prev, userMsg];
        saveMessages(nextList);
        return nextList;
      });
    },
    [saveMessages],
  );

  const appendAssistantMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const vitoMsg = createChatMessage('vito-init', 'vito', trimmed);
      setMessages((prev) => {
        const nextList = [...prev, vitoMsg];
        saveMessages(nextList);
        return nextList;
      });
    },
    [saveMessages],
  );

  const resolveConfirmation = useCallback(
    async (messageId: string, pendingId: string, reject: boolean) => {
      if (!pendingId) return;
      const res = await api.assistantConfirm(pendingId, {
        reject,
        threadId: activeRef.current || activeSessionId,
      });
      const vitoMsg = buildAssistantMessage(
        'vito-confirm',
        res,
        reject ? 'Ação cancelada.' : 'Ação concluída com sucesso.',
      );
      setMessages((prev) => {
        const updated = prev.map((m) =>
          m.id === messageId
            ? { ...m, confirmationStatus: (reject ? 'cancelled' : 'confirmed') as 'cancelled' | 'confirmed' }
            : m,
        );
        const nextList = [...updated, vitoMsg];
        saveMessages(nextList);
        return nextList;
      });
      handleAssistantSideEffects(res, onDataChanged);
    },
    [activeSessionId, onDataChanged, saveMessages],
  );

  return {
    messages,
    setMessages,
    loading,
    streamingSteps,
    saveMessages,
    sendMessage,
    appendUserMessage,
    appendAssistantMessage,
    editAndResendMessage,
    stopGeneration,
    resolveConfirmation,
    sendAudio,
    sendImage,
    clearHistory,
  };
}
