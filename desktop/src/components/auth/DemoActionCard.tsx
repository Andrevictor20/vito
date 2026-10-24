import React from 'react';
import { DemoSceneCardChip } from './demoScenes';
import { useTheme } from '../../context/ThemeContext';
import { loginPalette } from './loginPalette';

interface DemoActionCardProps {
  card: DemoSceneCardChip;
}

export const DemoActionCard: React.FC<DemoActionCardProps> = ({ card }) => {
  const { isDark } = useTheme();
  const palette = loginPalette(isDark);

  const getChipStyle = () => {
    switch (card.kind) {
      case 'agenda':
        return {
          bg: palette.blueBg,
          fg: palette.blue,
        };
      case 'email':
      case 'email-draft':
        return {
          bg: palette.redBg,
          fg: palette.red,
        };
      case 'radar':
        return {
          bg: palette.orangeBg,
          fg: palette.orange,
        };
      case 'boleto':
      case 'tarefa':
        return {
          bg: palette.purpleBg,
          fg: palette.purple,
        };
      case 'whatsapp':
      default:
        return {
          bg: palette.greenBg,
          fg: palette.acc,
        };
    }
  };

  const chipColors = getChipStyle();

  if (card.isCol) {
    return (
      <div
        style={{
          backgroundColor: palette.bg,
          borderColor: palette.line,
        }}
        className="mt-2.5 p-3.5 border rounded-2xl shadow-sm flex flex-col gap-2.5 select-none transition-colors"
      >
        <b style={{ color: palette.muted }} className="text-[12.5px] font-semibold">
          {card.title}
        </b>

        <div
          style={{
            backgroundColor: card.bubbleTone === 'red' ? palette.redBg : palette.greenBg,
            color: palette.ink,
          }}
          className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed max-w-[92%]"
        >
          {card.bubbleTitle && (
            <div className="font-semibold text-xs mb-0.5">{card.bubbleTitle}</div>
          )}
          <span>{card.bubbleText}</span>
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          <span
            style={{ backgroundColor: palette.ink, color: palette.bg }}
            className="h-8 px-4 rounded-full flex items-center justify-center text-xs font-semibold shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
          >
            Enviar
          </span>
          <span
            style={{ borderColor: palette.line, color: palette.ink }}
            className="h-8 px-4 rounded-full flex items-center justify-center text-xs font-semibold border cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            Editar
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: palette.bg,
        borderColor: palette.line,
      }}
      className="mt-2.5 p-3.5 border rounded-2xl shadow-sm flex items-center gap-3 select-none transition-colors"
    >
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
        <b style={{ color: palette.ink }} className="block text-sm font-semibold truncate">
          {card.title}
        </b>
        {card.subtitle && (
          <small style={{ color: palette.muted }} className="block text-xs mt-0.5 truncate">
            {card.subtitle}
          </small>
        )}
      </div>

      {/* Trailing Elements */}
      {card.trailing === 'check' && (
        <span style={{ color: palette.accent }} className="shrink-0">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l3 3 5-6" />
          </svg>
        </span>
      )}

      {card.trailing === 'chart' && (
        <svg className="w-11 h-6 shrink-0" viewBox="0 0 44 22" fill="none" stroke={palette.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 4l9 3 8 6 8-2 7 6 8 1" />
        </svg>
      )}

      {card.trailing === 'tag' && (
        <span
          style={{
            backgroundColor: card.tagTone === 'red' ? palette.redBg : palette.purpleBg,
            color: card.tagTone === 'red' ? palette.red : palette.purple,
          }}
          className="text-[11.5px] font-semibold px-2.5 py-1 rounded-xl shrink-0"
        >
          {card.tagLabel}
        </span>
      )}
    </div>
  );
};
