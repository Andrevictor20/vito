import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { loginPalette } from './loginPalette';
import { VitoAnimatedLogo } from './VitoAnimatedLogo';

export const ONBOARDING_SEEN_KEY = 'vito_onb';

export function hasSeenDesktopOnboarding(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(ONBOARDING_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markDesktopOnboardingSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ONBOARDING_SEEN_KEY, '1');
  } catch {
    // noop
  }
}

export interface OnboardingViewProps {
  onComplete: () => void;
}

const SLIDES = [
  {
    id: 'intro',
    title: 'Conheça o Vito',
    desc: 'Seu assistente pessoal com IA para organizar a rotina: agenda, tarefas e finanças em um só lugar.',
  },
  {
    id: 'agenda-tarefas',
    title: 'Agenda e tarefas sem esforço',
    desc: 'Fale ou digite do seu jeito. O Vito marca compromissos, cria tarefas e lembra você na hora certa.',
  },
  {
    id: 'financas',
    title: 'Suas finanças, conectadas',
    desc: 'Conecte seus bancos com Open Finance e acompanhe saldo, gastos e faturas em tempo real.',
  },
  {
    id: 'bots',
    title: 'Bots que trabalham por você',
    desc: 'Bots vigiam o que importa e só agem depois da sua aprovação. Você sempre no controle.',
  },
] as const;

