import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { ChatMessage, ConversationSession } from '../types';
import { api } from '../services/api';
import { humanizePreview, semanticTitle } from '../utils/chatPreview';
import {
  getChatStorageKeys,
  readLegacyChat,
  readSessions,
  writeActiveSession,
  writeSessions,
} from '../services/chatStorageService';

const INITIAL_MESSAGE: ChatMessage = {
  id: 'msg-initial',
  sender: 'vito',
  text: 'Olá! Sou o Vito, seu assistente executivo pessoal. Como posso ajudar com sua agenda ou tarefas hoje?',
  timestamp: new Date().toISOString(),
};

export interface UseChatSessionsResult {
  sessions: ConversationSession[];
  setSessions: React.Dispatch<React.SetStateAction<ConversationSession[]>>;
  activeSessionId: string;
  activeSessionIdRef: React.MutableRefObject<string>;
  keys: ReturnType<typeof getChatStorageKeys>;
  sessionsWithActive: (ConversationSession & { active: boolean })[];
  startNewConversation: () => void;
  switchConversation: (id: string) => Promise<ChatMessage[] | null>;
  deleteConversation: (id: string) => Promise<ChatMessage[]>;
  togglePinConversation: (id: string) => void;
}

/**
 * A2: dono do estado sessions/activeSessionId, loadStoredChat e CRUD de
 * sessões com persistência via chatStorageService. Não toca em messages/
 * loading — a fachada useChat deriva/sincroniza as mensagens.
 */
export function useChatSessions(currentUserId?: string): UseChatSessionsResult {
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const activeSessionIdRef = useRef<string>('');

  const keys = useMemo(() => getChatStorageKeys(currentUserId), [currentUserId]);

  // Carregar sessões e histórico persistente do AsyncStorage com isolamento estrito de conta
  useEffect(() => {
    let isMounted = true;

    // Se não houver usuário logado (ex: logout / tela de login), purga o estado em memória imediatamente
    if (!currentUserId) {
      setSessions([]);
      setActiveSessionId('');
      activeSessionIdRef.current = '';
      return;
    }

    const loadStoredChat = async () => {
      try {
        const keys = getChatStorageKeys(currentUserId);
        const { sessions: parsed } = await readSessions(keys);
        const legacyChat = await readLegacyChat(keys);

        if (!isMounted) return;

        let localSessions: ConversationSession[] = [];
        if (parsed.length > 0) {
          // Regra: Ao abrir o app, SEMPRE abrir em uma nova conversa limpa
          // Se a primeira conversa já for uma conversa vazia sem mensagens, reutiliza-a
          const firstSession = parsed[0];
          const hasCleanEmptySession = firstSession && (!firstSession.messages || firstSession.messages.length === 0);

          if (hasCleanEmptySession) {
            localSessions = parsed;
            setSessions(parsed);
            setActiveSessionId(firstSession.id);
            activeSessionIdRef.current = firstSession.id;
          } else {
            const newId = `conv-${Date.now()}`;
            const newSession: ConversationSession = {
              id: newId,
              title: 'Nova Conversa',
              preview: 'Nova conversa',
              timestamp: new Date().toISOString(),
              messages: [],
            };
            const filtered = parsed.filter(
              (s) => (s.messages || []).length > 0 || (s.title !== 'Nova Conversa' && s.title !== 'Conversa Atual')
            );
            localSessions = [newSession, ...filtered];
            setSessions(localSessions);
            setActiveSessionId(newId);
            activeSessionIdRef.current = newId;

            const keys = getChatStorageKeys(currentUserId);
            await writeSessions(keys, localSessions);
            await writeActiveSession(keys, newId, []);
          }
        }

        if (localSessions.length === 0) {
          const initialMessages: ChatMessage[] = legacyChat;

          const firstUser = initialMessages.find((m) => m.sender === 'user');
          const title = semanticTitle(firstUser?.text, 'Nova Conversa');

          const initialSession: ConversationSession = {
            id: `conv-${Date.now()}`,
            title,
            preview: initialMessages.length > 0
              ? humanizePreview(initialMessages[initialMessages.length - 1]?.text)
              : 'Nova conversa',
            timestamp: new Date().toISOString(),
            messages: initialMessages,
          };

          localSessions = [initialSession];
          if (!isMounted) return;
          setSessions(localSessions);
          setActiveSessionId(initialSession.id);
          activeSessionIdRef.current = initialSession.id;

          const keys = getChatStorageKeys(currentUserId);
          await writeSessions(keys, [initialSession]);
          await writeActiveSession(keys, initialSession.id, []);
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
            writeSessions(getChatStorageKeys(currentUserId), consolidated);
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

  const startNewConversation = useCallback(() => {
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

    setSessions((prev) => {
      const filtered = prev.filter((s) => s.messages.length > 0 || (s.title !== 'Nova Conversa' && s.title !== 'Conversa Atual'));
      const next = [newSession, ...filtered];
      writeSessions(keys, next);
      writeActiveSession(keys, newId, []);
      return next;
    });
  }, [keys]);

  const switchConversation = useCallback(async (id: string): Promise<ChatMessage[] | null> => {
    const target = sessions.find((s) => s.id === id);
    if (!target) return null;
    activeSessionIdRef.current = id;
    setActiveSessionId(id);
    const msgs = (target.messages || []).filter((m) => m.id !== 'msg-initial');
    await writeActiveSession(keys, id, msgs);
    return msgs;
  }, [sessions, keys]);

  const deleteConversation = useCallback(async (id: string): Promise<ChatMessage[]> => {
    api.deleteChatSession(id).catch(() => {});
    const remaining = sessions.filter((s) => s.id !== id);
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
    const nextMessages = (nextActive.messages || []).filter((m) => m.id !== 'msg-initial');
    setSessions(remaining);
    writeSessions(keys, remaining);
    writeActiveSession(keys, nextActive.id, nextActive.messages || []);
    return nextMessages;
  }, [sessions, keys]);

  const togglePinConversation = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.map((s) =>
        s.id === id ? { ...s, pinned: !s.pinned, timestamp: new Date().toISOString() } : s
      );
      writeSessions(keys, next);
      return next;
    });
  }, [keys]);

  const sessionsWithActive = sessions.map((s) => ({
    ...s,
    active: s.id === activeSessionId,
  }));

  return {
    sessions,
    setSessions,
    activeSessionId,
    activeSessionIdRef,
    keys,
    sessionsWithActive,
    startNewConversation,
    switchConversation,
    deleteConversation,
    togglePinConversation,
  };
}
