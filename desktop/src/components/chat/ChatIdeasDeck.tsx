import React, { useCallback, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import {
  CalIcon,
  CheckCircleIcon,
  MailIcon,
  RadarIcon,
  WhatsAppGlyph,
} from './ChatCardIcons';

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
    title: 'Organizar a minha agenda da semana',
    subtitle: 'Revisa horários, eventos e compromissos',
    prompt: 'Organiza a minha agenda da semana',
    layout: 'agenda',
  },
  {
    id: 'emails',
    tag: 'Gmail',
    title: 'Resumir os e-mails importantes do dia',
    subtitle: 'Destaca mensagens urgentes e pendências',
    prompt: 'Resume os meus e-mails importantes de hoje',
    layout: 'gmail',
  },
  {
    id: 'whatsapp',
    tag: 'WhatsApp',
    title: 'Responder o WhatsApp quando eu não puder',
    subtitle: 'Rascunha respostas quando você estiver ocupado',
    prompt: 'Responde as mensagens do WhatsApp por mim quando eu estiver ocupado',
    layout: 'whatsapp',
  },
  {
    id: 'flight',
    tag: 'Bot',
    title: 'Voo para o Rio abaixo de R$ 600',
    subtitle: 'Alerta quando o preço baixar de R$ 600',
    prompt: 'Me avisa quando o voo para o Rio baixar de R$ 600',
    layout: 'radar',
  },
  {
    id: 'bills',
    tag: 'Tarefas',
    title: 'Lembrar das minhas contas e boletos',
    subtitle: 'Lembrar de pagamentos antes de vencer',
    prompt: 'Lembra das minhas contas e boletos antes de vencer',
    layout: 'task',
  },
  {
    id: 'schedule_msg',
    tag: 'WhatsApp',
    title: 'Agendar mensagens de WhatsApp',
    subtitle: 'Envio programado para amanhã às 09h',
    prompt: 'Agenda uma mensagem de WhatsApp para amanhã às 9h',
    layout: 'whatsapp',
  },
  {
    id: 'briefing',
    tag: 'Agenda',
    title: 'Um resumo executivo toda manhã',
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
          tint: 'bg-[color-mix(in_srgb,var(--blue)_11%,var(--surf))]',
          chipBg: 'bg-[var(--blue-bg)]',
          icon: <CalIcon color="var(--blue)" size={compact ? 18 : 20} />,
        };
      case 'gmail':
        return {
          tint: 'bg-[color-mix(in_srgb,var(--red)_11%,var(--surf))]',
          chipBg: 'bg-[var(--red-bg)]',
          icon: <MailIcon color="var(--red)" size={compact ? 18 : 20} />,
        };
      case 'whatsapp':
        return {
          tint: 'bg-[color-mix(in_srgb,var(--acc)_11%,var(--surf))]',
          chipBg: 'bg-[var(--green-bg)]',
          icon: <WhatsAppGlyph color="var(--acc)" size={compact ? 20 : 22} />,
        };
      case 'radar':
        return {
          tint: 'bg-[color-mix(in_srgb,var(--orange)_11%,var(--surf))]',
          chipBg: 'bg-[var(--orange-bg)]',
          icon: <RadarIcon color="var(--orange)" size={compact ? 18 : 20} />,
        };
      case 'task':
      default:
        return {
          tint: 'bg-[color-mix(in_srgb,var(--purple)_11%,var(--surf))]',
          chipBg: 'bg-[var(--purple-bg)]',
          icon: <CheckCircleIcon color="var(--purple)" size={compact ? 18 : 20} />,
        };
    }
  };

  const getOffset = (i: number, current: number, total: number) => {
    let d = (i - current + total) % total;
    if (d > total / 2) d -= total;
    return d;
  };

  const goNext = useCallback(() => setCur((prev) => (prev + 1) % n), [n]);
  const goPrev = useCallback(() => setCur((prev) => (prev - 1 + n) % n), [n]);

  if (compact) {
    const card = IDEA_CARDS[cur];
    const visual = getVisualConfig(card.layout);
    return (
      <div className="space-y-4 w-full">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-[var(--muted)] flex items-center gap-1.5">
            <Sparkles size={14} className="text-[var(--acc)]" />
            Sugestões do Vito
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goPrev}
              className="v5-press p-1.5 rounded-full hover:bg-[var(--surf)] text-[var(--muted)] hover:text-[var(--ink)]"
              title="Anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-mono tabular-nums text-[var(--muted)]">
              {cur + 1}/{n}
            </span>
            <button
              type="button"
              onClick={goNext}
              className="v5-press p-1.5 rounded-full hover:bg-[var(--surf)] text-[var(--muted)] hover:text-[var(--ink)]"
              title="Próximo"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className={`p-5 rounded-[22px] ${visual.tint} flex flex-col justify-between space-y-4`}>
          <div className="flex items-center justify-between">
            <div className={`w-10 h-10 rounded-xl ${visual.chipBg} flex items-center justify-center shrink-0`}>
              {visual.icon}
            </div>
          </div>
          <div>
            <h4 className="text-[17px] font-medium text-[var(--ink)] leading-snug tracking-tight">
              {card.title}
            </h4>
            <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">{card.subtitle}</p>
          </div>
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => onUseIdea(card.prompt)}
              disabled={disabled}
              className="v5-press h-10 px-5 rounded-full bg-[var(--ink)] text-[var(--bg)] text-xs font-medium"
            >
              Usar
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* Deck .zc estático e simétrico (sem rotação 3D inclinada e sem auto-rotação) */
  return (
    <div className="flex flex-col items-center justify-center w-full my-5 select-none">
      <div
        className="relative w-full max-w-[440px] h-[220px] flex items-center justify-center"
        onPointerDown={(e) => {
          startXRef.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (startXRef.current !== null) {
            const dx = e.clientX - startXRef.current;
            if (Math.abs(dx) > 36) {
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
          if (!isCurrent && !isNext && !isPrev) return null;

          const visual = getVisualConfig(card.layout);
          const transformStyle = isCurrent
            ? 'translateX(0px) scale(1)'
            : isNext
              ? 'translateX(56px) scale(0.9)'
              : 'translateX(-56px) scale(0.9)';

          return (
            <div
              key={card.id}
              onClick={() => {
                if (isNext) goNext();
                else if (isPrev) goPrev();
              }}
              style={{
                transform: transformStyle,
                zIndex: isCurrent ? 20 : 10,
              }}
              className={`absolute top-0 w-[276px] h-[216px] rounded-[22px] p-5 flex flex-col justify-between transition-all duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer ${
                visual.tint
              } ${isCurrent ? 'ring-4 ring-[var(--bg)]' : ''}`}
            >
              <div
                className={`flex flex-col justify-between h-full transition-opacity duration-300 ${
                  isCurrent ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-xl ${visual.chipBg} flex items-center justify-center shrink-0`}>
                    {visual.icon}
                  </div>
                </div>

                <div className="mt-auto">
                  <p className="text-[18px] font-medium text-[var(--ink)] leading-[1.27] tracking-[-0.02em]">
                    {card.title}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUseIdea(card.prompt);
                    }}
                    disabled={disabled || !isCurrent}
                    className="v5-press mt-3.5 h-11 px-5 rounded-full bg-[var(--ink)] text-[var(--bg)] text-sm font-medium"
                  >
                    Usar
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* .dk-dots indicador estático */}
      <div className="flex items-center justify-center gap-1.5 mt-4 h-2">
        {IDEA_CARDS.map((card, i) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setCur(i)}
            aria-label={`Ideia ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === cur ? 'w-[18px] bg-[var(--ink)]' : 'w-1.5 bg-[var(--line)]'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
