import React from 'react';
import { Car, CheckCircle2, Mail, Calendar, Radio } from 'lucide-react';
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
        return { bg: palette.blueBg, fg: palette.blue };
      case 'finance':
        return { bg: palette.finBg, fg: palette.fin };
      case 'email':
        return { bg: palette.redBg, fg: palette.red };
      case 'radar':
        return { bg: palette.orangeBg, fg: palette.orange };
      case 'boleto':
      case 'tarefa':
        return { bg: palette.purpleBg, fg: palette.purple };
      case 'whatsapp':
      default:
        return { bg: palette.greenBg, fg: palette.acc };
    }
  };

  const chipColors = getChipStyle();

  if (card.isCol) {
    return (
      <div
        style={{
          backgroundColor: palette.surf,
          borderColor: palette.hairline,
        }}
        className="mt-2.5 p-3.5 border rounded-[18px] shadow-sm flex flex-col gap-2 select-none transition-colors"
      >
        <b style={{ color: palette.muted }} className="text-[12.5px] font-semibold">
          {card.title}
        </b>

        <div
          style={{
            backgroundColor: card.bubbleTone === 'red' ? palette.redBg : palette.greenBg,
            color: palette.ink,
          }}
          className="px-3 py-2 rounded-[12px] rounded-bl-[4px] text-[13.5px] leading-snug max-w-[92%]"
        >
          {card.bubbleTitle && (
            <div className="font-semibold text-xs mb-0.5">{card.bubbleTitle}</div>
          )}
          <span>{card.bubbleText}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: palette.surf,
        borderColor: palette.hairline,
      }}
      className="mt-2.5 px-3.5 py-3 border rounded-[18px] shadow-sm flex items-center gap-3 select-none transition-colors"
    >
      <div
        style={{ backgroundColor: chipColors.bg, color: chipColors.fg }}
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
      >
        {card.kind === 'agenda' && <Calendar className="w-5 h-5" />}
        {card.kind === 'finance' && <Car className="w-5 h-5" />}
        {card.kind === 'email' && <Mail className="w-5 h-5" />}
        {card.kind === 'radar' && <Radio className="w-5 h-5" />}
        {(card.kind === 'boleto' || card.kind === 'tarefa') && (
          <CheckCircle2 className="w-5 h-5" />
        )}
      </div>

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

      {card.trailing === 'check' && (
        <span
          style={{
            color:
              card.kind === 'boleto' || card.kind === 'tarefa'
                ? palette.purple
                : palette.acc,
          }}
          className="shrink-0"
        >
          <CheckCircle2 className="w-5 h-5" />
        </span>
      )}

      {card.trailing === 'value' && (
        <b style={{ color: palette.ink }} className="text-sm font-bold tabular-nums shrink-0">
          {card.trailingValue}
        </b>
      )}

      {card.trailing === 'status' && (
        <span
          style={{ backgroundColor: palette.greenBg, color: palette.acc }}
          className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full shrink-0"
        >
          {card.tagLabel || 'Ativo'}
        </span>
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
