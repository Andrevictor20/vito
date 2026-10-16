export interface ApiRequestOptions extends RequestInit {
  /** Timeout por chamada (ms); padrão 15s (60s em IA/integrações). */
  timeoutMs?: number;
}

export interface ChatHistoryItem {
  sender: 'user' | 'vito';
  text: string;
}

export interface AssistantChatOptions {
  timezone?: string;
  history?: ChatHistoryItem[];
  signal?: AbortSignal;
}
