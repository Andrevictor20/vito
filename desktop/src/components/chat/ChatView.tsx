import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, PanelLeft, PanelLeftClose, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAiProviders, useChat } from '../../hooks';
import type { AiReasoningEffort, ChatMessage, ConversationSession } from '../../types';
import { toChatGmailMessage, toChatWhatsAppMessage } from '../../utils/chatCardExtractors';
import { getResolvedModelDisplay, resolveModelRef } from '../ai/aiProvidersCatalog';
import { ModelPickerModal } from '../ai/ModelPickerModal';
import { VitoMascot } from '../common/VitoMascot';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import { ChatIdeasDeck } from './ChatIdeasDeck';
import { ChatInputDock } from './ChatInputDock';
import { ChatMessageActionBar } from './ChatMessageActionBar';
import { ChatThinkingIndicator } from './ChatThinkingIndicator';
import type { FocusMode } from './FocusMenu';
import { FormattedChatMessageText } from './FormattedChatMessageText';
import { GmailMessageCard } from './GmailMessageCard';
import { WhatsAppMessageCard } from './WhatsAppMessageCard';
import { ChatStructuredCards } from './cards/ChatStructuredCards';

const HERO_STATES = ['gentleman', 'happy', 'curious', 'dance', 'idle'] as const;

interface ChatViewProps {
  initialPrompt?: string;
  onNavigateTab?: (tab: string) => void;
}

