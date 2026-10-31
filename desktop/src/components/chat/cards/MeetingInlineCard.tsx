import React, { useState } from 'react';
import { Users, Check, Copy } from 'lucide-react';
import { Meeting } from '../../../types';
import { CHAT_CARD_THEMES } from './chatCardTheme';

export interface ChatMeetingData {
  id?: string;
  title: string;
  description?: string;
  duration_minutes?: number;
  mode?: 'one_on_one' | 'group_consensus';
  status?: string;
  short_url?: string;
  public_url?: string;
  slots_count?: number;
}

export interface MeetingInlineCardProps {
  meeting: Meeting | ChatMeetingData;
  onNavigateTab?: (tab: string) => void;
  onCopyLink?: (link: string) => void;
}

/**
 * Card in-chat de reunião P2P / enquete de consenso de horários.
 */
export const MeetingInlineCard: React.FC<MeetingInlineCardProps> = ({
  meeting,
  onNavigateTab,
  onCopyLink,
}) => {
  const [copied, setCopied] = useState(false);
  const theme = CHAT_CARD_THEMES.meeting;

  const rawLink = meeting.short_url || meeting.public_url || '';
  const modeLabel = meeting.mode === 'group_consensus' ? 'Enquete em Grupo' : 'Reunião 1-on-1';
  const subtitle = `${modeLabel} · Link ativo`;

  const handleCopy = async () => {
    if (!rawLink) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(rawLink);
      }
      setCopied(true);
      onCopyLink?.(rawLink);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="mt-4 space-y-2.5 transition-all">
      {/* Card Principal */}
      <div
        className={`p-4.5 rounded-[22px] bg-white dark:bg-[#12151A] border ${theme.borderColor} ${theme.hoverBorder} flex items-center gap-4 shadow-sm transition-colors`}
      >
        {/* Chip Verde 44x44 */}
        <div className={`w-11 h-11 rounded-2xl ${theme.chipBg} flex items-center justify-center shrink-0 shadow-2xs`}>
          <Users color={theme.chipIconColor} size={22} />
        </div>

        {/* Informações da Reunião */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white truncate">
            {meeting.title}
          </h4>
          <p className="text-xs text-zinc-400 mt-0.5 truncate font-medium">
            {subtitle}
          </p>
        </div>

        <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full ${theme.tagBg} ${theme.tagTextColor} uppercase tracking-wider shrink-0`}>
          {meeting.mode === 'group_consensus' ? 'ENQUETE' : 'REUNIÃO'}
        </span>
      </div>

      {/* Botões de Ação em Pílula */}
      <div className="flex items-center gap-2 pl-1">
        <button
          type="button"
          onClick={handleCopy}
          className="px-4 py-1.5 rounded-full border border-zinc-200 dark:border-[#262B33] bg-transparent hover:bg-zinc-100 dark:hover:bg-white/5 text-xs font-bold text-zinc-600 dark:text-zinc-300 transition-colors flex items-center gap-1.5"
        >
          {copied ? (
            <>
              <Check size={14} className="text-emerald-500" />
              <span>Copiado!</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span>Copiar link</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab?.('booking')}
          className="px-4 py-1.5 rounded-full bg-[#17191b] hover:bg-black dark:bg-[#f1f3f2] dark:hover:bg-white text-white dark:text-[#09090B] text-xs font-bold transition-all shadow-2xs"
        >
          Ver reuniões
        </button>
      </div>
    </div>
  );
};
