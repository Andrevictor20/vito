import { useEffect, useCallback } from 'react';
import { useChatSessions } from './useChatSessions';
import { useChatMessages } from './useChatMessages';
import { api } from '../services/api';
import { ConversationSession, ChatMessage } from '../types';

export interface UseChatOptions {
  onDataChanged?: () => void;
  currentUserId?: string;
}

export function useChat(options?: UseChatOptions) {
  const {
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    activeSessionIdRef,
    sessionsWithActive,
    startNewConversation,
    switchConversation: switchSessionOriginal,
    deleteConversation,
    togglePinConversation,
  } = useChatSessions(options?.currentUserId);

  const {
    messages,
    setMessages,
    loading,
    saveMessages,
    sendMessage,
    appendUserMessage,
    appendAssistantMessage,
    editAndResendMessage,
    stopGeneration,
    sendAudio,
    sendImage,
    clearHistory,
  } = useChatMessages(activeSessionId, setSessions, {
    activeSessionIdRef,
    onDataChanged: options?.onDataChanged,
  });

  const switchConversation = async (id: string) => {
    const loadedMessages = await switchSessionOriginal(id);
    if (loadedMessages) {
      setMessages(loadedMessages);
    }
  };

  const loadSessions = useCallback(async () => {
    try {
      const data = await api.getChatSessions();
      setSessions(data || []);
      return data || [];
    } catch (err) {
      console.warn('[useChat] Falha ao carregar sessões de chat:', err);
      return [];
    }
  }, [setSessions]);

  const loadSessionWithMessages = useCallback(async (id: string) => {
    try {
      const detailed = await api.getChatSessionWithMessages(id);
      return detailed;
    } catch (err) {
      console.error('[useChat] Erro ao carregar conversa:', err);
      return null;
    }
  }, []);

  const deleteChatSession = useCallback(async (id: string) => {
    try {
      await api.deleteChatSession(id);
      setSessions((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error('[useChat] Erro ao excluir conversa:', err);
      throw err;
    }
  }, [setSessions]);

  const askAssistant = useCallback(async (prompt: string, context?: any) => {
    return api.askAssistant(prompt, context);
  }, []);

  const syncChatSession = useCallback(async (session: ConversationSession, chatMessages: ChatMessage[]) => {
    return api.syncChatSession(session, chatMessages);
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      const current = sessions.find((s) => s.id === activeSessionId);
      if (current) {
        setMessages(current.messages || []);
      }
    }
  }, [activeSessionId, sessions, setMessages]);

  return {
    messages,
    setMessages,
    loading,
    sendMessage,
    appendUserMessage,
    appendAssistantMessage,
    editAndResendMessage,
    stopGeneration,
    sendAudio,
    sendImage,
    clearHistory,
    sessions: sessionsWithActive,
    conversations: sessions,
    setConversations: setSessions,
    activeSessionId,
    setActiveSessionId,
    startNewConversation,
    switchConversation,
    deleteConversation,
    togglePinConversation,
    saveMessages,
    loadSessions,
    loadSessionWithMessages,
    deleteChatSession,
    askAssistant,
    syncChatSession,
  };
}
