import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage } from '../types';
import { api } from '../services/api';

const CHAT_STORAGE_KEY = '@vito_persistent_chat';

const INITIAL_MESSAGE: ChatMessage = {
  id: 'msg-initial',
  sender: 'vito',
  text: 'Olá! Sou o Vito, seu assistente executivo pessoal. Como posso ajudar com sua agenda ou tarefas hoje?',
  timestamp: new Date().toISOString(),
};

export function useChat(onDataChanged?: () => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [loading, setLoading] = useState(false);

  // Carregar histórico persistente do AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem(CHAT_STORAGE_KEY).then((data) => {
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        } catch (e) {
          console.error('Falha ao restaurar mensagens do chat:', e);
        }
      }
    });
  }, []);

  const saveMessages = useCallback(async (newMessages: ChatMessage[]) => {
    try {
      // Limita a persistência aos últimos 100 itens para performance máxima
      const trimmed = newMessages.slice(-100);
      await AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.error('Falha ao salvar chat:', e);
    }
  }, []);

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
      } catch (err: any) {
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          sender: 'vito',
          text: `Desculpe, ocorreu uma falha de comunicação: ${err?.message || 'Erro desconhecido'}`,
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
      } catch (err: any) {
        const errorMsg: ChatMessage = {
          id: `err-audio-${Date.now()}`,
          sender: 'vito',
          text: `Não consegui processar o áudio: ${err?.message || 'Erro desconhecido'}`,
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
    await AsyncStorage.removeItem(CHAT_STORAGE_KEY);
  }, []);

  return {
    messages,
    loading,
    sendMessage,
    sendAudio,
    clearHistory,
  };
}
