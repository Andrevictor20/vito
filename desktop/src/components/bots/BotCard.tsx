import React from 'react';
import { ChevronRight, AlertCircle } from 'lucide-react';
import { Bot, BotAppStatus, isAlwaysAskAction } from '../../types/bot';
import { PendingDecision } from '../../services/api/botsApi';
import { VitoSwitch } from '../ui/VitoSwitch';
import { BotMascotRig } from './BotMascotRig';
import { getBotAnimState, parseBotSkin } from './mascotPalettes';
import { getAppMeta, getBotAppsFooter } from './botHelpers';

interface BotCardProps {
  bot: Bot;
  globalApps?: BotAppStatus[];
  selected?: boolean;
  busy?: boolean;
  happy?: boolean;
  onSelect: (bot: Bot) => void;
  onToggle: (id: string, active: boolean) => void;
  onResolvePending: (
    botId: string,
    confirmationId: string,
    decision: PendingDecision,
    actionKey?: string,
    alwaysAsk?: boolean
  ) => void;
}

export const BotCard: React.FC<BotCardProps> = ({
  bot,
  globalApps,
  selected = false,
  busy = false,
  happy = false,
  onSelect,
  onToggle,
  onResolvePending,
}) => {
  const isActive = bot.status !== 'paused';
  const skin = parseBotSkin(bot);
  const animState = getBotAnimState(bot, { busy, happy });
  const triggerLabel = bot.triggers?.[0]?.label || bot.frequency || 'Sob demanda';
  const appsList = getBotAppsFooter(bot, globalApps);
  const actionsCount = bot.actions_summary?.total ?? bot.actions?.length ?? 0;
  const firstPending = bot.pending?.[0];
  const isAlways = firstPending ? isAlwaysAskAction(firstPending.action_key, firstPending.always_ask) : false;

  return (
    <div
      onClick={() => onSelect(bot)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(bot);
        }
      }}
      className={`group rounded-2xl border p-4 transition-all cursor-pointer select-none ${
        selected
          ? 'bg-[var(--bg)] border-[var(--ink)] shadow-sm'
          : 'bg-[var(--bg)] border-[var(--line)] hover:border-[var(--muted)]'
      } ${!isActive ? 'opacity-75' : ''}`}
    >
      {/* Topo do card .bcx */}
      <div className="flex items-start gap-3.5">
        <div className="w-[60px] h-[60px] rounded-2xl bg-[var(--surf)] border border-[var(--line)] flex items-center justify-center shrink-0 overflow-hidden">
          <BotMascotRig skin={skin} state={animState} size={56} animated={false} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-[var(--ink)] truncate">{bot.title}</h3>
            <div onClick={(e) => e.stopPropagation()}>
              <VitoSwitch
                checked={isActive}
                onChange={(checked) => onToggle(bot.id, checked)}
                aria-label={`Alternar ${bot.title}`}
              />
            </div>
          </div>

          <p className="text-xs font-medium text-[var(--muted)] mt-0.5 truncate">
            {bot.category || 'Geral'} · {triggerLabel}
          </p>

          {bot.last?.summary && (
            <p className="text-xs text-[var(--ink)]/80 mt-2 line-clamp-2 leading-relaxed">
              {bot.last.summary}
            </p>
          )}
        </div>
      </div>

      {/* Caixa .rd-pend (Aguardando você) */}
      {firstPending && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-3 rounded-xl border border-[var(--orange)]/40 bg-[var(--orange-bg)] p-3"
        >
          <div className="flex items-start gap-2">
            <AlertCircle size={15} className="text-[var(--orange)] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--orange)]">
                Aguardando você · {firstPending.label}
              </div>
              <p className="text-xs text-[var(--ink)] mt-0.5 leading-snug">
                {firstPending.summary}
              </p>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onResolvePending(bot.id, firstPending.confirmation_id, 'deny', firstPending.action_key, firstPending.always_ask)
              }
              className="px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surf)] transition-colors"
            >
              Recusar
            </button>
            <button
              type="button"
              onClick={() =>
                onResolvePending(bot.id, firstPending.confirmation_id, 'allow_once', firstPending.action_key, firstPending.always_ask)
              }
              className="px-3 py-1.5 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Aprovar
            </button>
            {!isAlways && (
              <button
                type="button"
                onClick={() =>
                  onResolvePending(bot.id, firstPending.confirmation_id, 'always_allow', firstPending.action_key, firstPending.always_ask)
                }
                className="px-3 py-1.5 rounded-lg border border-[var(--acc)]/40 bg-[var(--green-bg)] text-xs font-semibold text-[var(--acc)] hover:opacity-90 transition-opacity"
              >
                Sempre permitir
              </button>
            )}
          </div>
        </div>
      )}

      {/* Rodapé com stack de logos dos apps + N ações */}
      <div className="mt-3 pt-2.5 border-t border-[var(--line)]/70 flex items-center justify-between">
        <div className="flex items-center -space-x-1.5">
          {appsList.slice(0, 5).map((app) => {
            const meta = getAppMeta(app.app_key);
            return (
              <span
                key={app.app_key}
                title={`${meta.label}${app.connected ? '' : ' (não conectado)'}`}
                style={{ backgroundColor: app.connected ? meta.color : undefined }}
                className={`w-6 h-6 rounded-full border-2 border-[var(--bg)] flex items-center justify-center text-[9px] font-extrabold ${
                  app.connected
                    ? 'text-white'
                    : 'bg-[var(--surf)] text-[var(--muted)]'
                }`}
              >
                {meta.short}
              </span>
            );
          })}
        </div>

        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--muted)] group-hover:text-[var(--ink)] transition-colors">
          {actionsCount} {actionsCount === 1 ? 'ação' : 'ações'}
          <ChevronRight size={14} />
        </span>
      </div>
    </div>
  );
};
