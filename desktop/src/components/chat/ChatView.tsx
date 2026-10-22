import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { ChatMessage, ConversationSession } from '../../types';
import { VitoMascot } from '../common/VitoMascot';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import { FocusMenu, FocusMode } from './FocusMenu';
import { ChatQuickChips } from './ChatQuickChips';
import { pickWelcomeGreeting } from '../../utils/chatGreetings';
import {
  Send,
  Mic,
  Plus,
  Calendar,
  Loader2,
  Circle,
  Copy,
  Check,
  PanelLeftClose,
  PanelLeft,
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
  const [selectedFocus, setSelectedFocus] = useState<FocusMode | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const welcomeGreeting = React.useMemo(() => {
    const firstName = user?.name ? user.name.split(' ')[0] : undefined;
    return pickWelcomeGreeting(firstName, new Date().getHours());
  }, [user?.name]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      handleSendPrompt(initialPrompt.trim());
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
      const historyPayload = messages.slice(-8).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const contextPayload: any = {
        history: historyPayload,
      };

      if (selectedFocus) {
        contextPayload.focus_mode = selectedFocus.id;
        contextPayload.system_instruction_override = `Foco ativo do usuário: ${selectedFocus.title} - ${selectedFocus.description}.`;
      }

      const res = await api.askAssistant(textToSend, contextPayload);
      const vitoMsg: ChatMessage = {
        id: `vito-${Date.now()}`,
        sender: 'vito',
        text: res.reply || 'Instrução recebida e processada com sucesso.',
        timestamp: new Date().toISOString(),
        todo: res.todo,
        event: res.event,
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

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendPrompt(inputValue);
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
    <div className="flex-1 h-screen flex bg-[#F8F9FA] dark:bg-[#0B0D10] text-zinc-900 dark:text-[#FAFAFA] overflow-hidden select-none transition-colors duration-200">
      {/* Drawer de Histórico no estilo Toki / Mobile */}
      {historyOpen && (
        <ChatHistoryPanel
          conversations={conversations}
          activeSessionId={activeSessionId}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
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
                  <span className="text-sm font-extrabold tracking-tight text-zinc-900 dark:text-white">vito</span>
                  <span className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981] animate-pulse" />
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
          {/* Mobile-Identical Empty State: Limpo, centralizado, mascote Vito e saudação sem emojis */}
          {messages.length === 0 && (
            <div className="my-auto py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-zinc-100 dark:bg-[#1C2026] border border-zinc-200 dark:border-[#262B33] flex items-center justify-center shadow-md">
                <VitoMascot size={64} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white max-w-xl">
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
                  // User message: bubble on the right
                  <div className="max-w-[85%] rounded-[26px] p-6 transition-all shadow-sm bg-zinc-900 dark:bg-[#1C2026] text-white border border-transparent dark:border-[#262B33] rounded-tr-md">
                    <div className="text-base leading-relaxed whitespace-pre-wrap font-sans">
                      {msg.text}
                    </div>

                    {/* Inline Actionable Cards */}
                    {msg.todo && (
                      <div 
                        onClick={() => onNavigateTab?.('tasks')}
                        className="mt-3.5 p-3.5 rounded-xl bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] flex items-center justify-between gap-3 cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
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
                        className="mt-3.5 p-3.5 rounded-xl bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] flex items-center justify-between gap-3 cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Calendar size={16} className="text-indigo-500 shrink-0" />
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

                    {/* Footer with timestamp and copy */}
                    <div className="mt-3.5 pt-2.5 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
                      <span className="font-mono">{msg.timestamp}</span>

                      <button
                        onClick={() => handleCopyText(msg.id, msg.text)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1.5 py-0.5 px-2 rounded hover:bg-zinc-100 dark:hover:bg-white/5"
                        title="Copiar texto"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check size={13} className="text-[#10B981]" />
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
                ) : (
                  // Vito response: plain text/markdown flowing on the left, no bubble
                  <div className="max-w-[85%] px-2">
                    <div className="text-base leading-relaxed whitespace-pre-wrap font-sans text-zinc-900 dark:text-[#FAFAFA] prose prose-zinc dark:prose-invert max-w-none">
                      {msg.text}
                    </div>

                    {/* Inline Actionable Cards for Vito responses */}
                    {msg.todo && (
                      <div 
                        onClick={() => onNavigateTab?.('tasks')}
                        className="mt-3.5 p-3.5 rounded-xl bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] flex items-center justify-between gap-3 cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
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
                        className="mt-3.5 p-3.5 rounded-xl bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] flex items-center justify-between gap-3 cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Calendar size={16} className="text-indigo-500 shrink-0" />
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

                    {/* Footer with timestamp and copy for Vito messages */}
                    <div className="mt-3.5 pt-2.5 border-t border-black/5 dark:border-white/5 flex items-center justify-start text-xs text-zinc-400 dark:text-zinc-500 gap-3">
                      <span className="font-mono">{msg.timestamp}</span>

                      <button
                        onClick={() => handleCopyText(msg.id, msg.text)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1.5 py-0.5 px-2 rounded hover:bg-zinc-100 dark:hover:bg-white/5"
                        title="Copiar texto"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check size={13} className="text-[#10B981]" />
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

          {/* Typing Indicator */}
          {loading && (
            <div className="flex gap-4 items-start">
              <div className="max-w-[85%] px-2">
                <div className="p-4 rounded-[22px] bg-zinc-100 dark:bg-[#1C2026] border border-zinc-200 dark:border-[#262B33] flex items-center gap-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 shadow-xs animate-pulse">
                  <Loader2 size={16} className="animate-spin text-zinc-900 dark:text-white" />
                  <span>Vito está processando...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Dock */}
      <div className="p-5 bg-white/90 dark:bg-[#0B0D10]/90 border-t border-zinc-200/80 dark:border-[#222730] backdrop-blur-md">
        <div className="max-w-6xl mx-auto">
          {/* Chips Rápidos de Sugestões Executivas (Início do Chat) */}
          {messages.length <= 2 && (
            <div className="mb-3">
              <ChatQuickChips onSelectPrompt={handleSendPrompt} disabled={loading} />
            </div>
          )}

          {/* Input Dock com Botão Foco em */}
          <div className="rounded-[26px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] p-3.5 shadow-md focus-within:border-zinc-400 dark:focus-within:border-zinc-500 transition-all">
            <div className="flex items-center gap-2.5 px-1.5 pb-2">
              <button
                type="button"
                className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                title="Anexar arquivo ou imagem"
              >
                <Plus size={17} />
              </button>

              {/* Botão Foco em */}
              <FocusMenu selectedFocus={selectedFocus} onSelectFocus={setSelectedFocus} />
            </div>

            <div className="flex items-end gap-3">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleFormSubmit(e);
                  }
                }}
                rows={2}
                placeholder="Diga ao Vito o que você precisa..."
                disabled={loading}
                className="flex-1 bg-transparent border-none text-base text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none resize-none px-2 py-1 leading-relaxed"
              />

              <div className="flex items-center gap-2 pb-1 shrink-0">
                <button
                  type="button"
                  className="p-2.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
                  title="Comando de voz (Whisper)"
                >
                  <Mic size={20} />
                </button>

                <button
                  onClick={handleFormSubmit}
                  disabled={!inputValue.trim() || loading}
                  className="p-3 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-[#09090B] disabled:opacity-30 shadow-sm transition-all"
                  title="Enviar mensagem (Enter)"
                >
                  {loading ? <Loader2 size={17} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};
