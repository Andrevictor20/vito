import { useEffect, useState, type CSSProperties } from 'react';

export const MOTION_CURVES = {
  std: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  q: 'cubic-bezier(0.22, 1, 0.36, 1)',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
} as const;

export const MOTION_DURATIONS = {
  dur1: 150,
  dur2: 220,
  dur3: 300,
  dur4: 400,
  staggerStep: 45,
  countUp: 950,
  themeReveal: 720,
  press: 130,
} as const;

export const VFX_COLORS = [
  '#ff2fa0',
  '#0a7cff',
  '#0aa55c',
  '#f08300',
  '#0aa5b5',
] as const;

export type ScreenTransitionMode = 'tab' | 'push' | 'pop';

export const SCREEN_TRANSITION_CLASSES: Record<
  ScreenTransitionMode,
  { enter: string; leave: string; leaveMs: number }
> = {
  tab: { enter: 'tr-tab', leave: 'lv-tab', leaveMs: 170 },
  push: { enter: 'tr-push', leave: 'lv-push', leaveMs: 300 },
  pop: { enter: 'tr-pop', leave: 'lv-pop', leaveMs: 300 },
};

export function isSystemReduceMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => isSystemReduceMotion());

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

export function getStaggerStyle(index: number): CSSProperties {
  return { '--stagger-i': Math.max(0, Math.min(13, index)) } as CSSProperties;
}

export function computeCountUpValue(target: number, progress: number): number {
  if (!Number.isFinite(target)) return 0;
  const p = Math.max(0, Math.min(1, progress));
  const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
  return target * eased;
}

export function useCountUp(
  target: number,
  options?: { durationMs?: number; decimals?: number; enabled?: boolean }
): string {
  const reduceMotion = useReduceMotion();
  const durationMs = options?.durationMs ?? MOTION_DURATIONS.countUp;
  const decimals = options?.decimals ?? 0;
  const enabled = options?.enabled ?? true;

  const format = (v: number) =>
    v.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  const [display, setDisplay] = useState<string>(() =>
    format(reduceMotion || !enabled ? target : 0)
  );

  useEffect(() => {
    if (reduceMotion || !enabled || !Number.isFinite(target) || target <= 0) {
      setDisplay(format(target));
      return;
    }
    let rafId = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      setDisplay(format(computeCountUpValue(target, p)));
      if (p < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, durationMs, decimals, enabled, reduceMotion]);

  return display;
}

/**
 * Revelação circular na troca de tema (720ms View Transitions API + fallback theme-fade).
 */
export function triggerCircularThemeReveal(params: {
  clientX?: number;
  clientY?: number;
  applyTheme: () => void;
  reduceMotion?: boolean;
}): void {
  const { applyTheme } = params;
  const rm = params.reduceMotion ?? isSystemReduceMotion();

  if (rm || typeof document === 'undefined') {
    applyTheme();
    return;
  }

  const root = document.documentElement as HTMLElement & {
    animate?: (kf: Keyframe[] | PropertyIndexedKeyframes, opt?: KeyframeAnimationOptions) => Animation;
  };
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => {
      ready: Promise<void>;
      finished: Promise<void>;
    };
  };

  if (typeof doc.startViewTransition === 'function') {
    const x = params.clientX && params.clientX > 0 ? params.clientX : window.innerWidth / 2;
    const y = params.clientY && params.clientY > 0 ? params.clientY : window.innerHeight / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );
    try {
      const vt = doc.startViewTransition(() => {
        root.classList.add('vt-switch');
        applyTheme();
      });
      vt.ready
        .then(() => {
          root.animate?.(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${radius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: MOTION_DURATIONS.themeReveal,
              easing: MOTION_CURVES.q,
              pseudoElement: '::view-transition-new(root)',
            }
          );
        })
        .catch(() => {});
      vt.finished.finally(() => root.classList.remove('vt-switch'));
      return;
    } catch {
      root.classList.remove('vt-switch');
    }
  }

  root.classList.add('theme-fade');
  applyTheme();
  window.setTimeout(() => root.classList.remove('theme-fade'), 500);
}

/**
 * Dispara explosão .vfx (12 partículas + anel) no ponto do elemento alvo.
 */
export function spawnVfxBurst(targetEl: HTMLElement | null): void {
  if (!targetEl || typeof document === 'undefined' || isSystemReduceMotion()) return;
  const rect = targetEl.getBoundingClientRect();
  const fx = document.createElement('div');
  fx.className = 'vfx';
  fx.style.left = `${rect.left + rect.width / 2}px`;
  fx.style.top = `${rect.top + rect.height / 2}px`;

  const ring = document.createElement('em');
  fx.appendChild(ring);
  ring.animate?.(
    [
      { transform: 'scale(0.6)', opacity: 0.9 },
      { transform: 'scale(2.3)', opacity: 0 },
    ],
    { duration: 560, easing: 'ease-out' }
  );

  for (let i = 0; i < 12; i++) {
    const dot = document.createElement('span');
    const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 26 + Math.random() * 24;
    dot.style.background = VFX_COLORS[i % VFX_COLORS.length];
    fx.appendChild(dot);
    dot.animate?.(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        {
          transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) scale(0)`,
          opacity: 0,
        },
      ],
      { duration: 620 + Math.random() * 180, easing: MOTION_CURVES.std }
    );
  }

  document.body.appendChild(fx);
  window.setTimeout(() => fx.remove(), 900);
}
