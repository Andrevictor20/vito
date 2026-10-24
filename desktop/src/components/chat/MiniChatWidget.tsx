import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { ChatMessage } from '../../types';
import { VitoMascot } from '../common/VitoMascot';
import { FocusMenu, FocusMode } from './FocusMenu';
import { ChatIdeasDeck } from './ChatIdeasDeck';
import { FormattedChatMessageText } from './FormattedChatMessageText';
import { ChatThinkingIndicator } from './ChatThinkingIndicator';
import { TodoInlineCard } from './cards/TodoInlineCard';
import { EventInlineCard } from './cards/EventInlineCard';
import { WhatsAppMessageCard } from './WhatsAppMessageCard';
import { GmailMessageCard } from './GmailMessageCard';
import { toChatGmailMessage, toChatWhatsAppMessage } from '../../utils/chatCardExtractors';
import {
  X,
  Maximize2,
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
        whatsapp_message: toChatWhatsAppMessage(res, textToSend),
        gmail_message: toChatGmailMessage(res, textToSend),
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

  const handleConfirmEmail = (updated: any) => {
    handleSendPrompt(
      `Enviar e-mail para ${updated.recipient_email} com assunto "${updated.subject}": "${updated.body}"`
    );
  };

  const handleConfirmWhatsApp = (updated: any) => {
    handleSendPrompt(
      `Enviar mensagem WhatsApp para ${updated.recipient_name}: "${updated.message}"`
    );
  };

  return (
    <>
      {/* Botão Flutuante Circular com a Mascote no Canto Inferior Direito (Aumentado para Desktop) */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-8 right-8 z-40 w-24 h-24 rounded-full bg-white dark:bg-[#14171C] border-2 border-zinc-200 dark:border-[#222730] shadow-2xl hover:shadow-[0_16px_50px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 flex items-center justify-center transition-all group"
          title="Abrir Vito Mini Chat"
        >
          <VitoMascot size={64} animated={true} className="group-hover:scale-105 transition-transform" />
          <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#10B981] border-[3px] border-white dark:border-[#14171C] shadow-[0_0_12px_#10B981] animate-pulse" />
        </button>
      )}

      {/* Widget Flutuante de Mini Chat Ampliado para Desktop */}
      {open && (
        <div className="fixed bottom-8 right-8 z-50 w-[580px] xl:w-[640px] max-w-[calc(100vw-48px)] h-[760px] xl:h-[820px] max-h-[calc(100vh-64px)] bg-white/95 dark:bg-[#14171C]/95 backdrop-blur-xl border border-zinc-200/90 dark:border-[#222730] rounded-[38px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden text-zinc-900 dark:text-[#FAFAFA] transition-all animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header Ampliado */}
          <div className="h-18 px-6 sm:px-7 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between shrink-0">
            <button
              onClick={() => setOpen(false)}
              className="p-2.5 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
              title="Fechar mini chat"
            >
              <X size={20} />
            </button>

            {/* Avatar Central com Mascote */}
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-[#1C2026] border border-zinc-200 dark:border-[#262B33] flex items-center justify-center shadow-xs">
                <VitoMascot size={32} animated={true} />
              </div>
              <span className="text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 leading-none mt-1">
                vito
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]" />
              </span>
            </div>

            <button
              onClick={() => {
                setOpen(false);
                onExpandToFullChat();
              }}
              className="p-2.5 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
              title="Expandir para tela cheia de chat"
            >
              <Maximize2 size={20} />
            </button>
          </div>

          {/* Corpo do Mini Chat */}
          <div className="flex-1 overflow-y-auto px-6 sm:px-7 py-6 space-y-5">
            {messages.length === 0 ? (
              <div className="space-y-6 pt-2">
                <div className="text-center space-y-2">
                  <h4 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                    Olá {user?.name ? user.name.toUpperCase() : 'ANDRÉ VICTOR'}!
                  </h4>
                  <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400">
                    Como posso ajudá-lo hoje?
                  </p>
                </div>

                {/* Cards Canônicos do Mobile Importados 1:1 */}
                <ChatIdeasDeck
                  compact={true}
                  onUseIdea={handleSendPrompt}
                  disabled={loading}
                />

                {/* Link para Histórico de Chat */}
                <div className="pt-2 text-center">
                  <button
                    onClick={() => {
                      setOpen(false);
                      onExpandToFullChat();
                    }}
                    className="inline-flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors py-1 px-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5"
                  >
                    <History size={17} />
                    <span>Abrir Histórico de Chat</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((m) => {
                  const isUser = m.sender === 'user';
                  if (isUser) {
                    return (
                      <div key={m.id} className="flex justify-end w-full">
                        <div className="max-w-[85%] rounded-[22px] px-4.5 py-3 bg-[#F0F2F1] dark:bg-[#1E2024] border border-black/5 dark:border-white/5 text-[#17191b] dark:text-[#f1f3f2] shadow-2xs">
                          <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
                            {m.text}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={m.id} className="w-full flex flex-col space-y-2.5 pt-1">
                      <div className="text-sm sm:text-[14.5px] leading-relaxed text-[#17191b] dark:text-[#f1f3f2]">
                        <FormattedChatMessageText text={m.text} isUser={false} />
                      </div>

                      {/* Cards Estruturados Inline */}
                      {m.gmail_message && (
                        <GmailMessageCard
                          messageData={m.gmail_message}
                          onConfirmSend={handleConfirmEmail}
                        />
                      )}

                      {m.whatsapp_message && (
                        <WhatsAppMessageCard
                          messageData={m.whatsapp_message}
                          onConfirmSend={handleConfirmWhatsApp}
                        />
                      )}

                      {m.todo && (
                        <TodoInlineCard
                          todo={m.todo}
                          onNavigateTab={() => {
                            setOpen(false);
                            onExpandToFullChat();
                          }}
                        />
                      )}

                      {m.event && (
                        <EventInlineCard
                          event={m.event}
                          onNavigateTab={() => {
                            setOpen(false);
                            onExpandToFullChat();
                          }}
                        />
                      )}

                      <div className="pt-1 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                        <span>{m.timestamp ? new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(m.text)}
                          className="hover:text-zinc-600 dark:hover:text-zinc-300 font-sans"
                        >
                          Copiar
                        </button>
                      </div>
                    </div>
                  );
                })}

                {loading && (
                  <div className="w-full pt-1">
                    <ChatThinkingIndicator />
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Dock Toki Style Ampliado */}
          <div className="p-4 sm:p-5 bg-zinc-50/80 dark:bg-[#0E1014]/80 border-t border-zinc-200/80 dark:border-[#222730] shrink-0">
            <div className="rounded-[24px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] p-3.5 sm:p-4 shadow-sm">
              <div className="flex items-center gap-2.5 px-1 pb-2.5">
                <button
                  type="button"
                  className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                  title="Anexar"
                >
                  <Plus size={18} />
                </button>
                <FocusMenu selectedFocus={selectedFocus} onSelectFocus={setSelectedFocus} />
              </div>

              <div className="flex items-end gap-2.5">
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
                  className="flex-1 bg-transparent border-none text-sm sm:text-base text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none resize-none px-1.5 py-1 leading-relaxed"
                />

                <div className="flex items-center gap-2 pb-1 shrink-0">
                  <button
                    type="button"
                    className="p-2.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                    title="Voz"
                  >
                    <Mic size={19} />
                  </button>
                  <button
                    onClick={() => handleSendPrompt(inputValue)}
                    disabled={!inputValue.trim() || loading}
                    className="p-3 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-[#09090B] disabled:opacity-30 transition-all shadow-xs"
                    title="Enviar"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
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
