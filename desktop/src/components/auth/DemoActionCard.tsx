import React from 'react';
import { DemoSceneCardChip } from './demoScenes';
import { useTheme } from '../../context/ThemeContext';

interface DemoActionCardProps {
  card: DemoSceneCardChip;
}

export const DemoActionCard: React.FC<DemoActionCardProps> = ({ card }) => {
  const { isDark } = useTheme();

  const getChipStyle = () => {
    switch (card.kind) {
      case 'agenda':
        return {
          bg: isDark ? 'rgba(90, 162, 238, 0.16)' : '#e4effb',
          fg: isDark ? '#5aa2ee' : '#2b7fd4',
        };
      case 'email':
      case 'email-draft':
        return {
          bg: isDark ? 'rgba(255, 107, 138, 0.16)' : '#fde6ec',
          fg: isDark ? '#ff6b8a' : '#d6355a',
        };
      case 'radar':
        return {
          bg: isDark ? 'rgba(255, 154, 82, 0.16)' : '#fbebdb',
          fg: isDark ? '#ff9a52' : '#d9681a',
        };
      case 'boleto':
      case 'tarefa':
        return {
          bg: isDark ? 'rgba(165, 139, 255, 0.16)' : '#eee8fd',
          fg: isDark ? '#a58bff' : '#7a4fe0',
        };
      case 'whatsapp':
      default:
        return {
          bg: isDark ? 'rgba(52, 211, 153, 0.16)' : '#ddf4e8',
          fg: isDark ? '#34d399' : '#0b9a5f',
        };
    }
  };

  const chipColors = getChipStyle();

  if (card.isCol) {
    return (
      <div className="mt-2.5 p-3.5 bg-white dark:bg-[#14171C] border border-[#d2d7d4] dark:border-[#2c3134] rounded-2xl shadow-sm flex flex-col gap-2.5 select-none">
        <b className="text-[12.5px] text-[#69706d] dark:text-[#98a19d] font-semibold">
          {card.title}
        </b>

        <div
          className={`px-3 py-2.5 rounded-2xl text-sm leading-relaxed max-w-[92%] ${
            card.bubbleTone === 'red'
              ? 'bg-[#fde6ec] dark:bg-[#3a1620] text-[#17191b] dark:text-[#f1f3f2]'
              : 'bg-[#ddf4e8] dark:bg-[#12302a] text-[#17191b] dark:text-[#f1f3f2]'
          }`}
        >
          {card.bubbleTitle && (
            <div className="font-semibold text-xs mb-0.5">{card.bubbleTitle}</div>
          )}
          <span>{card.bubbleText}</span>
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          <span className="h-8 px-4 rounded-full flex items-center justify-center text-xs font-semibold bg-[#17191b] dark:bg-white text-white dark:text-[#09090B] shadow-sm cursor-pointer hover:opacity-90 transition-opacity">
            Enviar
          </span>
          <span className="h-8 px-4 rounded-full flex items-center justify-center text-xs font-semibold border border-[#d2d7d4] dark:border-[#2c3134] text-[#17191b] dark:text-[#f1f3f2] cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            Editar
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2.5 p-3.5 bg-white dark:bg-[#14171C] border border-[#d2d7d4] dark:border-[#2c3134] rounded-2xl shadow-sm flex items-center gap-3 select-none">
      {/* Icon Chip */}
      <div
        style={{ backgroundColor: chipColors.bg, color: chipColors.fg }}
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
      >
        {card.kind === 'agenda' && (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="3" />
            <path d="M8 3v4M16 3v4M3 10h18" />
          </svg>
        )}
        {card.kind === 'email' && (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="3" />
            <path d="M4 7.5l8 6 8-6" />
          </svg>
        )}
        {card.kind === 'radar' && (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="12" cy="12" r="1" />
          </svg>
        )}
        {(card.kind === 'boleto' || card.kind === 'tarefa') && (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l3 3 5-6" />
          </svg>
        )}
      </div>

      {/* Info Body */}
      <div className="flex-1 min-w-0">
        <b className="block text-sm font-semibold text-[#17191b] dark:text-[#f1f3f2] truncate">
          {card.title}
        </b>
        {card.subtitle && (
          <small className="block text-xs text-[#69706d] dark:text-[#98a19d] mt-0.5 truncate">
            {card.subtitle}
          </small>
        )}
      </div>

      {/* Trailing Elements */}
      {card.trailing === 'check' && (
        <span className="text-[#0b9a5f] dark:text-[#34d399] shrink-0">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l3 3 5-6" />
          </svg>
        </span>
      )}

      {card.trailing === 'chart' && (
        <svg className="w-11 h-6 shrink-0" viewBox="0 0 44 22" fill="none" stroke="#d9681a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 4l9 3 8 6 8-2 7 6 8 1" />
        </svg>
      )}

      {card.trailing === 'tag' && (
        <span
          className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-xl shrink-0 ${
            card.tagTone === 'red'
              ? 'bg-[#fde6ec] dark:bg-[#3a1620] text-[#d6355a] dark:text-[#ff6b8a]'
              : 'bg-[#eee8fd] dark:bg-[#241a42] text-[#7a4fe0] dark:text-[#a58bff]'
          }`}
        >
          {card.tagLabel}
        </span>
      )}
    </div>
  );
};
