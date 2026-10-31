import React, { useState } from 'react';
import { Inbox } from 'lucide-react';
import { PendingItem } from '../../../types';
import { CHAT_CARD_THEMES } from './chatCardTheme';

export interface PendingInlineCardProps {
  pending: PendingItem;
  onNavigateTab?: (tab: string) => void;
  onUndo?: () => void;
}

/**
 * Card in-chat de item pendente com ação direta de desfazer ou visualizar tarefas.
 */
export const PendingInlineCard: React.FC<PendingInlineCardProps> = ({
  pending,
  onNavigateTab,
  onUndo,
}) => {
  const [undone, setUndone] = useState(false);
  const theme = CHAT_CARD_THEMES.pending;

  const formatScheduledDate = (scheduledDate?: string) => {
    if (!scheduledDate) return 'Sem data';
    const m = scheduledDate.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}`;
    const d = new Date(scheduledDate);
    if (Number.isNaN(d.getTime())) return 'Sem data';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const dateLabel = formatScheduledDate(pending.scheduled_date || pending.due_date);
  const subtitle = `${dateLabel} · ${pending.category || 'Geral'}`;

  return (
    <div className={`mt-4 space-y-2.5 transition-all ${undone ? 'opacity-40' : ''}`}>
      {/* Card Principal */}
      <div
        className={`p-4.5 rounded-[22px] bg-white dark:bg-[#12151A] border ${theme.borderColor} ${theme.hoverBorder} flex items-center gap-4 shadow-sm transition-colors`}
      >
        {/* Chip Amarelo/Laranja 44x44 */}
        <div className={`w-11 h-11 rounded-2xl ${theme.chipBg} flex items-center justify-center shrink-0 shadow-2xs`}>
          <Inbox color={theme.chipIconColor} size={22} />
        </div>

        {/* Informações da Pendência */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white truncate">
            {pending.title}
          </h4>
          <p className="text-xs text-zinc-400 mt-0.5 truncate font-medium">
            {subtitle}
          </p>
        </div>

        <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full ${theme.tagBg} ${theme.tagTextColor} uppercase tracking-wider shrink-0`}>
          PENDÊNCIA
        </span>
      </div>

      {/* Botões de Ação em Pílula */}
      <div className="flex items-center gap-2 pl-1">
        <button
          type="button"
          onClick={() => {
            setUndone(true);
            onUndo?.();
          }}
          disabled={undone}
          className="px-4 py-1.5 rounded-full border border-zinc-200 dark:border-[#262B33] bg-transparent hover:bg-zinc-100 dark:hover:bg-white/5 text-xs font-bold text-zinc-600 dark:text-zinc-300 transition-colors"
        >
          {undone ? 'Cancelada' : 'Desfazer'}
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab?.('tasks')}
          className="px-4 py-1.5 rounded-full bg-[#17191b] hover:bg-black dark:bg-[#f1f3f2] dark:hover:bg-white text-white dark:text-[#09090B] text-xs font-bold transition-all shadow-2xs"
        >
          Ver tarefas
        </button>
      </div>
    </div>
  );
};
