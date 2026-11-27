import type { ChatMessage, ConversationSession } from '../../../types';
import { humanizePreview, semanticTitle } from '../utils/chatPreview';

export function createChatMessage(
  prefix: string,
  sender: ChatMessage['sender'],
  text: string,
  extra?: Partial<ChatMessage>,
): ChatMessage {
  return {
    id: `${prefix}-${Date.now()}`,
    sender,
    text,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

export function createStoppedChatMessage(): ChatMessage {
  return createChatMessage('stop', 'vito', '⏹️ *(Geração interrompida)*');
}

export function resolveMediaErrorText(
  err: unknown,
  defaultMessage: string,
  networkTimeoutMessage: string,
): string {
  const errMsg = err instanceof Error ? err.message : '';
  if (
    errMsg &&
    (errMsg.includes('tempo limite') ||
      errMsg.includes('60s') ||
      errMsg.includes('Network request failed'))
  ) {
    return networkTimeoutMessage;
  }
  return defaultMessage;
}

export function buildUpdatedSessionList(
  prevSessions: ConversationSession[],
  currentId: string,
  newMessages: ChatMessage[],
): ConversationSession[] {
  const firstUser = newMessages.find((m) => m.sender === 'user');
  const latestMsg = newMessages[newMessages.length - 1];
  const previewText = humanizePreview(latestMsg?.text);
  const freshTitle = semanticTitle(firstUser?.text);
  const slicedMessages = newMessages.slice(-100);
  const nowIso = new Date().toISOString();

  let targetFound = false;
  const updated = prevSessions.map((s) => {
    if (s.id !== currentId) return s;
    targetFound = true;
    const shouldReplaceTitle =
      (s.title === 'Conversa Atual' || s.title === 'Nova Conversa') && Boolean(firstUser);
    return {
      ...s,
      title: shouldReplaceTitle ? freshTitle : s.title,
      preview: previewText,
      timestamp: nowIso,
      messages: slicedMessages,
    };
  });

  if (targetFound) return updated;

  return [
    {
      id: currentId || `conv-${Date.now()}`,
      title: firstUser ? freshTitle : 'Conversa Atual',
      preview: previewText,
      timestamp: nowIso,
      messages: slicedMessages,
    },
    ...updated,
  ];
}
