import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { CHAT_CARD_THEMES } from './chatCardTheme';

export interface TimeSlot {
  start_at: string;
  end_at: string;
  label: string;
}

export interface ConflictInfo {
  has_conflict: boolean;
  conflicting_id?: string;
  conflicting_title?: string;
  message?: string;
  suggested_slots?: TimeSlot[];
}

export interface ConflictInlineCardProps {
  conflict: ConflictInfo;
  onPressAdjust?: () => void;
  onSelectSlot?: (slot: TimeSlot) => void;
  onNavigateTab?: (tab: string) => void;
}

/**
 * Card in-chat de sobreposição de eventos na agenda com slots sugeridos e ação direta.
 */
export const ConflictInlineCard: React.FC<ConflictInlineCardProps> = ({
  conflict,
  onPressAdjust,
  onSelectSlot,
  onNavigateTab,
}) => {
  const theme = CHAT_CARD_THEMES.conflict;

  return (
    <div className="mt-4 space-y-2.5 transition-all">
      {/* Card Principal de Conflito */}
      <div
        className={`p-4.5 rounded-[22px] bg-red-50/60 dark:bg-[#1c1214] border ${theme.borderColor} ${theme.hoverBorder} flex flex-col gap-3 shadow-sm transition-colors`}
      >
        <div className="flex items-center gap-4">
          {/* Chip Vermelho 44x44 */}
          <div className={`w-11 h-11 rounded-2xl ${theme.chipBg} flex items-center justify-center shrink-0 shadow-2xs`}>
            <AlertTriangle color={theme.chipIconColor} size={22} />
          </div>

          {/* Informações do Conflito */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white truncate">
              {conflict.conflicting_title || 'Conflito de Agenda'}
            </h4>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 truncate font-medium">
              {conflict.message || 'Atenção: Horário sobreposto com outro compromisso'}
            </p>
          </div>

          <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full ${theme.tagBg} ${theme.tagTextColor} uppercase tracking-wider shrink-0`}>
            CONFLITO
          </span>
        </div>

        {/* Sugestões de Horários Livres */}
        {conflict.suggested_slots && conflict.suggested_slots.length > 0 && (
          <div className="pt-2 border-t border-red-200/60 dark:border-red-900/30">
            <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-2">
              Sugestões de horário livre:
            </p>
            <div className="flex flex-wrap gap-2">
              {conflict.suggested_slots.map((slot, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectSlot?.(slot)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-red-300 dark:hover:border-red-700 transition-colors"
                >
                  <Clock size={12} className="text-red-500" />
                  <span>{slot.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Botões de Ação */}
      <div className="flex items-center gap-2 pl-1">
        {onPressAdjust && (
          <button
            type="button"
            onClick={onPressAdjust}
            className="px-4 py-1.5 rounded-full border border-zinc-200 dark:border-[#262B33] bg-transparent hover:bg-zinc-100 dark:hover:bg-white/5 text-xs font-bold text-zinc-600 dark:text-zinc-300 transition-colors"
          >
            Ajustar horário
          </button>
        )}

        <button
          type="button"
          onClick={() => onNavigateTab?.('calendar')}
          className="px-4 py-1.5 rounded-full bg-[#17191b] hover:bg-black dark:bg-[#f1f3f2] dark:hover:bg-white text-white dark:text-[#09090B] text-xs font-bold transition-all shadow-2xs"
        >
          Ver agenda
        </button>
      </div>
    </div>
  );
};
