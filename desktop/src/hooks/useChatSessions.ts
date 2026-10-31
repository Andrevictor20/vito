import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChatMessage, ConversationSession } from '../types';
import { api } from '../services/api';

const SESSIONS_STORAGE_KEY = '@vito_desktop_chat_sessions';

export interface UseChatSessionsResult {
  sessions: ConversationSession[];
  setSessions: React.Dispatch<React.SetStateAction<ConversationSession[]>>;
  activeSessionId: string;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string>>;
  activeSessionIdRef: React.MutableRefObject<string>;
  sessionsWithActive: (ConversationSession & { active: boolean })[];
  startNewConversation: () => void;
  switchConversation: (id: string) => Promise<ChatMessage[] | null>;
  deleteConversation: (id: string) => Promise<ChatMessage[]>;
  togglePinConversation: (id: string) => void;
}

export function useChatSessions(currentUserId?: string): UseChatSessionsResult {
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const activeSessionIdRef = useRef<string>('');

  const storageKey = currentUserId ? `${SESSIONS_STORAGE_KEY}_${currentUserId}` : SESSIONS_STORAGE_KEY;

  useEffect(() => {
    let isMounted = true;

    if (!currentUserId) {
      setSessions([]);
      setActiveSessionId('');
      activeSessionIdRef.current = '';
      return;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      let localSessions: ConversationSession[] = stored ? JSON.parse(stored) : [];

      if (localSessions.length > 0) {
        const first = localSessions[0];
        if (!first.messages || first.messages.length === 0) {
          setSessions(localSessions);
          setActiveSessionId(first.id);
          activeSessionIdRef.current = first.id;
        } else {
          const newId = `conv-${Date.now()}`;
          const newSession: ConversationSession = {
            id: newId,
            title: 'Nova Conversa',
            preview: 'Nova conversa',
            timestamp: new Date().toISOString(),
            messages: [],
          };
          localSessions = [newSession, ...localSessions];
          setSessions(localSessions);
          setActiveSessionId(newId);
          activeSessionIdRef.current = newId;
          localStorage.setItem(storageKey, JSON.stringify(localSessions));
        }
      } else {
        const initialId = `conv-${Date.now()}`;
        const initialSession: ConversationSession = {
          id: initialId,
          title: 'Nova Conversa',
          preview: 'Nova conversa',
          timestamp: new Date().toISOString(),
          messages: [],
        };
        localSessions = [initialSession];
        setSessions(localSessions);
        setActiveSessionId(initialId);
        activeSessionIdRef.current = initialId;
        localStorage.setItem(storageKey, JSON.stringify(localSessions));
      }

      api.getChatSessions().then(async (remoteSessions) => {
        if (!isMounted || !Array.isArray(remoteSessions)) return;
        const merged = new Map<string, ConversationSession>();
        localSessions.forEach((s) => merged.set(s.id, s));

        for (const rem of remoteSessions) {
          if (!merged.has(rem.id)) {
            try {
              const full = await api.getChatSessionWithMessages(rem.id);
              if (full && full.session) {
                merged.set(rem.id, {
                  ...full.session,
                  messages: full.messages || [],
                });
              }
            } catch {}
          }
        }

        const consolidated = Array.from(merged.values()).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        if (consolidated.length > 0 && isMounted) {
          setSessions(consolidated);
          localStorage.setItem(storageKey, JSON.stringify(consolidated));
        }
      }).catch(() => {});
    } catch (e) {
      console.error('[useChatSessions] Falha ao carregar sessões:', e);
    }

    return () => {
      isMounted = false;
    };
  }, [currentUserId, storageKey]);

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
      const filtered = prev.filter((s) => (s.messages || []).length > 0 || (s.title !== 'Nova Conversa' && s.title !== 'Conversa Atual'));
      const next = [newSession, ...filtered];
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }, [storageKey]);

  const switchConversation = useCallback(async (id: string): Promise<ChatMessage[] | null> => {
    const target = sessions.find((s) => s.id === id);
    if (!target) return null;
    activeSessionIdRef.current = id;
    setActiveSessionId(id);
    return target.messages || [];
  }, [sessions]);

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
    setSessions(remaining);
    localStorage.setItem(storageKey, JSON.stringify(remaining));
    return nextActive.messages || [];
  }, [sessions, storageKey]);

  const togglePinConversation = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.map((s) =>
        s.id === id ? { ...s, pinned: !s.pinned, timestamp: new Date().toISOString() } : s
      );
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }, [storageKey]);

  const sessionsWithActive = sessions.map((s) => ({
    ...s,
    active: s.id === activeSessionId,
  }));

  return {
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    activeSessionIdRef,
    sessionsWithActive,
    startNewConversation,
    switchConversation,
    deleteConversation,
    togglePinConversation,
  };
}
