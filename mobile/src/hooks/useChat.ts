import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage, ConversationSession } from '../types';
import { api } from '../services/api';

const CHAT_STORAGE_KEY = '@vito_persistent_chat';
const SESSIONS_STORAGE_KEY = '@vito_chat_sessions';
const ACTIVE_SESSION_ID_KEY = '@vito_active_session_id';

const INITIAL_MESSAGE: ChatMessage = {
  id: 'msg-initial',
  sender: 'vito',
  text: 'Olá! Sou o Vito, seu assistente executivo pessoal. Como posso ajudar com sua agenda ou tarefas hoje?',
  timestamp: new Date().toISOString(),
};

export function useChat(onDataChanged?: () => void) {
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const activeSessionIdRef = useRef<string>('');

  // Carregar sessões e histórico persistente do AsyncStorage
  useEffect(() => {
    const loadStoredChat = async () => {
      try {
        const storedSessions = await AsyncStorage.getItem(SESSIONS_STORAGE_KEY);
        const storedActiveId = await AsyncStorage.getItem(ACTIVE_SESSION_ID_KEY);
        const legacyChat = await AsyncStorage.getItem(CHAT_STORAGE_KEY);

        if (storedSessions) {
          const parsed = JSON.parse(storedSessions) as ConversationSession[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSessions(parsed);
            const active = parsed.find((s) => s.id === storedActiveId) || parsed[0];
            setActiveSessionId(active.id);
            activeSessionIdRef.current = active.id;
            setMessages(active.messages && active.messages.length > 0 ? active.messages : [INITIAL_MESSAGE]);
            return;
          }
        }

        // Migração do legado ou inicialização da primeira sessão
        let initialMessages = [INITIAL_MESSAGE];
        if (legacyChat) {
          try {
            const parsedLegacy = JSON.parse(legacyChat);
            if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
              initialMessages = parsedLegacy;
            }
          } catch {}
        }

        const firstUser = initialMessages.find((m) => m.sender === 'user');
        const title = firstUser
          ? firstUser.text.length > 28
            ? firstUser.text.slice(0, 28) + '...'
            : firstUser.text
          : 'Conversa Atual';

        const initialSession: ConversationSession = {
          id: `conv-${Date.now()}`,
          title,
          preview: initialMessages[initialMessages.length - 1]?.text || INITIAL_MESSAGE.text,
          timestamp: new Date().toISOString(),
          messages: initialMessages,
        };

        setSessions([initialSession]);
        setActiveSessionId(initialSession.id);
        activeSessionIdRef.current = initialSession.id;
        setMessages(initialMessages);

        await AsyncStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify([initialSession]));
        await AsyncStorage.setItem(ACTIVE_SESSION_ID_KEY, initialSession.id);
      } catch (e) {
        console.error('Falha ao restaurar sessões do chat:', e);
      }
    };

    loadStoredChat();
  }, []);

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

        AsyncStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(finalList)).catch(console.error);
        AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(newMessages.slice(-100))).catch(console.error);
        return finalList;
      });
    },
    [activeSessionId]
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

      try {
        const res = await api.assistantChat(text.trim());
        const vitoMsg: ChatMessage = {
          id: `vito-${Date.now()}`,
          sender: 'vito',
          text: res.reply || res.message || 'Instrução processada com sucesso.',
          timestamp: new Date().toISOString(),
          action_performed: res.action_performed,
          event: res.event,
          todo: res.todo,
          conflict: res.conflict,
        };

        const withVito = [...withUser, vitoMsg];
        setMessages(withVito);
        saveMessages(withVito);

        // Se criou evento ou tarefa, notifica o listener para atualizar a tela de agenda
        if (res.event || res.todo || res.action_performed !== 'none') {
          onDataChanged?.();
        }
      } catch (err: unknown) {
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
        text: '🎙️ Mensagem de voz enviada...',
        timestamp: new Date().toISOString(),
      };

      const withUser = [...messages, userMsg];
      setMessages(withUser);
      saveMessages(withUser);
      setLoading(true);

      try {
        const res = await api.assistantAudio(audioUri);

        // Substitui o placeholder com a transcrição real
        const transcriptText = (res as any).transcript
          ? `🎙️ "${(res as any).transcript}"`
          : '🎙️ Voz processada';

        const updatedUserMsg: ChatMessage = { ...userMsg, text: transcriptText };
        const vitoMsg: ChatMessage = {
          id: `vito-audio-${Date.now()}`,
          sender: 'vito',
          text: res.reply || res.message || 'Instrução de voz processada.',
          timestamp: new Date().toISOString(),
          action_performed: res.action_performed,
          event: res.event,
          todo: res.todo,
          conflict: res.conflict,
        };

        const withVito = [...messages, updatedUserMsg, vitoMsg];
        setMessages(withVito);
        saveMessages(withVito);

        if (res.event || res.todo || res.action_performed !== 'none') {
          onDataChanged?.();
        }
      } catch (err: unknown) {
        console.warn('[useChat] falha no assistente:', err);
        const errorMsg: ChatMessage = {
          id: `err-audio-${Date.now()}`,
          sender: 'vito',
          text: 'Não consegui entender o áudio agora. Pode tentar de novo ou digitar o pedido?',
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
    async (imageUri: string, prompt?: string) => {
      if (loading) return;

      const userMsg: ChatMessage = {
        id: `user-img-${Date.now()}`,
        sender: 'user',
        text: prompt?.trim() || '📷 Imagem enviada para análise...',
        imageUri,
        timestamp: new Date().toISOString(),
      };

      const withUser = [...messages, userMsg];
      setMessages(withUser);
      saveMessages(withUser);
      setLoading(true);

      try {
        const res = await api.assistantVision(imageUri, prompt);
        const vitoMsg: ChatMessage = {
          id: `vito-img-${Date.now()}`,
          sender: 'vito',
          text: res.reply || res.message || 'Imagem analisada com sucesso.',
          timestamp: new Date().toISOString(),
          action_performed: res.action_performed,
          event: res.event,
          todo: res.todo,
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
        const errorMsg: ChatMessage = {
          id: `err-img-${Date.now()}`,
          sender: 'vito',
          text: 'Não consegui analisar a imagem agora. Pode tentar de novo em instantes?',
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
    const reset = [INITIAL_MESSAGE];
    setMessages(reset);
    await saveMessages(reset);
  }, [saveMessages]);

  const startNewConversation = useCallback(async () => {
    const newId = `conv-${Date.now()}`;
    const newSession: ConversationSession = {
      id: newId,
      title: 'Nova Conversa',
      preview: INITIAL_MESSAGE.text,
      timestamp: new Date().toISOString(),
      messages: [INITIAL_MESSAGE],
    };

    activeSessionIdRef.current = newId;
    setActiveSessionId(newId);
    setMessages([INITIAL_MESSAGE]);

    setSessions((prev) => {
      const filtered = prev.filter((s) => s.messages.length > 1 || (s.title !== 'Nova Conversa' && s.title !== 'Conversa Atual'));
      const next = [newSession, ...filtered];
      AsyncStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(next)).catch(console.error);
      AsyncStorage.setItem(ACTIVE_SESSION_ID_KEY, newId).catch(console.error);
      AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify([INITIAL_MESSAGE])).catch(console.error);
      return next;
    });
  }, []);

  const switchConversation = useCallback(async (id: string) => {
    const target = sessions.find((s) => s.id === id);
    if (!target) return;
    activeSessionIdRef.current = id;
    setActiveSessionId(id);
    const msgs = target.messages && target.messages.length > 0 ? target.messages : [INITIAL_MESSAGE];
    setMessages(msgs);
    await AsyncStorage.setItem(ACTIVE_SESSION_ID_KEY, id);
    await AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(msgs));
  }, [sessions]);

  const deleteConversation = useCallback(async (id: string) => {
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      let nextActive = remaining[0];
      if (!nextActive) {
        nextActive = {
          id: `conv-${Date.now()}`,
          title: 'Conversa Atual',
          preview: INITIAL_MESSAGE.text,
          timestamp: new Date().toISOString(),
          messages: [INITIAL_MESSAGE],
        };
        remaining.push(nextActive);
      }
      activeSessionIdRef.current = nextActive.id;
      setActiveSessionId(nextActive.id);
      setMessages(nextActive.messages);
      AsyncStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(remaining)).catch(console.error);
      AsyncStorage.setItem(ACTIVE_SESSION_ID_KEY, nextActive.id).catch(console.error);
      AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(nextActive.messages)).catch(console.error);
      return remaining;
    });
  }, []);

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
    sendAudio,
    sendImage,
    clearHistory,
    startNewConversation,
    switchConversation,
    deleteConversation,
  };
}
