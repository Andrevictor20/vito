import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../hooks';
import { ChatMessage, ConversationSession } from '../../types';
import { VitoMascot } from '../common/VitoMascot';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import { FocusMode } from './FocusMenu';
import { WhatsAppMessageCard } from './WhatsAppMessageCard';
import { GmailMessageCard } from './GmailMessageCard';
import { ChatThinkingIndicator } from './ChatThinkingIndicator';
import { ChatInputDock } from './ChatInputDock';
import { ChatIdeasDeck } from './ChatIdeasDeck';
import { FormattedChatMessageText } from './FormattedChatMessageText';
import { ChatMessageActionBar } from './ChatMessageActionBar';
import { ChatStructuredCards } from './cards/ChatStructuredCards';
import { toChatGmailMessage, toChatWhatsAppMessage } from '../../utils/chatCardExtractors';
import { pickWelcomeGreeting } from '../../utils/chatGreetings';
import {
  PanelLeftClose,
  PanelLeft,
  Plus,
} from 'lucide-react';

interface ChatViewProps {
  initialPrompt?: string;
  onNavigateTab?: (tab: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ initialPrompt, onNavigateTab }) => {
  const { user } = useAuth();
  const {
    conversations,
    setConversations,
    activeSessionId,
    setActiveSessionId,
    loadSessions,
    loadSessionWithMessages,
    deleteChatSession,
    askAssistant,
    syncChatSession,
    togglePinConversation,
  } = useChat({ currentUserId: user?.id });

  const [historyOpen, setHistoryOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const welcomeGreeting = React.useMemo(() => {
    const firstName = user?.name ? user.name.split(' ')[0] : undefined;
    return pickWelcomeGreeting(firstName, new Date().getHours());
  }, [user?.name]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      handleSendPrompt(initialPrompt.trim(), null);
    }
  }, [initialPrompt]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleSelectConversation = async (id: string) => {
    setActiveSessionId(id);
    try {
      const detailed = await loadSessionWithMessages(id);
      if (detailed && detailed.messages) {
        setMessages(detailed.messages);
      }
    } catch (err) {
      console.error('Erro ao carregar conversa:', err);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    if (!confirm('Deseja excluir esta conversa do histórico?')) return;
    try {
      await deleteChatSession(id);
      if (activeSessionId === id) {
        handleStartNewChat();
      }
    } catch (err) {
      console.error('Erro ao excluir conversa:', err);
    }
  };

  const handleTogglePin = (id: string) => {
    togglePinConversation(id);
  };

  const handleSendPrompt = async (textToSend: string, focus: FocusMode | null = null) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const historyPayload = messages.slice(-8).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const contextPayload: any = {
        history: historyPayload,
      };

      if (focus) {
        contextPayload.focus_mode = focus.id;
        contextPayload.system_instruction_override = `Foco ativo do usuário: ${focus.title} - ${focus.description}.`;
      }

      const res = await askAssistant(textToSend, contextPayload);
      const vitoMsg: ChatMessage = {
        id: `vito-${Date.now()}`,
        sender: 'vito',
        text: res.reply || res.message || 'Instrução recebida e processada com sucesso.',
        timestamp: new Date().toISOString(),
        todo: res.todo,
        event: res.event,
        trigger: res.trigger,
        booking: res.booking,
        whatsapp_message: toChatWhatsAppMessage(res, textToSend),
        gmail_message: toChatGmailMessage(res, textToSend),
      };

      const updated = [...messages, userMsg, vitoMsg];
      setMessages(updated);

      const sessionTitle = textToSend.slice(0, 36) + (textToSend.length > 36 ? '...' : '');
      const newSession: ConversationSession = {
        id: activeSessionId || `session-${Date.now()}`,
        title: sessionTitle,
        preview: vitoMsg.text.slice(0, 50),
        timestamp: new Date().toISOString(),
      };

      if (!activeSessionId) {
        setActiveSessionId(newSession.id);
        setConversations((prev) => [newSession, ...prev]);
      }

      await syncChatSession(newSession, updated);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `vito-error-${Date.now()}`,
        sender: 'vito',
        text: `Desculpe, ocorreu uma instabilidade ao conectar ao servidor: ${err.message || 'Verifique sua conexão.'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmEmail = (updated: any) => {
    handleSendPrompt(
      `Enviar e-mail para ${updated.recipient_email} com assunto "${updated.subject}": "${updated.body}"`,
      null
    );
  };

  const handleConfirmWhatsApp = (updated: any) => {
    handleSendPrompt(
      `Enviar mensagem WhatsApp para ${updated.recipient_name}: "${updated.message}"`,
      null
    );
  };

  const handleStartNewChat = () => {
    setActiveSessionId('');
    setMessages([]);
  };

  return (
    <div className="flex-1 h-screen flex bg-[#FAFAFA] dark:bg-[#0B0D10] text-[#17191b] dark:text-[#f1f3f2] overflow-hidden select-none transition-colors duration-200">
      {/* Drawer de Histórico no estilo Toki / Mobile */}
      {historyOpen && (
        <ChatHistoryPanel
          conversations={conversations}
          activeSessionId={activeSessionId}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onTogglePin={handleTogglePin}
          onNewChat={handleStartNewChat}
        />
      )}

      {/* Workspace Principal de Conversa */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top Header Minimalista Estilo Gemini / Claude */}
        <header className="h-14 px-6 border-b border-zinc-200/70 dark:border-[#1E2228] flex items-center justify-between bg-white/80 dark:bg-[#0B0D10]/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
              title={historyOpen ? 'Ocultar histórico' : 'Mostrar histórico'}
            >
              {historyOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
            </button>

            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-[#17191b] dark:text-[#f1f3f2]">vito</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-zinc-100 dark:bg-[#181C20] text-zinc-500 dark:text-zinc-400 border border-zinc-200/60 dark:border-white/5">
                Executivo
              </span>
            </div>
          </div>

          <button
            onClick={handleStartNewChat}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-[#181C20] dark:hover:bg-[#22272E] border border-zinc-200 dark:border-[#222730] text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors shadow-2xs"
          >
            <Plus size={14} />
            <span>Nova Conversa</span>
          </button>
        </header>

        {/* Main Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 scroll-smooth flex flex-col">
          {messages.length === 0 ? (
            /* Mobile-Identical Empty State com Mascote Animado e Carrossel 3D de Ideias */
            <div className="max-w-3xl lg:max-w-4xl mx-auto my-auto w-full flex flex-col items-center justify-center text-center space-y-3 py-4">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[28px] bg-white dark:bg-[#191c1e] border border-zinc-200 dark:border-[#262B33] flex items-center justify-center shadow-lg p-2 hover:scale-105 transition-all duration-300">
                <VitoMascot size={80} animated={true} state={loading ? 'thinking' : 'idle'} />
              </div>
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl tracking-tight text-[#17191b] dark:text-[#f1f3f2] max-w-2xl leading-tight">
                {welcomeGreeting}
              </h1>
              <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto">
                Toque numa sugestão abaixo ou me diga o que precisa
              </p>

              {/* Carrossel 3D de Ideias Canônico do Mobile */}
              <ChatIdeasDeck
                onUseIdea={(prompt) => handleSendPrompt(prompt, null)}
                disabled={loading}
              />
            </div>
          ) : (
            /* Stream Editorial Borderless Estilo Claude / Gemini (Largura Consistente max-w-3xl/4xl) */
            <div className="max-w-3xl lg:max-w-4xl mx-auto w-full flex-1 flex flex-col justify-start space-y-7 pb-6">
              {messages.map((msg) => {
                const isUser = msg.sender === 'user';
                if (isUser) {
                  return (
                    <div key={msg.id} className="flex justify-end w-full">
                      <div className="max-w-[85%] sm:max-w-[75%] md:max-w-[70%] rounded-[24px] px-5 py-3.5 bg-[#F0F2F1] dark:bg-[#1E2024] text-[#17191b] dark:text-[#f1f3f2] border border-black/5 dark:border-white/5 shadow-2xs">
                        <div className="text-[15px] sm:text-base leading-relaxed whitespace-pre-wrap font-sans">
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className="w-full flex flex-col space-y-3 pt-1">
                    {/* Texto Editorial Borderless (Sem balão, sem avatar lateral, leitura fluida como Claude/Gemini) */}
                    <div className="text-[15.5px] sm:text-base text-[#17191b] dark:text-[#f1f3f2] leading-relaxed">
                      <FormattedChatMessageText text={msg.text} isUser={false} />
                    </div>

                    {/* Cards Estruturados Modulares Canônicos na Largura Total */}
                    {msg.gmail_message && (
                      <GmailMessageCard
                        messageData={msg.gmail_message}
                        onConfirmSend={handleConfirmEmail}
                      />
                    )}

                    {msg.whatsapp_message && (
                      <WhatsAppMessageCard
                        messageData={msg.whatsapp_message}
                        onConfirmSend={handleConfirmWhatsApp}
                      />
                    )}

                    <ChatStructuredCards
                      message={msg}
                      onNavigateTab={onNavigateTab}
                      onConfirmAction={(pendingID) => {
                        handleSendPrompt(`confirmar ${pendingID}`);
                      }}
                    />

                    {/* Barra de Ações Minimalista Estilo Claude / Gemini */}
                    <ChatMessageActionBar
                      messageText={msg.text}
                      timestamp={msg.timestamp}
                    />
                  </div>
                );
              })}

              {/* Indicador de Pensamento Ancorado sem Avatar Lateral (Estilo Claude / Gemini) */}
              {loading && (
                <div className="w-full pt-2">
                  <ChatThinkingIndicator />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Dock Toki / Claude Style (Centrado na Mesma Largura das Mensagens) */}
        <div className="p-4 sm:p-6 bg-transparent shrink-0">
          <div className="max-w-3xl lg:max-w-4xl mx-auto w-full">
            <ChatInputDock onSendMessage={handleSendPrompt} loading={loading} />

            <div className="mt-2.5 text-center text-[11px] sm:text-[11.5px] text-zinc-400 dark:text-zinc-500 font-sans select-none tracking-normal">
              O Vito pode cometer erros. Verifique informações importantes.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
