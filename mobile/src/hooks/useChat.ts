import { useCallback, useEffect, useRef } from 'react';
import { useChatSessions } from './useChatSessions';
import { useChatMessages } from './useChatMessages';

export { toChatBooking, toChatMeeting } from './useChatMessages';
export { getChatStorageKeys } from '../services/chatStorageService';

/**
 * Fachada fina (A2+A3): compõe useChatSessions + useChatMessages e mantém
 * a assinatura consumida pela ChatScreen. Nenhuma lógica de negócio aqui —
 * apenas coordenação sessão <-> mensagens.
 */
export function useChat(onDataChanged?: () => void, currentUserId?: string) {
  const {
    sessions,
    setSessions,
    activeSessionId,
    activeSessionIdRef,
    keys,
    sessionsWithActive,
    startNewConversation: startSession,
    switchConversation: switchSession,
    deleteConversation: deleteSession,
    togglePinConversation,
  } = useChatSessions(currentUserId);

  const {
    messages,
    setMessages,
    loading,
    sendMessage,
    appendAssistantMessage,
    editAndResendMessage,
    stopGeneration,
    sendAudio,
    sendImage,
    clearHistory,
  } = useChatMessages(activeSessionId, setSessions, {
    keys,
    activeSessionIdRef,
    onDataChanged,
  });

  // Espelha as mensagens da sessão ativa no estado local sempre que a
  // sessão ativa troca (load inicial, switch, delete, logout). Guardado por
  // lastSynced para não sobrescrever envios em andamento quando só o
  // conteúdo das sessões muda (ex: saveMessages, sync remoto).
  const lastSyncedActiveRef = useRef<string>('');
  useEffect(() => {
    if (!activeSessionId) {
      lastSyncedActiveRef.current = '';
      setMessages([]);
      return;
    }
    if (lastSyncedActiveRef.current === activeSessionId) return;
    lastSyncedActiveRef.current = activeSessionId;
    const target = sessions.find((s) => s.id === activeSessionId);
    setMessages((target?.messages || []).filter((m) => m.id !== 'msg-initial'));
  }, [activeSessionId, sessions, setMessages]);

  const startNewConversation = useCallback(() => {
    startSession();
    lastSyncedActiveRef.current = activeSessionIdRef.current;
    setMessages([]);
  }, [startSession, setMessages, activeSessionIdRef]);

  const switchConversation = useCallback(async (id: string) => {
    const msgs = await switchSession(id);
    if (msgs) {
      lastSyncedActiveRef.current = id;
      setMessages(msgs);
    }
  }, [switchSession, setMessages]);

  const deleteConversation = useCallback(async (id: string) => {
    const nextMessages = await deleteSession(id);
    lastSyncedActiveRef.current = activeSessionIdRef.current;
    setMessages(nextMessages);
  }, [deleteSession, setMessages, activeSessionIdRef]);

  return {
    messages,
    loading,
    sessions: sessionsWithActive,
    activeSessionId,
    sendMessage,
    appendAssistantMessage,
    editAndResendMessage,
    stopGeneration,
    sendAudio,
    sendImage,
    clearHistory,
    startNewConversation,
    switchConversation,
    deleteConversation,
    togglePinConversation,
  };
}
