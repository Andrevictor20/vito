import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { ChatMessage, ConversationSession } from '../../types';
import { VitoMascot } from '../common/VitoMascot';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import { FocusMode } from './FocusMenu';
import { ChatQuickChips } from './ChatQuickChips';
import { WhatsAppMessageCard } from './WhatsAppMessageCard';
import { GmailMessageCard } from './GmailMessageCard';
import { ChatThinkingIndicator } from './ChatThinkingIndicator';
import { ChatInputDock } from './ChatInputDock';
import { pickWelcomeGreeting } from '../../utils/chatGreetings';
import {
  Calendar,
  Circle,
  Copy,
  Check,
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
  const [conversations, setConversations] = useState<ConversationSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>();
  const [historyOpen, setHistoryOpen] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
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

  const loadSessions = async () => {
    try {
      const data = await api.getChatSessions();
      setConversations(data);
    } catch (err) {
      console.warn('Falha ao carregar sessões de chat:', err);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleSelectConversation = async (id: string) => {
    setActiveSessionId(id);
    try {
      const detailed = await api.getChatSessionWithMessages(id);
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
      await api.deleteChatSession(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeSessionId === id) {
        handleStartNewChat();
      }
    } catch (err) {
      console.error('Erro ao excluir conversa:', err);
    }
  };

  const handleTogglePin = (id: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, pinned: !c.pinned, timestamp: new Date().toISOString() } : c
      )
    );
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

      const res = await api.askAssistant(textToSend, contextPayload);
      const vitoMsg: ChatMessage = {
        id: `vito-${Date.now()}`,
        sender: 'vito',
        text: res.reply || res.message || 'Instrução recebida e processada com sucesso.',
        timestamp: new Date().toISOString(),
        todo: res.todo,
        event: res.event,
        trigger: res.trigger,
        booking: res.booking,
        whatsapp_message: res.whatsapp_message,
        gmail_message: res.gmail_message,
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

      await api.syncChatSession(newSession, updated);
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

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStartNewChat = () => {
    setActiveSessionId(undefined);
    setMessages([]);
  };

  return (
    <div className="flex-1 h-screen flex bg-[#F8F9FA] dark:bg-[#0B0D10] text-[#17191b] dark:text-[#f1f3f2] overflow-hidden select-none transition-colors duration-200">
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
        {/* Top Header Minimalista com Avatar Oficial do Vito */}
        <header className="h-16 px-6 border-b border-zinc-200/80 dark:border-[#222730] flex items-center justify-between bg-white/70 dark:bg-[#14171C]/70 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
              title={historyOpen ? 'Ocultar histórico' : 'Mostrar histórico'}
            >
              {historyOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-[#1C2026] border border-zinc-200 dark:border-[#262B33] flex items-center justify-center shadow-xs">
                <VitoMascot size={26} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-sm font-extrabold tracking-tight text-[#17191b] dark:text-[#f1f3f2]">vito</span>
                  <span className="w-2 h-2 rounded-full bg-[#00E599] shadow-[0_0_8px_#00E599] animate-pulse" />
                </div>
                <span className="text-[10px] text-zinc-400 font-medium mt-0.5">Assistente Executivo</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleStartNewChat}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1C2026] dark:hover:bg-[#262B33] border border-zinc-200 dark:border-[#222730] text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors shadow-xs"
          >
            <Plus size={15} />
            <span>Nova Conversa</span>
          </button>
        </header>

        {/* Main Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto px-6 py-8 scroll-smooth flex flex-col">
          <div className="max-w-6xl mx-auto space-y-7 flex-1 w-full flex flex-col justify-center">
            {/* Mobile-Identical Empty State */}
            {messages.length === 0 && (
              <div className="my-auto py-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-20 h-20 rounded-3xl bg-zinc-100 dark:bg-[#1C2026] border border-zinc-200 dark:border-[#262B33] flex items-center justify-center shadow-md">
                  <VitoMascot size={64} />
                </div>
                <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17191b] dark:text-[#f1f3f2] max-w-xl">
                  {welcomeGreeting}
                </h1>
                <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                  Clique numa sugestão abaixo ou me diga o que precisa
                </p>
              </div>
            )}

            {/* Messages Stream */}
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-4 group ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {isUser ? (
                    <div className="max-w-[85%] rounded-[24px] p-5 transition-all shadow-sm bg-[#17191b] dark:bg-[#1C2026] text-white border border-transparent dark:border-[#262B33] rounded-tr-md">
                      <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-sans">
                        {msg.text}
                      </div>
                      <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-end text-[11px] text-zinc-400">
                        <span className="font-mono">{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-[85%] px-2">
                      <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-sans text-[#17191b] dark:text-[#f1f3f2]">
                        {msg.text}
                      </div>

                      {/* Inline Actionable Cards */}
                      {msg.todo && (
                        <div
                          onClick={() => onNavigateTab?.('tasks')}
                          className="mt-3.5 p-3.5 rounded-xl bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] flex items-center justify-between gap-3 cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors shadow-sm"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Circle size={16} className="text-zinc-400 shrink-0" />
                            <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                              {msg.todo.title}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase shrink-0">
                            {msg.todo.priority || 'MÉDIA'}
                          </span>
                        </div>
                      )}

                      {msg.event && (
                        <div
                          onClick={() => onNavigateTab?.('calendar')}
                          className="mt-3.5 p-3.5 rounded-xl bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] flex items-center justify-between gap-3 cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors shadow-sm"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Calendar size={16} className="text-[#2b7fd4] shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                                {msg.event.title}
                              </p>
                              <p className="text-[10px] text-zinc-400">
                                {new Date(msg.event.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase shrink-0">
                            {msg.event.category || 'EVENTO'}
                          </span>
                        </div>
                      )}

                      {msg.whatsapp_message && (
                        <WhatsAppMessageCard messageData={msg.whatsapp_message} />
                      )}

                      {msg.gmail_message && (
                        <GmailMessageCard messageData={msg.gmail_message} />
                      )}

                      {/* Footer with copy button */}
                      <div className="mt-3 pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-start text-xs text-zinc-400 gap-3">
                        <span className="font-mono text-[11px]">{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        <button
                          onClick={() => handleCopyText(msg.id, msg.text)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1.5 py-0.5 px-2 rounded hover:bg-zinc-100 dark:hover:bg-white/5"
                          title="Copiar resposta"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check size={13} className="text-[#00E599]" />
                              <span>Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy size={13} />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-4 items-start">
                <div className="max-w-[85%]">
                  <ChatThinkingIndicator />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Dock (Memoizado contra digitação) */}
        <div className="p-5 bg-white/90 dark:bg-[#0B0D10]/90 border-t border-zinc-200/80 dark:border-[#222730] backdrop-blur-md">
          <div className="max-w-6xl mx-auto">
            {messages.length <= 2 && (
              <div className="mb-3">
                <ChatQuickChips onSelectPrompt={(p) => handleSendPrompt(p, null)} disabled={loading} />
              </div>
            )}

            <ChatInputDock onSendMessage={handleSendPrompt} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  );
};