function getInitials(name?: string | null): string {
  const clean = (name || '').trim();
  if (!clean) return 'AV';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
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
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [threadModelPref, setThreadModelPref] = useState<string | null>(null);
  const [threadEffortPref, setThreadEffortPref] = useState<AiReasoningEffort>('auto');
  const [modelToast, setModelToast] = useState('');
  const [heroIndex, setHeroIndex] = useState(0);
  const [unreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { modelGroups, preferences, resolvedDefaultRef, updateThreadModel } = useAiProviders();

  const resolvedChatModelRef = useMemo(
    () => resolveModelRef([threadModelPref, resolvedDefaultRef], modelGroups),
    [threadModelPref, resolvedDefaultRef, modelGroups]
  );

  const resolvedChatModelDisplay = useMemo(
    () => getResolvedModelDisplay(resolvedChatModelRef, modelGroups),
    [resolvedChatModelRef, modelGroups]
  );

  const openManageProviders = useCallback(() => {
    onNavigateTab?.('settings');
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('vito:open-settings-tab', { detail: 'ia' }));
      }, 0);
    }
  }, [onNavigateTab]);

  const showModelToast = useCallback((msg: string) => {
    setModelToast(msg);
    setTimeout(() => setModelToast(''), 3000);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      void handleSendPrompt(initialPrompt.trim(), null);
    }
  }, [initialPrompt]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleSelectConversation = async (id: string) => {
    setActiveSessionId(id);
    try {
      const detailed = await loadSessionWithMessages(id);
      if (detailed?.messages) {
        setMessages(detailed.messages);
      }
      if (detailed?.session) {
        setThreadModelPref(detailed.session.model_pref || null);
        setThreadEffortPref(
          (detailed.session.effort_pref as AiReasoningEffort) || preferences.default_effort
        );
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

      const contextPayload: Record<string, unknown> = {
        history: historyPayload,
        ...(activeSessionId ? { thread_id: activeSessionId } : {}),
        ...(threadModelPref ? { model_pref: threadModelPref } : {}),
        ...(threadEffortPref && threadEffortPref !== 'auto'
          ? { effort_pref: threadEffortPref }
          : {}),
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
        model_used: res.model_used,
        fallback_notice: res.fallback_notice,
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
    } catch (err: unknown) {
      const messageText =
        err instanceof Error ? err.message : 'Verifique sua conexão.';
      const errorMsg: ChatMessage = {
        id: `vito-error-${Date.now()}`,
        sender: 'vito',
        text: `Desculpe, ocorreu uma instabilidade ao conectar ao servidor: ${messageText}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmEmail = (updated: {
    recipient_email: string;
    subject: string;
    body: string;
  }) => {
    void handleSendPrompt(
      `Enviar e-mail para ${updated.recipient_email} com assunto "${updated.subject}": "${updated.body}"`,
      null
    );
  };

  const handleConfirmWhatsApp = (updated: {
    recipient_name: string;
    message: string;
  }) => {
    void handleSendPrompt(
      `Enviar mensagem WhatsApp para ${updated.recipient_name}: "${updated.message}"`,
      null
    );
  };

  const handleStartNewChat = () => {
    setActiveSessionId('');
    setMessages([]);
    setThreadModelPref(null);
    setThreadEffortPref(preferences.default_effort);
  };

  const initials = getInitials(user?.name);
  const currentHeroState = loading ? 'thinking' : HERO_STATES[heroIndex];

  return (
    <div className="flex-1 h-screen flex bg-[var(--bg)] text-[var(--ink)] overflow-hidden select-none">
      {historyOpen && (
        <ChatHistoryPanel
          conversations={conversations}
          activeSessionId={activeSessionId}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onTogglePin={togglePinConversation}
          onNewChat={handleStartNewChat}
        />
      )}

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header v5 "Conversas": Menu, Sino #c-notifs, + #c-new, Avatar AV */}
        <header className="sbar h-16 px-6 border-b border-[var(--line)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              id="c-menu"
              type="button"
              onClick={() => setHistoryOpen((prev) => !prev)}
              className="v5-press w-11 h-11 rounded-full bg-[var(--bg)] border border-[var(--line)] shadow-[var(--shadow)] flex items-center justify-center text-[var(--ink)]"
              title={historyOpen ? 'Ocultar histórico' : 'Conversas'}
              aria-label="Conversas"
            >
              {historyOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
            </button>
            <h1 className="text-[17px] font-medium tracking-tight text-[var(--ink)]">
              Conversas
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="c-notifs"
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('vito:open-notifications'));
                onNavigateTab?.('notifications');
              }}
              className="v5-press relative w-11 h-11 rounded-full bg-[var(--bg)] border border-[var(--line)] shadow-[var(--shadow)] flex items-center justify-center text-[var(--ink)]"
              aria-label="Notificações"
              title="Notificações"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span
                  id="c-notifs-n"
                  className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-[var(--red)] border-2 border-[var(--bg)]"
                />
              )}
            </button>

            <button
              id="c-new"
              type="button"
              onClick={handleStartNewChat}
              className="v5-press w-11 h-11 rounded-full bg-[var(--bg)] border border-[var(--line)] shadow-[var(--shadow)] flex items-center justify-center text-[var(--ink)]"
              aria-label="Nova conversa"
              title="Nova conversa"
            >
              <Plus size={18} />
            </button>

            <button
              type="button"
              data-go-perfil
              onClick={() => {
                window.dispatchEvent(new CustomEvent('vito:open-profile'));
                onNavigateTab?.('settings');
              }}
              className="v5-press w-11 h-11 rounded-full bg-[var(--ink)] text-[var(--bg)] border border-[var(--line)] text-[13px] font-semibold flex items-center justify-center tracking-tight"
              aria-label="Perfil e configurações"
              title="Perfil"
            >
              {initials}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 scroll-smooth flex flex-col">
          {messages.length === 0 ? (
            <div className="max-w-3xl lg:max-w-4xl mx-auto my-auto w-full flex flex-col items-center justify-center text-center space-y-3 py-4 vito-hero-in">
              <button
                id="chero-rig"
                type="button"
                onClick={() => setHeroIndex((prev) => (prev + 1) % HERO_STATES.length)}
                className="v5-press p-2 rounded-[26px] focus-visible:outline-2 focus-visible:outline-[var(--blue)]"
                aria-label="Interagir com o mascote Vito"
              >
                {React.createElement(
                  VitoMascot as unknown as React.ComponentType<Record<string, unknown>>,
                  {
                    size: 76,
                    animated: true,
                    state: currentHeroState,
                    interactiveParts: false,
                  }
                )}
              </button>

              <h2 className="text-2xl sm:text-3xl font-medium tracking-[-0.025em] text-[var(--ink)] max-w-2xl leading-tight">
                Como posso ajudar hoje?
              </h2>

              <ChatIdeasDeck
                onUseIdea={(prompt) => void handleSendPrompt(prompt, null)}
                disabled={loading}
              />
            </div>
          ) : (
            <div className="max-w-3xl lg:max-w-4xl mx-auto w-full flex-1 flex flex-col justify-start space-y-6 pb-6">
              {messages.map((msg) => {
                const isUser = msg.sender === 'user';
                if (isUser) {
                  return (
                    <div key={msg.id} className="flex justify-end w-full animate-rise">
                      <div className="max-w-[84%] sm:max-w-[74%] rounded-[22px] px-4 py-3 bg-[var(--ink)] text-[var(--bg)]">
                        <div className="text-[15px] leading-[1.35] whitespace-pre-wrap">
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className="w-full flex flex-col space-y-3 pt-1 animate-rise">
                    <div className="text-[15px] text-[var(--ink)] leading-[1.45]">
                      <FormattedChatMessageText text={msg.text} isUser={false} />
                    </div>

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
                        void handleSendPrompt(`confirmar ${pendingID}`);
                      }}
                    />

                    {msg.fallback_notice && (
                      <div className="px-3.5 py-2 rounded-2xl bg-[var(--orange-bg)] text-xs text-[var(--orange)] flex items-center justify-between gap-3">
                        <span>{msg.fallback_notice}</span>
                        <button
                          type="button"
                          onClick={openManageProviders}
                          className="font-semibold underline shrink-0"
                        >
                          Gerenciar provedores
                        </button>
                      </div>
                    )}

                    <ChatMessageActionBar
                      messageText={msg.text}
                      timestamp={msg.timestamp}
                      modelUsed={msg.model_used}
                    />
                  </div>
                );
              })}

              {loading && (
                <div className="w-full pt-2">
                  <ChatThinkingIndicator />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 bg-transparent shrink-0">
          <div className="max-w-3xl lg:max-w-4xl mx-auto w-full">
            {modelToast && (
              <div className="mb-2 px-3.5 py-1.5 rounded-full bg-[var(--ink)] text-[var(--bg)] text-xs font-medium inline-block">
                {modelToast}
              </div>
            )}
            <ChatInputDock
              onSendMessage={(text, focus) => void handleSendPrompt(text, focus)}
              loading={loading}
              modelName={resolvedChatModelDisplay.model.name}
              modelColor={resolvedChatModelDisplay.color}
              onOpenModelPicker={() => setModelPickerOpen(true)}
            />
          </div>
        </div>
      </div>

      <ModelPickerModal
        isOpen={modelPickerOpen}
        onClose={() => setModelPickerOpen(false)}
        scope="Esta conversa"
        allowInherit={true}
        selectedModel={threadModelPref}
        selectedEffort={threadEffortPref}
        inheritedModel={resolvedDefaultRef}
        groups={modelGroups}
        onSelectModel={async (modelRef) => {
          setThreadModelPref(modelRef);
          if (activeSessionId) {
            try {
              await updateThreadModel(activeSessionId, modelRef || '', threadEffortPref);
            } catch {
              // Mantém preferência local na sessão
            }
          }
          if (modelRef) {
            const disp = getResolvedModelDisplay(modelRef, modelGroups);
            showModelToast(`Próximas mensagens usam ${disp.model.name}`);
          } else {
            showModelToast('Voltou ao modelo padrão');
          }
        }}
        onSelectEffort={async (effort) => {
          setThreadEffortPref(effort);
          if (activeSessionId) {
            try {
              await updateThreadModel(activeSessionId, threadModelPref || '', effort);
            } catch {
              // Ignora erro transitório
            }
          }
        }}
        onManageProviders={openManageProviders}
      />
    </div>
  );
};