const FIN_BARS = [40, 62, 48, 78, 55, 92, 70];

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete }) => {
  const { isDark } = useTheme();
  const palette = loginPalette(isDark);
  const [index, setIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartRef = useRef<number | null>(null);

  const isLast = index === SLIDES.length - 1;

  const goTo = useCallback((next: number) => {
    setIndex(Math.max(0, Math.min(SLIDES.length - 1, next)));
  }, []);

  const finish = useCallback(() => {
    markDesktopOnboardingSeen();
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goTo(index + 1);
      if (e.key === 'ArrowLeft') goTo(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, goTo]);

  return (
    <main
      id="vonb"
      role="dialog"
      aria-label="Boas-vindas ao Vito"
      style={{ backgroundColor: palette.page, color: palette.ink }}
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 select-none"
    >
      <div
        style={{ backgroundColor: palette.bg, borderColor: palette.hairline }}
        className="w-full max-w-[460px] h-[720px] max-h-[92vh] rounded-[32px] border shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-7 pt-5">
          <VitoAnimatedLogo size={36} state="blink" showWordmark />
          <button
            type="button"
            id="ob-skip"
            onClick={finish}
            disabled={isLast}
            style={{ color: palette.muted }}
            className={`min-h-[44px] px-3 text-sm font-medium rounded-full transition-opacity ${
              isLast ? 'opacity-0 pointer-events-none' : 'opacity-100 hover:opacity-75'
            }`}
          >
            Pular
          </button>
        </div>

        <div
          className="flex-1 min-h-0 flex transition-transform duration-500 ease-out cursor-grab active:cursor-grabbing"
          style={{
            transform: `translateX(calc(-${index * 100}% + ${dragOffset}px))`,
            transition: dragStartRef.current !== null ? 'none' : undefined,
          }}
          onPointerDown={(e) => {
            dragStartRef.current = e.clientX;
            setDragOffset(0);
          }}
          onPointerMove={(e) => {
            if (dragStartRef.current === null) return;
            const dx = e.clientX - dragStartRef.current;
            if (Math.abs(dx) > 6) setDragOffset(dx);
          }}
          onPointerUp={() => {
            if (dragStartRef.current === null) return;
            const dx = dragOffset;
            dragStartRef.current = null;
            setDragOffset(0);
            if (Math.abs(dx) > 50) {
              goTo(index + (dx < 0 ? 1 : -1));
            }
          }}
          onPointerLeave={() => {
            if (dragStartRef.current !== null) {
              dragStartRef.current = null;
              setDragOffset(0);
            }
          }}
        >
          {SLIDES.map((slide, idx) => (
            <section key={slide.id} className="w-full shrink-0 flex flex-col px-7 pb-4">
              <div className="flex-1 min-h-0 relative flex items-center justify-center">
                {idx === 0 && (
                  <div className="relative w-full h-[280px] flex items-center justify-center">
                    <div
                      className="w-[240px] h-[240px] rounded-full blur-xl opacity-35 absolute"
                      style={{
                        background: `radial-gradient(circle at 35% 30%, ${palette.blue}, ${palette.purple} 55%, transparent 72%)`,
                      }}
                    />
                    <VitoAnimatedLogo size={200} showWordmark={false} state="gentleman" />
                    <span
                      style={{ backgroundColor: palette.bg, borderColor: palette.hairline }}
                      className="absolute left-2 top-12 px-3.5 py-1.5 rounded-2xl border shadow-md text-[13px] font-medium"
                    >
                      Agenda
                    </span>
                    <span
                      style={{ backgroundColor: palette.bg, borderColor: palette.hairline }}
                      className="absolute right-1 top-24 px-3.5 py-1.5 rounded-2xl border shadow-md text-[13px] font-medium"
                    >
                      Tarefas
                    </span>
                    <span
                      style={{ backgroundColor: palette.bg, borderColor: palette.hairline }}
                      className="absolute left-8 bottom-8 px-3.5 py-1.5 rounded-2xl border shadow-md text-[13px] font-medium"
                    >
                      Finanças
                    </span>
                  </div>
                )}

                {idx === 1 && (
                  <div className="w-full max-w-[320px] flex flex-col gap-2.5">
                    <div
                      style={{ backgroundColor: palette.blueBg, boxShadow: `inset 4px 0 0 ${palette.blue}` }}
                      className="rounded-2xl px-3.5 py-3"
                    >
                      <small style={{ color: palette.muted }} className="block text-xs font-medium tabular-nums">
                        08:00
                      </small>
                      <b className="block text-[15px] font-medium mt-0.5">Visita técnica à Vale</b>
                      <span style={{ color: palette.muted }} className="text-xs">
                        5 participantes confirmaram
                      </span>
                    </div>
                    <div
                      style={{ backgroundColor: palette.purpleBg, boxShadow: `inset 4px 0 0 ${palette.purple}` }}
                      className="rounded-2xl px-3.5 py-3"
                    >
                      <small style={{ color: palette.muted }} className="block text-xs font-medium tabular-nums">
                        14:30
                      </small>
                      <b className="block text-[15px] font-medium mt-0.5">Reunião de sprint</b>
                      <span style={{ color: palette.muted }} className="text-xs">
                        Horário sugerido pelo Vito
                      </span>
                    </div>
                    <div style={{ backgroundColor: palette.surf }} className="flex items-center gap-3 px-3.5 py-3 rounded-2xl">
                      <span
                        style={{ backgroundColor: palette.purple }}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      >
                        ✓
                      </span>
                      <b className="text-[15px] font-medium">Enviar pauta da sprint</b>
                    </div>
                    <div
                      style={{ backgroundColor: palette.ink, color: palette.bg }}
                      className="self-end max-w-[90%] px-3.5 py-2.5 rounded-[18px] rounded-br-[4px] text-[13.5px]"
                    >
                      “Agende a visita na sexta às 8h”
                    </div>
                  </div>
                )}

                {idx === 2 && (
                  <div
                    style={{ backgroundColor: palette.surf, borderColor: palette.hairline }}
                    className="w-full max-w-[320px] p-5 rounded-[22px] border shadow-sm"
                  >
                    <small style={{ color: palette.muted }} className="text-[12.5px] font-medium">
                      Saldo conectado
                    </small>
                    <div className="text-[36px] leading-[1.1] font-medium tracking-[-0.03em] mt-1 tabular-nums">
                      R$ 4.280<span style={{ color: palette.muted }} className="text-[20px]">,50</span>
                    </div>
                    <div className="flex items-end gap-2 h-[84px] my-4">
                      {FIN_BARS.map((h, barIdx) => (
                        <div
                          key={barIdx}
                          style={{
                            height: `${h}%`,
                            backgroundColor: barIdx === 5 ? palette.blue : palette.blueBg,
                          }}
                          className="flex-1 rounded-md transition-all duration-500"
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-[12.5px] font-medium">
                      <span style={{ backgroundColor: palette.acc }} className="w-2 h-2 rounded-full animate-pulse" />
                      <span>Open Finance · 3 contas conectadas</span>
                    </div>
                  </div>
                )}

                {idx === 3 && (
                  <div className="w-full max-w-[320px] flex flex-col gap-2.5">
                    {[
                      { title: 'Fatura do cartão', sub: 'Vence em 3 dias', color: palette.orange, bg: palette.orangeBg, cta: 'Aprovar', primary: true },
                      { title: 'Bot de e-mails', sub: '2 mensagens importantes', color: palette.blue, bg: palette.blueBg, cta: 'Ver', primary: false },
                      { title: 'Visita técnica', sub: 'Votação confirmada', color: palette.acc, bg: palette.greenBg, cta: 'Ver', primary: false },
                    ].map((b) => (
                      <div
                        key={b.title}
                        style={{ backgroundColor: palette.surf }}
                        className="flex items-center gap-3 px-3.5 py-3 rounded-[18px]"
                      >
                        <div style={{ backgroundColor: b.bg }} className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
                          <span style={{ backgroundColor: b.color }} className="w-2.5 h-2.5 rounded-full animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <b className="block text-[14.5px] font-medium truncate">{b.title}</b>
                          <small style={{ color: palette.muted }} className="text-xs truncate block">
                            {b.sub}
                          </small>
                        </div>
                        <span
                          style={{
                            backgroundColor: b.primary ? palette.ink : palette.btn,
                            color: b.primary ? palette.bg : palette.ink,
                          }}
                          className="px-3 py-1.5 rounded-xl text-[12.5px] font-medium shrink-0"
                        >
                          {b.cta}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <h2 className="text-[28px] leading-[1.15] font-semibold tracking-[-0.035em] mb-2.5">
                {slide.title}
              </h2>
              <p style={{ color: palette.muted }} className="text-[15px] leading-[1.5]">
                {slide.desc}
              </p>
            </section>
          ))}
        </div>

        <div className="px-7 pb-6 pt-2">
          <div className="flex items-center justify-center gap-1.5 mb-4">
            {SLIDES.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(idx)}
                aria-label={`Ir para o passo ${idx + 1}`}
                style={{
                  width: idx === index ? 24 : 7,
                  backgroundColor: idx === index ? palette.ink : palette.line,
                }}
                className="h-[7px] rounded-[4px] transition-all duration-300"
              />
            ))}
          </div>

          <button
            type="button"
            id="ob-next"
            onClick={() => (isLast ? finish() : goTo(index + 1))}
            style={{ backgroundColor: palette.ink, color: palette.bg }}
            className="w-full h-[54px] rounded-[27px] font-semibold text-base transition-transform active:scale-[0.98]"
          >
            {isLast ? 'Começar' : 'Continuar'}
          </button>
        </div>
      </div>
    </main>
  );
};
