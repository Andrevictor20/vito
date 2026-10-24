import React, { useState, useRef, useCallback } from 'react';
import {
  CalIcon,
  MailIcon,
  RadarIcon,
  CheckCircleIcon,
  WhatsAppGlyph,
} from './ChatCardIcons';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

export interface IdeaCard {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  prompt: string;
  layout: 'agenda' | 'gmail' | 'whatsapp' | 'radar' | 'task';
}

export const IDEA_CARDS: IdeaCard[] = [
  {
    id: 'agenda',
    tag: 'Agenda',
    title: 'Organizar a semana',
    subtitle: 'Revisa horários, eventos e compromissos',
    prompt: 'Organiza a minha agenda da semana',
    layout: 'agenda',
  },
  {
    id: 'emails',
    tag: 'Gmail',
    title: 'Resumo dos e-mails',
    subtitle: 'Destaca mensagens urgentes e pendências',
    prompt: 'Resume os meus e-mails importantes de hoje',
    layout: 'gmail',
  },
  {
    id: 'whatsapp',
    tag: 'WhatsApp',
    title: 'Responder mensagens',
    subtitle: 'Rascunha respostas quando você estiver ocupado',
    prompt: 'Responde as mensagens do WhatsApp por mim quando eu estiver ocupado',
    layout: 'whatsapp',
  },
  {
    id: 'flight',
    tag: 'Radar',
    title: 'Voo para o Rio',
    subtitle: 'Alerta quando o preço baixar de R$ 600',
    prompt: 'Me avisa quando o voo para o Rio baixar de R$ 600',
    layout: 'radar',
  },
  {
    id: 'bills',
    tag: 'Tarefas',
    title: 'Contas e boletos',
    subtitle: 'Lembrar de pagamentos antes de vencer',
    prompt: 'Lembra das minhas contas e boletos antes de vencer',
    layout: 'task',
  },
  {
    id: 'schedule_msg',
    tag: 'WhatsApp',
    title: 'Agendar mensagem',
    subtitle: 'Envio programado para amanhã às 09h',
    prompt: 'Agenda uma mensagem de WhatsApp para amanhã às 9h',
    layout: 'whatsapp',
  },
  {
    id: 'briefing',
    tag: 'Agenda',
    title: 'Resumo executivo',
    subtitle: 'Síntese diária de foco e prioridades',
    prompt: 'Manda um resumo executivo do meu dia toda manhã',
    layout: 'agenda',
  },
];

