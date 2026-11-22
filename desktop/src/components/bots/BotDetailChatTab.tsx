import React, { useState } from 'react';
import { Send, AlertCircle, ExternalLink } from 'lucide-react';
import { Bot, BotChatMessage, isAlwaysAskAction } from '../../types/bot';
import { PendingDecision } from '../../services/api/botsApi';
import { BotMascotRig } from './BotMascotRig';
import { getBotAnimState, parseBotSkin } from './mascotPalettes';

interface BotDetailChatTabProps {
  bot: Bot;
  messages: BotChatMessage[];
  busy?: boolean;
  happy?: boolean;
  onSendMessage: (msg: string) => Promise<void>;
  onRunNow: () => Promise<void>;
  onResolvePending: (
    botId: string,
    confirmationId: string,
    decision: PendingDecision,
    actionKey?: string,
    alwaysAsk?: boolean
  ) => Promise<void>;
  onOpenMainChat?: (prompt?: string) => void;
}

const CHAT_CHIPS = ['Executar agora', 'Últimas ações', 'O que você não conseguiu verificar?', 'Adicionar habilidade'];

export const BotDetailChatTab: React.FC<BotDetailChatTabProps> = ({
  bot,
  messages,
  busy = false,
  happy = false,
  onSendMessage,
  onRunNow,
  onResolvePending,
  onOpenMainChat,
}) => {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const skin = parseBotSkin(bot);
  const animState = getBotAnimState(bot, { busy, happy });
  const triggerLabel = bot.triggers?.[0]?.label || bot.frequency || 'Sob demanda';
  const pendingList = bot.pending || [];

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    if (trimmed === 'Executar agora') {
      await onRunNow();
      return;
    }
    setInput('');
    setSending(true);
    try {
      await onSendMessage(trimmed);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Hero .rd-hero */}
        <div className="flex flex-col items-center text-center py-3 border-b border-[var(--line)]/60">
          <div className="w-[76px] h-[76px] rounded-3xl bg-[var(--surf)] border border-[var(--line)] flex items-center justify-center mb-2">
            <BotMascotRig skin={skin} state={animState} size={68} animated={true} />
          </div>
          <h3 className="text-base font-extrabold text-[var(--ink)]">{bot.title}</h3>
          <div className="mt-1 flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--surf)] border border-[var(--line)] text-[var(--ink)]">
              {bot.status === 'paused' ? 'Pausado' : 'Ativo'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[var(--surf)] border border-[var(--line)] text-[var(--muted)]">
              {triggerLabel}
            </span>
          </div>
        </div>

        {/* Mensagens do chat */}
        {messages.length === 0 ? (
          <div className="p-4 rounded-2xl bg-[var(--surf)] border border-[var(--line)] text-sm text-[var(--ink)]">
            <p className="font-semibold">Oi! Eu cuido de uma coisa só: {bot.goal}</p>
            {bot.last?.summary && (
              <p className="text-xs text-[var(--muted)] mt-1.5">
                Última execução: {bot.last.summary}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div key={m.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-[var(--ink)] text-[var(--bg)]'
                        : 'bg-[var(--surf)] border border-[var(--line)] text-[var(--ink)]'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.content.includes('Vito principal') && onOpenMainChat && (
                      <button
                        type="button"
                        onClick={() => onOpenMainChat()}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--blue)] hover:underline"
                      >
                        Abrir o Vito principal <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                  {m.model_used && !isUser && (
                    <span className="text-[10px] text-[var(--muted)] mt-1 px-1">
                      via {m.model_used}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Caixas Aguardando você */}
        {pendingList.map((pend) => {
          const isAlways = isAlwaysAskAction(pend.action_key, pend.always_ask);
          return (
            <div
              key={pend.confirmation_id}
              className="rounded-2xl border border-[var(--orange)]/40 bg-[var(--orange-bg)] p-3.5 space-y-2.5"
            >
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-[var(--orange)] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--orange)]">
                    Aguardando você · {pend.label}
                  </div>
                  <p className="text-xs text-[var(--ink)] mt-0.5">{pend.summary}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onResolvePending(bot.id, pend.confirmation_id, 'deny', pend.action_key, pend.always_ask)
                  }
                  className="px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-xs font-semibold text-[var(--ink)]"
                >
                  Recusar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onResolvePending(bot.id, pend.confirmation_id, 'allow_once', pend.action_key, pend.always_ask)
                  }
                  className="px-3 py-1.5 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-xs font-semibold"
                >
                  Permitir uma vez
                </button>
                {!isAlways && (
                  <button
                    type="button"
                    onClick={() =>
                      onResolvePending(bot.id, pend.confirmation_id, 'always_allow', pend.action_key, pend.always_ask)
                    }
                    className="px-3 py-1.5 rounded-lg border border-[var(--acc)]/40 bg-[var(--green-bg)] text-xs font-semibold text-[var(--acc)]"
                  >
                    Sempre permitir
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chips + Input */}
      <div className="p-3 border-t border-[var(--line)] bg-[var(--bg)] space-y-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {CHAT_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handleSend(chip)}
              className="px-3 py-1 rounded-full border border-[var(--line)] bg-[var(--surf)] text-xs font-semibold text-[var(--ink)] hover:border-[var(--ink)] whitespace-nowrap transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Fale com este bot..."
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--surf)] text-sm text-[var(--ink)]"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="p-2.5 rounded-xl bg-[var(--ink)] text-[var(--bg)] disabled:opacity-40"
            aria-label="Enviar mensagem"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
