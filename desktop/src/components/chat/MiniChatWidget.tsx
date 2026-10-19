import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { ChatMessage } from '../../types';
import { VitoMascot } from '../common/VitoMascot';
import { FocusMenu, FocusMode } from './FocusMenu';
import {
  X,
  Maximize2,
  Calendar,
  Crosshair,
  CalendarDays,
  Target,
  History,
  Send,
  Mic,
  Plus,
  Loader2,
} from 'lucide-react';

interface MiniChatWidgetProps {
  onExpandToFullChat: (initialPrompt?: string) => void;
}

export const MiniChatWidget: React.FC<MiniChatWidgetProps> = ({ onExpandToFullChat }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFocus, setSelectedFocus] = useState<FocusMode | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, loading]);

  const handleSendPrompt = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setLoading(true);

    try {
      const contextPayload: any = {
        history: messages.slice(-6).map((m) => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text,
        })),
      };

      if (selectedFocus) {
        contextPayload.focus_mode = selectedFocus.id;
        contextPayload.system_instruction_override = `Foco ativo: ${selectedFocus.title} - ${selectedFocus.description}.`;
      }

      const res = await api.askAssistant(textToSend, contextPayload);
      const vitoMsg: ChatMessage = {
        id: `vito-${Date.now()}`,
        sender: 'vito',
        text: res.reply || 'Instrução recebida com sucesso.',
        timestamp: new Date().toISOString(),
        todo: res.todo,
        event: res.event,
      };

      setMessages((prev) => [...prev, vitoMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `vito-error-${Date.now()}`,
        sender: 'vito',
        text: `Erro ao conectar: ${err.message || 'Verifique sua conexão.'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const quickSuggestions = [
    {
      icon: Calendar,
      title: 'Planejar meu dia',
      prompt: 'Vito, por favor me ajude a planejar o meu dia de hoje com base na agenda e tarefas pendentes.',
    },
    {
      icon: Crosshair,
      title: 'Encontrar tempo de foco',
      prompt: 'Vito, analise meus horários livres hoje e amanhã e encontre um bloco de foco de 2 horas para trabalho profundo.',
    },
    {
      icon: CalendarDays,
      title: 'Planejar esta semana',
      prompt: 'Vito, prepare um plano executivo para a minha semana com os principais compromissos e prioridades.',
    },
    {
      icon: Target,
      title: 'Transforme um objetivo em um plano',
      prompt: 'Vito, tenho um objetivo que quero estruturar em um plano acionável de etapas.',
    },
  ];

  return (
    <>
      {/* Botão Flutuante Circular com a Mascote no Canto Inferior Direito */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-white dark:bg-[#14171C] border-2 border-zinc-200 dark:border-[#222730] shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 flex items-center justify-center transition-all group"
          title="Abrir Vito Mini Chat"
        >
          <VitoMascot size={34} className="group-hover:scale-110 transition-transform" />
          <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#10B981] border-2 border-white dark:border-[#14171C]" />
        </button>
      )}

      {/* Widget Flutuante de Mini Chat (Estilo Toki) */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[410px] max-w-[calc(100vw-32px)] h-[570px] max-h-[calc(100vh-48px)] bg-white/95 dark:bg-[#14171C]/95 backdrop-blur-xl border border-zinc-200/90 dark:border-[#222730] rounded-[32px] shadow-2xl flex flex-col overflow-hidden text-zinc-900 dark:text-[#FAFAFA] transition-all animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="h-14 px-5 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between shrink-0">
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
              title="Fechar mini chat"
            >
              <X size={17} />
            </button>

            {/* Avatar Central com Mascote */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-[#1C2026] border border-zinc-200 dark:border-[#262B33] flex items-center justify-center">
                <VitoMascot size={22} />
              </div>
              <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1 leading-none mt-0.5">
                vito
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              </span>
            </div>

            <button
              onClick={() => {
                setOpen(false);
                onExpandToFullChat();
              }}
              className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
              title="Expandir para tela cheia de chat"
            >
              <Maximize2 size={16} />
            </button>
          </div>

          {/* Corpo do Mini Chat */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {messages.length === 0 ? (
              <div className="space-y-4 pt-2">
                <div className="text-center space-y-1">
                  <h4 className="text-base font-bold text-zinc-900 dark:text-white">
                    Olá {user?.name ? user.name.toUpperCase() : 'ANDRÉ VICTOR'}!
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Como posso ajudá-lo hoje?
                  </p>
                </div>

                {/* Lista de Sugestões de Ação Rápidas */}
                <div className="space-y-2 pt-2">
                  {quickSuggestions.map((sug, idx) => {
                    const Icon = sug.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSendPrompt(sug.prompt)}
                        className="w-full p-3 rounded-2xl bg-zinc-50 hover:bg-zinc-100 dark:bg-[#0B0D10]/60 dark:hover:bg-[#1C2026] border border-zinc-200/80 dark:border-[#222730] flex items-center justify-between text-left transition-all group shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon size={16} className="text-zinc-500 dark:text-zinc-400 group-hover:text-indigo-500 transition-colors" />
                          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                            {sug.title}
                          </span>
                        </div>
                        <span className="text-zinc-400 group-hover:translate-x-0.5 transition-transform text-xs">
                          ›
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Link para Histórico de Chat */}
                <div className="pt-2 text-center">
                  <button
                    onClick={() => {
                      setOpen(false);
                      onExpandToFullChat();
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
                  >
                    <History size={13} />
                    <span>Histórico de chat</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                {messages.map((m) => {
                  const isUser = m.sender === 'user';
                  return (
                    <div
                      key={m.id}
                      className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-[#1C2026] border border-zinc-200 dark:border-[#222730] flex items-center justify-center shrink-0 mt-0.5">
                          <VitoMascot size={16} />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                          isUser
                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-[#09090B] font-medium'
                            : 'bg-zinc-100 dark:bg-[#0B0D10] text-zinc-900 dark:text-[#FAFAFA] border border-zinc-200 dark:border-[#222730]'
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })}

                {loading && (
                  <div className="flex items-center gap-2 text-xs text-zinc-400 p-2">
                    <Loader2 size={13} className="animate-spin" />
                    <span>Vito está digitando...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Dock Toki Style */}
          <div className="p-3 bg-zinc-50/80 dark:bg-[#0E1014]/80 border-t border-zinc-200/80 dark:border-[#222730] shrink-0">
            <div className="rounded-2xl bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] p-2.5 shadow-sm">
              <div className="flex items-center gap-2 px-1 pb-1.5">
                <button
                  type="button"
                  className="p-1 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                  title="Anexar"
                >
                  <Plus size={14} />
                </button>
                <FocusMenu selectedFocus={selectedFocus} onSelectFocus={setSelectedFocus} />
              </div>

              <div className="flex items-end gap-2">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendPrompt(inputValue);
                    }
                  }}
                  rows={2}
                  placeholder="Diga ao Vito o que você precisa..."
                  disabled={loading}
                  className="flex-1 bg-transparent border-none text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none resize-none px-1.5 py-1 leading-relaxed"
                />

                <div className="flex items-center gap-1 pb-1 shrink-0">
                  <button
                    type="button"
                    className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                    title="Voz"
                  >
                    <Mic size={15} />
                  </button>
                  <button
                    onClick={() => handleSendPrompt(inputValue)}
                    disabled={!inputValue.trim() || loading}
                    className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-[#09090B] disabled:opacity-30 transition-all shadow-xs"
                    title="Enviar"
                  >
                    {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
