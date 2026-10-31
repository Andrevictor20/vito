import React, { useState } from 'react';
import { RadarIcon } from '../ChatCardIcons';
import { Trigger } from '../../../types';
import { CHAT_CARD_THEMES } from './chatCardTheme';

export interface TriggerInlineCardProps {
  trigger: Trigger;
  onNavigateTab?: (tab: string) => void;
  onUndo?: () => void;
}

/**
 * Card in-chat de criação de radar/vigília criada.
 */
export const TriggerInlineCard: React.FC<TriggerInlineCardProps> = ({
  trigger,
  onNavigateTab,
  onUndo,
}) => {
  const [undone, setUndone] = useState(false);
  const theme = CHAT_CARD_THEMES.trigger;

  const subtitle = trigger.query
    ? `${trigger.query} · Radar ativo`
    : 'Monitorando diariamente · Alerta ativo';

  return (
    <div className={`mt-4 space-y-2.5 transition-all ${undone ? 'opacity-40' : ''}`}>
      {/* Card Principal */}
      <div
        className={`p-4.5 rounded-[22px] bg-white dark:bg-[#12151A] border ${theme.borderColor} ${theme.hoverBorder} flex items-center gap-4 shadow-sm transition-colors`}
      >
        {/* Chip Laranja 44x44 */}
        <div className={`w-11 h-11 rounded-2xl ${theme.chipBg} flex items-center justify-center shrink-0 shadow-2xs`}>
          <RadarIcon color={theme.chipIconColor} size={22} />
        </div>

        {/* Informações do Radar */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white truncate">
            {trigger.title}
          </h4>
          <p className="text-xs text-zinc-400 mt-0.5 truncate font-medium">
            {subtitle}
          </p>
        </div>

        <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full ${theme.tagBg} ${theme.tagTextColor} uppercase tracking-wider shrink-0`}>
          RADAR
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
          {undone ? 'Cancelado' : 'Desfazer'}
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab?.('triggers')}
          className="px-4 py-1.5 rounded-full bg-[#17191b] hover:bg-black dark:bg-[#f1f3f2] dark:hover:bg-white text-white dark:text-[#09090B] text-xs font-bold transition-all shadow-2xs"
        >
          Ver radares
        </button>
      </div>
    </div>
  );
};
