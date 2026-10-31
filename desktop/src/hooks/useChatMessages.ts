import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, ConversationSession } from '../types';
import { api } from '../services/api';
import {
  buildAssistantMessage,
  handleAssistantSideEffects,
} from './chatMessageEffects';

export interface UseChatMessagesOptions {
  activeSessionIdRef?: React.MutableRefObject<string>;
  onDataChanged?: () => void;
}

export interface UseChatMessagesResult {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  loading: boolean;
  saveMessages: (newMessages: ChatMessage[]) => void;
  sendMessage: (text: string, focusMode?: string) => Promise<void>;
  appendUserMessage: (text: string) => void;
  appendAssistantMessage: (text: string) => void;
  editAndResendMessage: (messageId: string, newText: string, focusMode?: string) => Promise<void>;
  stopGeneration: () => void;
  sendAudio: (audioB64: string, focusMode?: string) => Promise<void>;
  sendImage: (imageB64: string, prompt?: string, mimeType?: string) => Promise<void>;
  clearHistory: () => Promise<void>;
}

export function useChatMessages(
  activeSessionId: string,
  setSessions: React.Dispatch<React.SetStateAction<ConversationSession[]>>,
  options?: UseChatMessagesOptions
): UseChatMessagesResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const saveMessages = useCallback(
    (newMessages: ChatMessage[]) => {
      setMessages(newMessages);
      const currentId = options?.activeSessionIdRef?.current || activeSessionId;

      setSessions((prevSessions) => {
        const firstUser = newMessages.find((m) => m.sender === 'user');
        const latestMsg = newMessages[newMessages.length - 1];
        const previewText = latestMsg?.text?.slice(0, 80) || 'Nova conversa';
        const freshTitle = firstUser?.text ? firstUser.text.slice(0, 30) : 'Conversa Atual';

        let found = false;
        const updated = prevSessions.map((s) => {
          if (s.id === currentId) {
            found = true;
            return {
              ...s,
              title: s.title === 'Nova Conversa' && firstUser ? freshTitle : s.title,
              preview: previewText,
              timestamp: new Date().toISOString(),
              messages: newMessages.slice(-100),
            };
          }
          return s;
        });

        const finalList = found
          ? updated
          : [
              {
                id: currentId || `conv-${Date.now()}`,
                title: freshTitle,
                preview: previewText,
                timestamp: new Date().toISOString(),
                messages: newMessages.slice(-100),
              },
              ...updated,
            ];

        const activeTarget = finalList.find((s) => s.id === currentId);
        if (activeTarget) {
          api.syncChatSession(activeTarget, newMessages.slice(-100)).catch(() => {});
        }

        return finalList;
      });
    },
    [activeSessionId, options?.activeSessionIdRef, setSessions]
  );

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  }, []);

  const sendMessage = useCallback(
    async (text: string, focusMode?: string) => {
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

      try {
        const history = messages.slice(-10).map((m) => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text,
        }));

        const res = await api.assistantChat(text.trim(), {
          history,
          focus_mode: focusMode,
        });

        const vitoMsg = buildAssistantMessage('vito', res, 'Instrução processada com sucesso.');
        const withVito = [...withUser, vitoMsg];
        setMessages(withVito);
        saveMessages(withVito);

        handleAssistantSideEffects(res, options?.onDataChanged);
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return;
        }
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          sender: 'vito',
          text: `Erro ao comunicar com Vito: ${err?.message || 'Falha de conexão'}`,
          timestamp: new Date().toISOString(),
        };
        const withError = [...withUser, errorMsg];
        setMessages(withError);
        saveMessages(withError);
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
      }
    },
    [messages, loading, saveMessages, options?.onDataChanged]
  );

  const editAndResendMessage = useCallback(
    async (messageId: string, newText: string, focusMode?: string) => {
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx === -1 || !newText.trim()) return;

      const truncated = messages.slice(0, idx);
      setMessages(truncated);
      saveMessages(truncated);
      await sendMessage(newText, focusMode);
    },
    [messages, saveMessages, sendMessage]
  );

  const sendAudio = useCallback(
    async (audioB64: string, focusMode?: string) => {
      if (loading) return;
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
        const res = await api.assistantAudio(audioB64, 'audio.wav', { focus_mode: focusMode });
        const vitoMsg = buildAssistantMessage('vito-audio', res, 'Áudio processado.');
        const withVito = [...withUser, vitoMsg];
        setMessages(withVito);
        saveMessages(withVito);
        handleAssistantSideEffects(res, options?.onDataChanged);
      } catch (err: any) {
        const errorMsg: ChatMessage = {
          id: `err-audio-${Date.now()}`,
          sender: 'vito',
          text: 'Não consegui processar seu áudio agora.',
          timestamp: new Date().toISOString(),
        };
        const withError = [...withUser, errorMsg];
        setMessages(withError);
        saveMessages(withError);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, saveMessages, options?.onDataChanged]
  );

  const sendImage = useCallback(
    async (imageB64: string, prompt?: string, mimeType?: string) => {
      if (loading) return;
      const userMsg: ChatMessage = {
        id: `user-img-${Date.now()}`,
        sender: 'user',
        text: prompt?.trim() || 'Imagem enviada para análise',
        timestamp: new Date().toISOString(),
      };
      const withUser = [...messages, userMsg];
      setMessages(withUser);
      saveMessages(withUser);
      setLoading(true);

      try {
        const res = await api.assistantVision(imageB64, mimeType, prompt);
        const vitoMsg = buildAssistantMessage('vito-img', res, 'Imagem analisada com sucesso.');
        const withVito = [...withUser, vitoMsg];
        setMessages(withVito);
        saveMessages(withVito);
        handleAssistantSideEffects(res, options?.onDataChanged);
      } catch (err: any) {
        const errorMsg: ChatMessage = {
          id: `err-img-${Date.now()}`,
          sender: 'vito',
          text: 'Não consegui analisar sua imagem no momento.',
          timestamp: new Date().toISOString(),
        };
        const withError = [...withUser, errorMsg];
        setMessages(withError);
        saveMessages(withError);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, saveMessages, options?.onDataChanged]
  );

  const clearHistory = useCallback(async () => {
    setMessages([]);
    saveMessages([]);
  }, [saveMessages]);

  const appendUserMessage = useCallback(
    (text: string) => {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: text.trim(),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => {
        const next = [...prev, userMsg];
        saveMessages(next);
        return next;
      });
    },
    [saveMessages]
  );

  const appendAssistantMessage = useCallback(
    (text: string) => {
      const vitoMsg: ChatMessage = {
        id: `vito-${Date.now()}`,
        sender: 'vito',
        text: text.trim(),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => {
        const next = [...prev, vitoMsg];
        saveMessages(next);
        return next;
      });
    },
    [saveMessages]
  );

  return {
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
  };
}
