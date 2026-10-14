import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatMessage, ConversationSession } from '../types';

export interface ChatStorageKeys {
  sessionsKey: string;
  activeIdKey: string;
  chatKey: string;
}

// MOB-03: persistência do chat isolada do hook (antes embutida em useChat).
export const getChatStorageKeys = (userId?: string): ChatStorageKeys => {
  const suffix = userId ? `_${userId}` : '';
  return {
    sessionsKey: `@vito_chat_sessions${suffix}`,
    activeIdKey: `@vito_active_session_id${suffix}`,
    chatKey: `@vito_persistent_chat${suffix}`,
  };
};

export async function readSessions(keys: ChatStorageKeys): Promise<{
  sessions: ConversationSession[];
  activeId: string | null;
}> {
  const [storedSessions, storedActiveId] = await Promise.all([
    AsyncStorage.getItem(keys.sessionsKey),
    AsyncStorage.getItem(keys.activeIdKey),
  ]);
  let sessions: ConversationSession[] = [];
  if (storedSessions) {
    try {
      const parsed = JSON.parse(storedSessions);
      if (Array.isArray(parsed)) sessions = parsed;
    } catch {}
  }
  return { sessions, activeId: storedActiveId };
}

export function writeSessions(keys: ChatStorageKeys, sessions: ConversationSession[]): Promise<void> {
  return AsyncStorage.setItem(keys.sessionsKey, JSON.stringify(sessions)).catch(() => {});
}

export function writeActiveSession(keys: ChatStorageKeys, id: string, messages: ChatMessage[]): Promise<void> {
  return (async () => {
    await AsyncStorage.setItem(keys.activeIdKey, id).catch(() => {});
    await AsyncStorage.setItem(keys.chatKey, JSON.stringify(messages.slice(-100))).catch(() => {});
  })();
}

export async function readLegacyChat(keys: ChatStorageKeys): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(keys.chatKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsedLegacyFilter(parsed);
  } catch {
    return [];
  }
}

function parsedLegacyFilter(parsed: any[]): ChatMessage[] {
  return (parsed as ChatMessage[]).filter((m) => m && m.id !== 'msg-initial');
}
