import { useState, useCallback, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AssistantChatResponse, ChatBooking, ChatMeeting, ChatMessage, ConversationSession } from '../types';
import { api } from '../services/api';
import { notificationService } from '../services/notificationService';
import { dataSync } from '../services/dataSync';
import { isAbortError, truncateMessagesForEdit } from '../utils/chatActions';
import { humanizePreview, semanticTitle } from '../utils/chatPreview';
import { toChatMeeting, toChatBooking, sanitizeErrorMessage } from '../utils/chatCards';
import type { ChatStorageKeys } from '../services/chatStorageService';
import { getChatStorageKeys } from '../services/chatStorageService';

export { toChatMeeting, toChatBooking, sanitizeErrorMessage };

const buildAssistantMessage = (idPrefix: string, res: AssistantChatResponse, defaultReply: string): ChatMessage => ({
  id: `${idPrefix}-${Date.now()}`,
  sender: 'vito',
  text: res.reply || res.message || defaultReply,
  timestamp: new Date().toISOString(),
  action_performed: res.action_performed,
  event: res.event,
  todo: res.todo,
  trigger: res.trigger,
  pending: res.pending,
  booking: toChatBooking(res),
  meeting: toChatMeeting(res),
  conflict: res.conflict,
  pending_confirmation: res.pending_confirmation,
});

export const notifyAssistantResult = (res: AssistantChatResponse) => {
  const action = res.action_performed?.toLowerCase() || '';
  if (res.event || action.includes('event')) {
    dataSync.notify('refresh_events');
  }
  if (res.todo || action.includes('todo')) {
    dataSync.notify('refresh_todos');
  }
  if (res.trigger || action.includes('trigger')) {
    dataSync.notify('refresh_triggers');
  }
  if (res.booking || action.includes('booking')) {
    dataSync.notify('refresh_bookings');
  }
  if (res.pending || action.includes('pending')) {
    dataSync.notify('refresh_pending');
  }
  dataSync.notify('refresh_all');
};

export { humanizePreview };

export interface UseChatMessagesOptions {
  keys?: ChatStorageKeys;
  activeSessionIdRef?: React.MutableRefObject<string>;
  onDataChanged?: () => void;
}

export interface UseChatMessagesResult {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  loading: boolean;
  saveMessages: (newMessages: ChatMessage[]) => void;
  sendMessage: (text: string) => Promise<void>;
  editAndResendMessage: (messageId: string, newText: string) => Promise<void>;
  stopGeneration: () => void;
  sendAudio: (audioUri: string) => Promise<void>;
  sendImage: (imageUri: string, prompt?: string, base64Override?: string) => Promise<void>;
  clearHistory: () => Promise<void>;
}

/**
 * A3: dono de messages/loading/abort/send/stop/retry. Recebe o
 * activeSessionId + setter de sessions para persistir preview/título
 * via saveMessages.
 */
