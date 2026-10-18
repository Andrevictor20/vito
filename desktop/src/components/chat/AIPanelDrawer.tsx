import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../services/api';
import { ChatMessage } from '../../types';
import { Send, Mic, Sparkles, X, Loader2, Check } from 'lucide-react';

interface AIPanelDrawerProps {
  open: boolean;
  onClose: () => void;
  onEventCreated?: () => void;
}

export const AIPanelDrawer: React.FC<AIPanelDrawerProps> = ({ open, onClose, onEventCreated }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Olá! Sou o Vito, seu assistente pessoal. O que deseja agendar, consultar ou delegar hoje?',
      created_at: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.askAssistant(text);
      const assistantMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: res.reply,
        created_at: new Date().toISOString(),
        actions: res.actions,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Se a IA criou algum evento ou tarefa, notifica a tela principal
      if (res.actions && res.actions.length > 0 && onEventCreated) {
        onEventCreated();
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: 'Desculpe, não consegui processar essa requisição no momento. Tente novamente em instantes.',
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRecord = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        // Simulação / Envio de transcrição
        setInput('Reunião com a equipe de engenharia amanhã às 15h');
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.warn('Microfone inacessível:', err);
    }
  };

  if (!open) return null;

  return (
    <div className="w-96 h-screen bg-[#14171C] border-l border-white/10 flex flex-col justify-between z-30 shadow-2xl relative select-none">
      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/5 bg-[#14171C]/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-sm">
            <Sparkles size={15} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              Vito Copilot
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </h3>
            <p className="text-[10px] text-slate-400">Pronto para organizar sua rotina</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Fechar painel (⌘J)"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none shadow-sm'
                  : 'bg-[#1C2026] text-slate-200 border border-white/10 rounded-bl-none shadow-sm'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {/* Action Cards */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-white/10 space-y-1.5">
                  {msg.actions.map((act, i) => (
                    <div
                      key={i}
                      className="p-2 rounded-lg bg-[#0B0D10]/60 border border-emerald-500/30 flex items-center gap-2 text-emerald-400 text-[11px]"
                    >
                      <Check size={14} className="shrink-0" />
                      <span className="truncate">{act.type.replace('CREATE_', '').toLowerCase()}: ação concluída</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <span className="text-[9px] text-slate-500 mt-1 px-1">
              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs py-2 px-3 bg-[#1C2026]/50 rounded-xl w-fit border border-white/5">
            <Loader2 size={13} className="animate-spin text-indigo-400" />
            <span>Vito está digitando...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts */}
      <div className="px-4 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-white/5">
        <button
          onClick={() => handleSend('Quais são meus compromissos de hoje?')}
          className="text-[10px] px-2.5 py-1 rounded-full bg-[#1C2026] hover:bg-white/10 text-slate-300 border border-white/5 whitespace-nowrap transition-colors"
        >
          Compromissos de hoje
        </button>
        <button
          onClick={() => handleSend('Adicionar foco das 14h às 16h')}
          className="text-[10px] px-2.5 py-1 rounded-full bg-[#1C2026] hover:bg-white/10 text-slate-300 border border-white/5 whitespace-nowrap transition-colors"
        >
          + Bloco de foco
        </button>
      </div>

      {/* Input Dock */}
      <div className="p-3 bg-[#14171C] border-t border-white/10">
        <div className="relative flex items-center bg-[#0B0D10] border border-white/10 focus-within:border-indigo-500/60 rounded-xl p-1 transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Pergunte ao Vito ou digite um comando..."
            className="flex-1 bg-transparent px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
          />

          <button
            onClick={handleToggleRecord}
            className={`p-1.5 rounded-lg transition-colors ${
              isRecording
                ? 'bg-rose-500 text-white animate-pulse'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title="Gravar áudio com Whisper"
          >
            <Mic size={16} />
          </button>

          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white disabled:opacity-30 disabled:hover:bg-indigo-600 transition-colors ml-1"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
