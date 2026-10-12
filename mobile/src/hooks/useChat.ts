import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage, ConversationSession } from '../types';
import { api } from '../services/api';
import { notificationService } from '../services/notificationService';
import { isAbortError, truncateMessagesForEdit } from '../utils/chatActions';

export const getChatStorageKeys = (userId?: string) => {
  const suffix = userId ? `_${userId}` : '';
  return {
    sessionsKey: `@vito_chat_sessions${suffix}`,
    activeIdKey: `@vito_active_session_id${suffix}`,
    chatKey: `@vito_persistent_chat${suffix}`,
  };
};

const INITIAL_MESSAGE: ChatMessage = {
  id: 'msg-initial',
  sender: 'vito',
  text: 'Olá! Sou o Vito, seu assistente executivo pessoal. Como posso ajudar com sua agenda ou tarefas hoje?',
  timestamp: new Date().toISOString(),
};

export function useChat(onDataChanged?: () => void, currentUserId?: string) {
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const activeSessionIdRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const isUserStoppedRef = useRef<boolean>(false);

  const stopGeneration = useCallback(() => {
    isUserStoppedRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  }, []);

  const keys = getChatStorageKeys(currentUserId);

  // Carregar sessões e histórico persistente do AsyncStorage com isolamento estrito de conta
  useEffect(() => {
    let isMounted = true;
    const { sessionsKey, activeIdKey, chatKey } = getChatStorageKeys(currentUserId);

    // Se não houver usuário logado (ex: logout / tela de login), purga o estado em memória imediatamente
    if (!currentUserId) {
      setSessions([]);
      setActiveSessionId('');
      activeSessionIdRef.current = '';
      setMessages([]);
      return;
    }

    const loadStoredChat = async () => {
      try {
        const storedSessions = await AsyncStorage.getItem(sessionsKey);
        const storedActiveId = await AsyncStorage.getItem(activeIdKey);
        const legacyChat = await AsyncStorage.getItem(chatKey);

        if (!isMounted) return;

        let localSessions: ConversationSession[] = [];
        if (storedSessions) {
          const parsed = JSON.parse(storedSessions) as ConversationSession[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            localSessions = parsed;
            setSessions(parsed);
            const active = parsed.find((s) => s.id === storedActiveId) || parsed[0];
            setActiveSessionId(active.id);
            activeSessionIdRef.current = active.id;
            const cleanMsgs = (active.messages || []).filter((m) => m.id !== 'msg-initial');
            setMessages(cleanMsgs);
          }
        }

        if (localSessions.length === 0) {
          let initialMessages: ChatMessage[] = [];
          if (legacyChat) {
            try {
              const parsedLegacy = JSON.parse(legacyChat);
              if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
                initialMessages = parsedLegacy.filter((m) => m.id !== 'msg-initial');
              }
            } catch {}
          }

          const firstUser = initialMessages.find((m) => m.sender === 'user');
          const title = firstUser
            ? firstUser.text.length > 28
              ? firstUser.text.slice(0, 28) + '...'
              : firstUser.text
            : 'Nova Conversa';

          const initialSession: ConversationSession = {
            id: `conv-${Date.now()}`,
            title,
            preview: initialMessages[initialMessages.length - 1]?.text || 'Nova conversa',
            timestamp: new Date().toISOString(),
            messages: initialMessages,
          };

          localSessions = [initialSession];
          if (!isMounted) return;
          setSessions(localSessions);
          setActiveSessionId(initialSession.id);
          activeSessionIdRef.current = initialSession.id;
          setMessages(initialMessages);

          await AsyncStorage.setItem(sessionsKey, JSON.stringify([initialSession]));
          await AsyncStorage.setItem(activeIdKey, initialSession.id);
        }

        // Sincronização em background com o servidor para PC e Celular
        api.getChatSessions().then(async (remoteSessions) => {
          if (!isMounted || !Array.isArray(remoteSessions)) return;

          const mergedMap = new Map<string, ConversationSession>();
          // 1. Registra as sessões locais
          localSessions.forEach((s) => mergedMap.set(s.id, s));

          // 2. Para cada sessão que só existe localmente, sobe para o servidor
          for (const localSess of localSessions) {
            if (localSess.messages && localSess.messages.length > 1) {
              api.syncChatSession(localSess, localSess.messages).catch(() => {});
            }
          }

          // 3. Para cada sessão remota que não temos localmente, busca o histórico completo
          for (const rem of remoteSessions) {
            if (!mergedMap.has(rem.id)) {
              try {
                const full = await api.getChatSessionWithMessages(rem.id);
                if (full && full.session) {
                  mergedMap.set(rem.id, {
                    ...full.session,
                    messages: full.messages || [INITIAL_MESSAGE],
                  });
                }
              } catch {}
            }
          }

          const consolidated = Array.from(mergedMap.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );

          if (consolidated.length > 0 && isMounted) {
            setSessions(consolidated);
            AsyncStorage.setItem(sessionsKey, JSON.stringify(consolidated)).catch(() => {});
          }
        }).catch(() => {});
      } catch (e) {
        console.error('Falha ao restaurar sessões do chat:', e);
      }
    };

    loadStoredChat();

    return () => {
      isMounted = false;
    };
  }, [currentUserId]);


  const saveMessages = useCallback(
    async (newMessages: ChatMessage[]) => {
      setMessages(newMessages);
      const currentId = activeSessionIdRef.current || activeSessionId;

      setSessions((prevSessions) => {
        const firstUser = newMessages.find((m) => m.sender === 'user');
        const latestMsg = newMessages[newMessages.length - 1];
        const previewText = latestMsg?.text || 'Sem mensagens';

        let targetFound = false;
        const updated = prevSessions.map((s) => {
          if (s.id === currentId) {
            targetFound = true;
            let title = s.title;
            if ((title === 'Conversa Atual' || title === 'Nova Conversa') && firstUser) {
              title = firstUser.text.length > 28 ? firstUser.text.slice(0, 28) + '...' : firstUser.text;
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
                title: firstUser ? (firstUser.text.length > 28 ? firstUser.text.slice(0, 28) + '...' : firstUser.text) : 'Conversa Atual',
                preview: previewText,
                timestamp: new Date().toISOString(),
                messages: newMessages.slice(-100),
              },
              ...updated,
            ];

        AsyncStorage.setItem(keys.sessionsKey, JSON.stringify(finalList)).catch(console.error);
        AsyncStorage.setItem(keys.chatKey, JSON.stringify(newMessages.slice(-100))).catch(console.error);

        const activeTarget = finalList.find((s) => s.id === currentId);
        if (activeTarget) {
          api.syncChatSession(activeTarget, newMessages.slice(-100)).catch(() => {});
        }
        return finalList;
      });
    },
    [activeSessionId, keys.sessionsKey, keys.chatKey]
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
        if (res.action_performed === 'delete_event' && res.event?.id) {
          notificationService.cancelEventReminder(res.event.id).catch(() => {});
        }
        if (res.action_performed === 'delete_todo' && res.todo?.id) {
          notificationService.cancelTodoReminder(res.todo.id).catch(() => {});
        }

        // Se criou evento ou tarefa, notifica o listener para atualizar a tela de agenda
        if (res.event || res.todo || res.action_performed !== 'none') {
          onDataChanged?.();
        }
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
          text: 'Não consegui processar seu pedido agora. Pode tentar de novo em instantes?',
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
        if (res.action_performed === 'delete_event' && res.event?.id) {
          notificationService.cancelEventReminder(res.event.id).catch(() => {});
        }
        if (res.action_performed === 'delete_todo' && res.todo?.id) {
          notificationService.cancelTodoReminder(res.todo.id).catch(() => {});
        }
        if (res.event || res.todo || res.action_performed !== 'none') {
          onDataChanged?.();
        }
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
        const transcriptText = (res as any).transcript
          ? `"${(res as any).transcript}"`
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
        if (res.action_performed === 'delete_event' && res.event?.id) {
          notificationService.cancelEventReminder(res.event.id).catch(() => {});
        }
        if (res.action_performed === 'delete_todo' && res.todo?.id) {
          notificationService.cancelTodoReminder(res.todo.id).catch(() => {});
        }

        if (res.event || res.todo || res.action_performed !== 'none') {
          onDataChanged?.();
        }
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
          conflict: res.conflict,
        };

        const withVito = [...withUser, vitoMsg];
        setMessages(withVito);
        saveMessages(withVito);

        if (res.event || res.todo || res.action_performed !== 'none') {
          onDataChanged?.();
        }
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
    await saveMessages([]);
  }, [saveMessages]);

  const startNewConversation = useCallback(async () => {
    const newId = `conv-${Date.now()}`;
    const newSession: ConversationSession = {
      id: newId,
      title: 'Nova Conversa',
      preview: 'Nova conversa',
      timestamp: new Date().toISOString(),
      messages: [],
    };

    activeSessionIdRef.current = newId;
    setActiveSessionId(newId);
    setMessages([]);

    setSessions((prev) => {
      const filtered = prev.filter((s) => s.messages.length > 0 || (s.title !== 'Nova Conversa' && s.title !== 'Conversa Atual'));
      const next = [newSession, ...filtered];
      AsyncStorage.setItem(keys.sessionsKey, JSON.stringify(next)).catch(console.error);
      AsyncStorage.setItem(keys.activeIdKey, newId).catch(console.error);
      AsyncStorage.setItem(keys.chatKey, JSON.stringify([])).catch(console.error);
      return next;
    });
  }, [keys.sessionsKey, keys.activeIdKey, keys.chatKey]);

  const switchConversation = useCallback(async (id: string) => {
    const target = sessions.find((s) => s.id === id);
    if (!target) return;
    activeSessionIdRef.current = id;
    setActiveSessionId(id);
    const msgs = (target.messages || []).filter((m) => m.id !== 'msg-initial');
    setMessages(msgs);
    await AsyncStorage.setItem(keys.activeIdKey, id);
    await AsyncStorage.setItem(keys.chatKey, JSON.stringify(msgs));
  }, [sessions, keys.activeIdKey, keys.chatKey]);

  const deleteConversation = useCallback(async (id: string) => {
    api.deleteChatSession(id).catch(() => {});
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      let nextActive = remaining[0];
      if (!nextActive) {
        nextActive = {
          id: `conv-${Date.now()}`,
          title: 'Nova Conversa',
          preview: 'Nova conversa',
          timestamp: new Date().toISOString(),
          messages: [],
        };
        remaining.push(nextActive);
      }
      activeSessionIdRef.current = nextActive.id;
      setActiveSessionId(nextActive.id);
      setMessages((nextActive.messages || []).filter((m) => m.id !== 'msg-initial'));
      AsyncStorage.setItem(keys.sessionsKey, JSON.stringify(remaining)).catch(console.error);
      AsyncStorage.setItem(keys.activeIdKey, nextActive.id).catch(console.error);
      AsyncStorage.setItem(keys.chatKey, JSON.stringify(nextActive.messages)).catch(console.error);
      return remaining;
    });
  }, [keys.sessionsKey, keys.activeIdKey, keys.chatKey]);


  const sessionsWithActive = sessions.map((s) => ({
    ...s,
    active: s.id === activeSessionId,
  }));

  return {
    messages,
    loading,
    sessions: sessionsWithActive,
    activeSessionId,
    sendMessage,
    editAndResendMessage,
    stopGeneration,
    sendAudio,
    sendImage,
    clearHistory,
    startNewConversation,
    switchConversation,
    deleteConversation,
  };
}
