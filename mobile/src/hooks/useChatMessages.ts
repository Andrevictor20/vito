import { useState, useCallback, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AssistantChatResponse, ChatBooking, ChatMessage, ConversationSession } from '../types';
import { api } from '../services/api';
import { notificationService } from '../services/notificationService';
import { dataSync } from '../services/dataSync';
import { isAbortError, truncateMessagesForEdit } from '../utils/chatActions';
import { humanizePreview, semanticTitle } from '../utils/chatPreview';
import type { ChatStorageKeys } from '../services/chatStorageService';
import { getChatStorageKeys } from '../services/chatStorageService';

// Normaliza o booking da resposta do chat para o card: mescla o objeto
// booking com as URLs top-level (booking_url / booking_short_url).
export const toChatBooking = (res: AssistantChatResponse): ChatBooking | undefined => {
  if (!res.booking) return undefined;
  return {
    ...res.booking,
    public_url: res.booking.public_url || res.booking_url || undefined,
    short_url: res.booking.short_url || res.booking_short_url || undefined,
  };
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
        const vitoMsg: ChatMessage = {
          id: `vito-${Date.now()}`,
          sender: 'vito',
          text: res.reply || res.message || 'Instrução processada com sucesso.',
          timestamp: new Date().toISOString(),
          action_performed: res.action_performed,
          event: res.event,
          todo: res.todo,
          trigger: res.trigger,
          pending: res.pending,
          booking: toChatBooking(res),
          conflict: res.conflict,
        };

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

        // Sincroniza e notifica telas imediatamente (Agenda, Radares, etc.)
        if (res.event) dataSync.notify('refresh_events');
        if (res.todo) dataSync.notify('refresh_events');
        if (res.trigger) dataSync.notify('refresh_triggers');
        if (res.booking) dataSync.notify('refresh_bookings');
        dataSync.notify('refresh_all');
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
        // Superfície o motivo real vindo do servidor (ex: validação da IA) em vez
        // de esconder tudo atrás de um genérico — nada foi criado nesse caminho.
        const serverMsg = err instanceof Error ? err.message : '';
        const friendlyFallback =
          'Não consegui processar agora por instabilidade na IA ou na rede. Nada foi criado ou apagado. Tente de novo em instantes com mais detalhes (ex: criar evento Dentista amanhã às 14h).';
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          sender: 'vito',
          text:
            serverMsg && serverMsg !== 'USER_CANCELLED' && !serverMsg.includes('Tempo limite esgotado')
              ? serverMsg
              : serverMsg.includes('Tempo limite')
                ? 'O servidor demorou a responder (60s). Verifique sua conexão — nada foi criado. Tente de novo com uma frase mais completa.'
                : friendlyFallback,
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

        const vitoMsg: ChatMessage = {
          id: `vito-${Date.now()}`,
          sender: 'vito',
          text: res.reply || res.message || 'Instrução processada com sucesso.',
          timestamp: new Date().toISOString(),
          action_performed: res.action_performed,
          event: res.event,
          todo: res.todo,
          trigger: res.trigger,
          pending: res.pending,
          booking: toChatBooking(res),
          conflict: res.conflict,
        };

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
        if (res.event) dataSync.notify('refresh_events');
        if (res.todo) dataSync.notify('refresh_events');
        if (res.trigger) dataSync.notify('refresh_triggers');
        if (res.booking) dataSync.notify('refresh_bookings');
        dataSync.notify('refresh_all');
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
          text: 'Não consegui processar seu pedido agora. Pode tentar de novo em instantes?',
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
        const vitoMsg: ChatMessage = {
          id: `vito-audio-${Date.now()}`,
          sender: 'vito',
          text: res.reply || res.message || 'Instrução de voz processada.',
          timestamp: new Date().toISOString(),
          action_performed: res.action_performed,
          event: res.event,
          todo: res.todo,
          trigger: res.trigger,
          pending: res.pending,
          booking: toChatBooking(res),
          conflict: res.conflict,
        };

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

        if (res.event) dataSync.notify('refresh_events');
        if (res.todo) dataSync.notify('refresh_events');
        if (res.trigger) dataSync.notify('refresh_triggers');
        if (res.booking) dataSync.notify('refresh_bookings');
        dataSync.notify('refresh_all');
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
        const vitoMsg: ChatMessage = {
          id: `vito-img-${Date.now()}`,
          sender: 'vito',
          text: res.reply || res.message || 'Imagem analisada com sucesso.',
          timestamp: new Date().toISOString(),
          action_performed: res.action_performed,
          event: res.event,
          todo: res.todo,
          trigger: res.trigger,
          pending: res.pending,
          booking: toChatBooking(res),
          conflict: res.conflict,
        };

        const withVito = [...withUser, vitoMsg];
        setMessages(withVito);
        saveMessages(withVito);

        if (res.event || res.todo) dataSync.notify('refresh_events');
        if (res.trigger) dataSync.notify('refresh_triggers');
        if (res.booking) dataSync.notify('refresh_bookings');
        dataSync.notify('refresh_all');
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