export function useChatMessages(
  activeSessionId: string,
  setSessions: React.Dispatch<React.SetStateAction<ConversationSession[]>>,
  options?: UseChatMessagesOptions
): UseChatMessagesResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isUserStoppedRef = useRef<boolean>(false);

  const onDataChanged = options?.onDataChanged;
  const keys = options?.keys ?? getChatStorageKeys();

  // Ref interno espelha o activeSessionId (prop) para leitura síncrona em saveMessages;
  // se a fachada passar o ref das sessões, usa-o como fonte única.
  const internalRef = useRef<string>(activeSessionId);
  useEffect(() => {
    internalRef.current = activeSessionId;
    if (options?.activeSessionIdRef) {
      // Mantém o ref externo como fonte de verdade quando presente.
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
        const firstUser = newMessages.find((m) => m.sender === 'user');
        const latestMsg = newMessages[newMessages.length - 1];
        const previewText = humanizePreview(latestMsg?.text);
        const freshTitle = semanticTitle(firstUser?.text);

        let targetFound = false;
        const updated = prevSessions.map((s) => {
          if (s.id === currentId) {
            targetFound = true;
            let title = s.title;
            if ((title === 'Conversa Atual' || title === 'Nova Conversa') && firstUser) {
              title = freshTitle;
            }
            return {
              ...s,
              title,
              preview: previewText,
              timestamp: new Date().toISOString(),
              messages: newMessages.slice(-100),
            };
          }
          return s;
        });

        const finalList = targetFound
          ? updated
          : [
              {
                id: currentId || `conv-${Date.now()}`,
                title: firstUser ? freshTitle : 'Conversa Atual',
                preview: previewText,
                timestamp: new Date().toISOString(),
                messages: newMessages.slice(-100),
              },
              ...updated,
            ];

        AsyncStorage.setItem(keys.sessionsKey, JSON.stringify(finalList)).catch(() => {});
        AsyncStorage.setItem(keys.chatKey, JSON.stringify(newMessages.slice(-100))).catch(() => {});

        const activeTarget = finalList.find((s) => s.id === currentId);
        if (activeTarget) {
          api.syncChatSession(activeTarget, newMessages.slice(-100)).catch(() => {});
        }
        return finalList;
      });
    },
    [activeSessionId, keys.sessionsKey, keys.chatKey, setSessions]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: text.trim(),
        timestamp: new Date().toISOString(),
      };

      const withUser = [...messages, userMsg];
      setMessages(withUser);
      saveMessages(withUser);
      setLoading(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;
      isUserStoppedRef.current = false;

      try {
        const recentHistory = messages.slice(-6).map((m) => ({
          sender: m.sender === 'user' ? ('user' as const) : ('vito' as const),
          text: m.text,
        }));
        const res = await api.assistantChat(text.trim(), {
          history: recentHistory,
          signal: controller.signal,
        });
        const vitoMsg = buildAssistantMessage('vito', res, 'Instrução processada com sucesso.');

        const withVito = [...withUser, vitoMsg];
        setMessages(withVito);
        saveMessages(withVito);

        // Agenda lembretes locais imediatamente para itens criados/atualizados pela IA
        if (res.event) {
          notificationService.scheduleEventDualReminders(res.event).catch(() => {});
        }
        if (res.todo) {
          notificationService.scheduleTodoReminder(res.todo).catch(() => {});
        }
        if (res.pending) {
          notificationService.schedulePendingReminder(res.pending).catch(() => {});
          dataSync.notify('refresh_pending');
        }
        if (res.action_performed === 'delete_event' && res.event?.id) {
          notificationService.cancelEventReminder(res.event.id).catch(() => {});
        }
        if (res.action_performed === 'delete_todo' && res.todo?.id) {
          notificationService.cancelTodoReminder(res.todo.id).catch(() => {});
        }

        // Sincroniza e notifica telas imediatamente (Agenda, Radares, Tarefas, etc.)
        notifyAssistantResult(res);
        onDataChanged?.();
      } catch (err: unknown) {
        if (isUserStoppedRef.current && isAbortError(err)) {
          // Geração intencionalmente cancelada pelo usuário
          const stoppedMsg: ChatMessage = {
            id: `stop-${Date.now()}`,
            sender: 'vito',
            text: '⏹️ *(Geração interrompida)*',
            timestamp: new Date().toISOString(),
          };
          const withStopped = [...withUser, stoppedMsg];
          setMessages(withStopped);
          saveMessages(withStopped);
          return;
        }

        console.warn('[useChat] falha no assistente:', err);
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          sender: 'vito',
          text: sanitizeErrorMessage(err),
          timestamp: new Date().toISOString(),
        };
        const withError = [...withUser, errorMsg];
        setMessages(withError);
        saveMessages(withError);
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        isUserStoppedRef.current = false;
        setLoading(false);
      }
    },
    [messages, loading, onDataChanged, saveMessages]
  );

  const editAndResendMessage = useCallback(
    async (messageId: string, newText: string) => {
      if (!newText.trim() || loading) return;

      const targetIdx = messages.findIndex((m) => m.id === messageId);
      if (targetIdx === -1) return;

      const truncatedList = truncateMessagesForEdit(messages, messageId, newText);
      setMessages(truncatedList);
      saveMessages(truncatedList);
      setLoading(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;
      isUserStoppedRef.current = false;

      try {
        const previousSlice = messages.slice(0, targetIdx);
        const recentHistory = previousSlice.slice(-6).map((m) => ({
          sender: m.sender === 'user' ? ('user' as const) : ('vito' as const),
          text: m.text,
        }));

        const res = await api.assistantChat(newText.trim(), {
          history: recentHistory,
          signal: controller.signal,
        });

        const vitoMsg = buildAssistantMessage('vito', res, 'Instrução processada com sucesso.');

        const withVito = [...truncatedList, vitoMsg];
        setMessages(withVito);
        saveMessages(withVito);

        if (res.event) {
          notificationService.scheduleEventDualReminders(res.event).catch(() => {});
        }
        if (res.todo) {
          notificationService.scheduleTodoReminder(res.todo).catch(() => {});
        }
        if (res.pending) {
          notificationService.schedulePendingReminder(res.pending).catch(() => {});
          dataSync.notify('refresh_pending');
        }
        if (res.action_performed === 'delete_event' && res.event?.id) {
          notificationService.cancelEventReminder(res.event.id).catch(() => {});
        }
        if (res.action_performed === 'delete_todo' && res.todo?.id) {
          notificationService.cancelTodoReminder(res.todo.id).catch(() => {});
        }
        notifyAssistantResult(res);
        onDataChanged?.();
      } catch (err: unknown) {
        if (isUserStoppedRef.current && isAbortError(err)) {
          const stoppedMsg: ChatMessage = {
            id: `stop-${Date.now()}`,
            sender: 'vito',
            text: '⏹️ *(Geração interrompida)*',
            timestamp: new Date().toISOString(),
          };
          const withStopped = [...truncatedList, stoppedMsg];
          setMessages(withStopped);
          saveMessages(withStopped);
          return;
        }

        console.warn('[useChat] falha na re-geração após edição:', err);
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          sender: 'vito',
          text: sanitizeErrorMessage(err),
          timestamp: new Date().toISOString(),
        };
        const withError = [...truncatedList, errorMsg];
        setMessages(withError);
        saveMessages(withError);
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        isUserStoppedRef.current = false;
        setLoading(false);
      }
    },
    [messages, loading, onDataChanged, saveMessages]
  );

  const sendAudio = useCallback(
    async (audioUri: string) => {
      if (loading) return;

      // Mensagem placeholder do usuário indicando envio de voz
      const userMsg: ChatMessage = {
        id: `user-audio-${Date.now()}`,
        sender: 'user',
        text: 'Mensagem de voz enviada',
        timestamp: new Date().toISOString(),
      };

      const withUser = [...messages, userMsg];
      setMessages(withUser);
      saveMessages(withUser);
      setLoading(true);

      try {
        const recentHistory = messages.slice(-6).map((m) => ({
          sender: m.sender === 'user' ? ('user' as const) : ('vito' as const),
          text: m.text,
        }));
        const res = await api.assistantAudio(audioUri, 'audio.m4a', { history: recentHistory });

        // Substitui o placeholder com a transcrição real
        const transcriptText = res.transcript
          ? `"${res.transcript}"`
          : 'Voz processada';

        const updatedUserMsg: ChatMessage = { ...userMsg, text: transcriptText };
        const vitoMsg = buildAssistantMessage('vito-audio', res, 'Instrução de voz processada.');

        const withVito = [...messages, updatedUserMsg, vitoMsg];
        setMessages(withVito);
        saveMessages(withVito);

        // Agenda lembretes locais imediatamente para itens criados/atualizados pela IA via áudio
        if (res.event) {
          notificationService.scheduleEventDualReminders(res.event).catch(() => {});
        }
        if (res.todo) {
          notificationService.scheduleTodoReminder(res.todo).catch(() => {});
        }
        if (res.pending) {
          notificationService.schedulePendingReminder(res.pending).catch(() => {});
          dataSync.notify('refresh_pending');
        }
        if (res.action_performed === 'delete_event' && res.event?.id) {
          notificationService.cancelEventReminder(res.event.id).catch(() => {});
        }
        if (res.action_performed === 'delete_todo' && res.todo?.id) {
          notificationService.cancelTodoReminder(res.todo.id).catch(() => {});
        }

        notifyAssistantResult(res);
        onDataChanged?.();
      } catch (err: unknown) {
        console.warn('[useChat] falha no assistente:', err);
        const errMsg = err instanceof Error ? err.message : '';
        let fallbackText = 'Não consegui entender o áudio agora. Pode tentar de novo ou digitar o pedido?';
        if (errMsg && (errMsg.includes('tempo limite') || errMsg.includes('60s') || errMsg.includes('Network request failed'))) {
          fallbackText = 'O processamento do áudio demorou mais do que o esperado ou houve instabilidade de rede. Verifique sua conexão e tente novamente.';
        }
        const errorMsg: ChatMessage = {
          id: `err-audio-${Date.now()}`,
          sender: 'vito',
          text: fallbackText,
          timestamp: new Date().toISOString(),
        };
        const withError = [...withUser, errorMsg];
        setMessages(withError);
        saveMessages(withError);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, onDataChanged, saveMessages]
  );

  const sendImage = useCallback(
    async (imageUri: string, prompt?: string, base64Override?: string) => {
      if (loading) return;

      const userMsg: ChatMessage = {
        id: `user-img-${Date.now()}`,
        sender: 'user',
        text: prompt?.trim() || 'Imagem enviada para análise',
        imageUri,
        timestamp: new Date().toISOString(),
      };

      const withUser = [...messages, userMsg];
      setMessages(withUser);
      saveMessages(withUser);
      setLoading(true);

      try {
        const res = await api.assistantVision(imageUri, prompt, 'image.jpg', undefined, base64Override);
        const vitoMsg = buildAssistantMessage('vito-img', res, 'Imagem analisada com sucesso.');

        const withVito = [...withUser, vitoMsg];
        setMessages(withVito);
        saveMessages(withVito);

        notifyAssistantResult(res);
        onDataChanged?.();
      } catch (err: unknown) {
        console.warn('[useChat] falha no assistente:', err);
        const errMsg = err instanceof Error ? err.message : '';
        let fallbackText = 'Não consegui analisar a imagem agora. Pode tentar de novo em instantes?';
        if (errMsg && (errMsg.includes('tempo limite') || errMsg.includes('60s') || errMsg.includes('Network request failed'))) {
          fallbackText = 'O envio da imagem demorou mais do que o esperado ou houve instabilidade de rede. Verifique sua conexão e tente novamente.';
        }
        const errorMsg: ChatMessage = {
          id: `err-img-${Date.now()}`,
          sender: 'vito',
          text: fallbackText,
          timestamp: new Date().toISOString(),
        };
        const withError = [...withUser, errorMsg];
        setMessages(withError);
        saveMessages(withError);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, onDataChanged, saveMessages]
  );

  const clearHistory = useCallback(async () => {
    setMessages([]);
    saveMessages([]);
  }, [saveMessages]);

  return {
    messages,
    setMessages,
    loading,
    saveMessages,
    sendMessage,
    editAndResendMessage,
    stopGeneration,
    sendAudio,
    sendImage,
    clearHistory,
  };
}