interface ChatIdeasDeckProps {
  onUseIdea: (prompt: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const ChatIdeasDeck: React.FC<ChatIdeasDeckProps> = ({
  onUseIdea,
  disabled = false,
  compact = false,
}) => {
  const [cur, setCur] = useState(0);
  const n = IDEA_CARDS.length;
  const startXRef = useRef<number | null>(null);

  const getVisualConfig = (layout: IdeaCard['layout']) => {
    switch (layout) {
      case 'agenda':
        return {
          chipBg: 'bg-[#e4effb] dark:bg-[#16283b]',
          iconColor: '#2b7fd4',
          tagBg: 'bg-[#e4effb] dark:bg-[#16283b]',
          tagText: 'text-[#2b7fd4] dark:text-[#5aa2ee]',
          icon: <CalIcon color="#2b7fd4" size={compact ? 18 : 22} />,
        };
      case 'gmail':
        return {
          chipBg: 'bg-[#fde6ec] dark:bg-[#3a1620]',
          iconColor: '#d6355a',
          tagBg: 'bg-[#fde6ec] dark:bg-[#3a1620]',
          tagText: 'text-[#d6355a] dark:text-[#ff6b8a]',
          icon: <MailIcon color="#d6355a" size={compact ? 18 : 22} />,
        };
      case 'whatsapp':
        return {
          chipBg: 'bg-[#ddf4e8] dark:bg-[#12302a]',
          iconColor: '#0b9a5f',
          tagBg: 'bg-[#ddf4e8] dark:bg-[#12302a]',
          tagText: 'text-[#0b9a5f] dark:text-[#34d399]',
          icon: <WhatsAppGlyph color="#0b9a5f" size={compact ? 20 : 24} />,
        };
      case 'radar':
        return {
          chipBg: 'bg-[#fbebdb] dark:bg-[#35230f]',
          iconColor: '#d9681a',
          tagBg: 'bg-[#fbebdb] dark:bg-[#35230f]',
          tagText: 'text-[#d9681a] dark:text-[#ff9a52]',
          icon: <RadarIcon color="#d9681a" size={compact ? 18 : 22} />,
        };
      case 'task':
      default:
        return {
          chipBg: 'bg-[#eee8fd] dark:bg-[#241a42]',
          iconColor: '#7a4fe0',
          tagBg: 'bg-[#eee8fd] dark:bg-[#241a42]',
          tagText: 'text-[#7a4fe0] dark:text-[#a58bff]',
          icon: <CheckCircleIcon color="#7a4fe0" size={compact ? 18 : 22} />,
        };
    }
  };

  const getOffset = (i: number, current: number, total: number) => {
    let d = (i - current + total) % total;
    if (d > total / 2) {
      d = d - total;
    }
    return d;
  };

  const goNext = useCallback(() => {
    setCur((prev) => (prev + 1) % n);
  }, [n]);

  const goPrev = useCallback(() => {
    setCur((prev) => (prev - 1 + n) % n);
  }, [n]);

  // Se for compacto (usado no MiniChatWidget ou mobile drawer)
  if (compact) {
    return (
      <div className="space-y-4 w-full">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Sparkles size={14} className="text-emerald-500" />
            Sugestões do Vito
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goPrev}
              className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              title="Anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-mono font-bold text-zinc-400">
              {cur + 1}/{n}
            </span>
            <button
              type="button"
              onClick={goNext}
              className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              title="Próximo"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Card em destaque compacto */}
        {(() => {
          const card = IDEA_CARDS[cur];
          const visual = getVisualConfig(card.layout);
          return (
            <div className="p-5 rounded-[26px] bg-white dark:bg-[#12151A] border border-zinc-200 dark:border-[#262B33] shadow-lg flex flex-col justify-between space-y-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
              <div className="flex items-center justify-between">
                <div className={`w-11 h-11 rounded-2xl ${visual.chipBg} flex items-center justify-center shrink-0 shadow-2xs`}>
                  {visual.icon}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${visual.tagBg} ${visual.tagText}`}>
                  {card.tag}
                </span>
              </div>

              <div>
                <h4 className="text-base font-extrabold text-zinc-900 dark:text-white leading-snug">
                  {card.title}
                </h4>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  {card.subtitle}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={goNext}
                  className="text-xs font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  Ver mais ideias ›
                </button>
                <button
                  type="button"
                  onClick={() => onUseIdea(card.prompt)}
                  disabled={disabled}
                  className="px-5 py-2 rounded-full bg-[#17191b] hover:bg-black dark:bg-[#f1f3f2] dark:hover:bg-white text-white dark:text-[#09090B] text-xs font-bold shadow-sm hover:scale-105 active:scale-95 transition-all"
                >
                  Usar
                </button>
              </div>
            </div>
          );
        })()}

        {/* Grid de mini-pílulas adicionais das ideias restantes */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {IDEA_CARDS.filter((_, idx) => idx !== cur).slice(0, 4).map((c) => {
            const v = getVisualConfig(c.layout);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onUseIdea(c.prompt)}
                className="p-3 rounded-2xl bg-zinc-50 hover:bg-zinc-100 dark:bg-[#0B0D10]/70 dark:hover:bg-[#1A1E24] border border-zinc-200/80 dark:border-[#222730] flex items-center gap-2.5 text-left transition-all group"
              >
                <div className={`w-8 h-8 rounded-xl ${v.chipBg} flex items-center justify-center shrink-0`}>
                  {v.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                    {c.title}
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate">
                    {c.tag}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Visual Widescreen Desktop 3D Deck Interativo
  return (
    <div className="flex flex-col items-center justify-center w-full my-6 select-none">
      {/* 3D Deck Viewport */}
      <div
        className="relative w-full max-w-[580px] h-[280px] flex items-center justify-center perspective-[1000px]"
        onPointerDown={(e) => {
          startXRef.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (startXRef.current !== null) {
            const dx = e.clientX - startXRef.current;
            if (Math.abs(dx) > 30) {
              if (dx < 0) goNext();
              else goPrev();
            }
            startXRef.current = null;
          }
        }}
      >
        {IDEA_CARDS.map((card, i) => {
          const d = getOffset(i, cur, n);
          const isCurrent = d === 0;
          const isNext = d === 1;
          const isPrev = d === -1;
          const isVisible = isCurrent || isNext || isPrev;

          if (!isVisible) return null;

          const visual = getVisualConfig(card.layout);

          // Posições e rotações 3D réplicas exatas de vito-telas.html
          let transformStyle = '';
          let zIndex = 1;
          let opacity = 0;

          if (isCurrent) {
            transformStyle = 'translateX(0px) rotate(0deg) scale(1)';
            zIndex = 20;
            opacity = 1;
          } else if (isNext) {
            transformStyle = 'translateX(140px) rotate(5deg) scale(0.92)';
            zIndex = 10;
            opacity = 0.85;
          } else if (isPrev) {
            transformStyle = 'translateX(-140px) rotate(-5deg) scale(0.92)';
            zIndex = 10;
            opacity = 0.85;
          }

          return (
            <div
              key={card.id}
              onClick={() => {
                if (isNext) goNext();
                else if (isPrev) goPrev();
              }}
              style={{
                transform: transformStyle,
                zIndex,
                opacity,
              }}
              className={`absolute top-0 w-[270px] sm:w-[285px] h-[260px] rounded-[32px] p-6 flex flex-col justify-between transition-all duration-400 ease-[cubic-bezier(0.2,0.8,0.2,1)] cursor-pointer ${
                isCurrent
                  ? 'bg-white dark:bg-[#12151A] border-2 border-zinc-200/90 dark:border-[#2A303C] shadow-[0_16px_36px_rgba(20,25,22,0.14)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.45)]'
                  : 'bg-zinc-50/95 dark:bg-[#0D0F12]/95 border border-zinc-200/60 dark:border-[#1E232B] shadow-md hover:opacity-95'
              }`}
            >
              {/* Top: Chip 44x44px com Ícone + Tag Pílula */}
              <div className="flex items-center justify-between">
                <div className={`w-12 h-12 rounded-2xl ${visual.chipBg} flex items-center justify-center shrink-0 shadow-2xs`}>
                  {visual.icon}
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-extrabold ${visual.tagBg} ${visual.tagText}`}>
                  {card.tag}
                </div>
              </div>

              {/* Middle: Título e Descrição */}
              <div>
                <h3 className="font-display font-extrabold text-lg text-zinc-900 dark:text-white leading-tight">
                  {card.title}
                </h3>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                  {card.subtitle}
                </p>
              </div>

              {/* Bottom: Botão Pílula "Usar" no card central */}
              <div className="flex items-center justify-end pt-1">
                {isCurrent ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUseIdea(card.prompt);
                    }}
                    disabled={disabled}
                    className="px-6 py-2.5 rounded-full bg-[#17191b] hover:bg-black dark:bg-[#f1f3f2] dark:hover:bg-white text-white dark:text-[#09090B] text-xs font-extrabold shadow-sm hover:scale-105 active:scale-95 transition-all"
                  >
                    Usar
                  </button>
                ) : (
                  <span className="text-xs font-bold text-zinc-400 group-hover:text-zinc-600">
                    Toque para ver
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Controles de Navegação e Botão "Ver mais ideias" */}
      <div className="flex items-center gap-4 mt-3">
        <button
          type="button"
          onClick={goPrev}
          className="p-2 rounded-full border border-zinc-200 dark:border-[#222730] bg-white dark:bg-[#14171C] text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 transition-colors shadow-2xs"
          title="Ideia anterior"
        >
          <ChevronLeft size={18} />
        </button>

        <button
          type="button"
          onClick={goNext}
          className="px-5 py-2 rounded-full border border-zinc-200 dark:border-[#222730] bg-white dark:bg-[#14171C] hover:bg-zinc-50 dark:hover:bg-[#1C2026] text-xs font-bold text-zinc-800 dark:text-zinc-200 shadow-2xs transition-all hover:scale-102"
        >
          Ver mais ideias
        </button>

        <button
          type="button"
          onClick={goNext}
          className="p-2 rounded-full border border-zinc-200 dark:border-[#222730] bg-white dark:bg-[#14171C] text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 transition-colors shadow-2xs"
          title="Próxima ideia"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};
