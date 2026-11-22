/**
 * motion.ts — Vito Motion v5 (Curvas canônicas, durações, transições, count-up e hápticos)
 * Sem imports diretos de react-native para rodar limpo em testes Node (`tsx --test`).
 */

let Haptics: {
  impactAsync?: (style: unknown) => Promise<void>;
  selectionAsync?: () => Promise<void>;
  notificationAsync?: (type: unknown) => Promise<void>;
  ImpactFeedbackStyle?: { Light: unknown; Medium: unknown };
  NotificationFeedbackType?: { Success: unknown };
} | null = null;

try {
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    Haptics = require('expo-haptics');
  }
} catch {
  Haptics = null;
}

export const MOTION_CURVES = {
  /** --ease-std: cubic-bezier(.2,.8,.2,1) */
  std: [0.2, 0.8, 0.2, 1] as const,
  /** --ease-q: cubic-bezier(.22,1,.36,1) — snappy quintic ease-out */
  q: [0.22, 1, 0.36, 1] as const,
  /** --ease-in: cubic-bezier(.4,0,1,1) */
  in: [0.4, 0, 1, 1] as const,
  /** --ease-out: cubic-bezier(0,0,.2,1) */
  out: [0, 0, 0.2, 1] as const,
} as const;

export const MOTION_DURATIONS = {
  dur1: 150,
  dur2: 220,
  dur3: 300,
  dur4: 400,
  press: 130,
  staggerStep: 45,
  staggerBaseDelay: 70,
  staggerEnter: 520,
  countUp: 950,
  themeReveal: 720,
  themeFadeFallback: 400,
  navBounce: 480,
  vfxRing: 560,
  vfxParticleMin: 620,
  vfxParticleMax: 800,
} as const;

export const PRESS_SCALE = 0.965;

export const VFX_COLORS = [
  '#ff2fa0',
  '#0a7cff',
  '#0aa55c',
  '#f08300',
  '#0aa5b5',
] as const;

export type ScreenTransitionMode = 'tab' | 'push' | 'pop';

export const SCREEN_TRANSITIONS: Record<
  ScreenTransitionMode,
  {
    enterMs: number;
    enterDelayMs: number;
    leaveMs: number;
    enterOffset: { x: number; y: number };
    leaveOffset: { x: number; y: number };
    enterCurve: readonly [number, number, number, number];
    leaveCurve: readonly [number, number, number, number];
  }
> = {
  tab: {
    enterMs: 360,
    enterDelayMs: 50,
    leaveMs: 170,
    enterOffset: { x: 0, y: 6 },
    leaveOffset: { x: 0, y: 0 },
    enterCurve: MOTION_CURVES.q,
    leaveCurve: MOTION_CURVES.in,
  },
  push: {
    enterMs: 440,
    enterDelayMs: 0,
    leaveMs: 300,
    enterOffset: { x: 30, y: 0 },
    leaveOffset: { x: -24, y: 0 },
    enterCurve: MOTION_CURVES.q,
    leaveCurve: [0.4, 0, 0.2, 1],
  },
  pop: {
    enterMs: 400,
    enterDelayMs: 0,
    leaveMs: 300,
    enterOffset: { x: -22, y: 0 },
    leaveOffset: { x: 30, y: 0 },
    enterCurve: MOTION_CURVES.q,
    leaveCurve: [0.4, 0, 0.2, 1],
  },
};

export function easeOutExpo(progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress));
  return clamped === 1 ? 1 : 1 - Math.pow(2, -10 * clamped);
}

export function computeCountUpValue(target: number, progress: number): number {
  if (!Number.isFinite(target)) return 0;
  return target * easeOutExpo(progress);
}

export function formatCountUpValue(
  value: number,
  decimals = 0,
  locale = 'pt-BR'
): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function getStaggerDelayMs(index: number, baseDelay = MOTION_DURATIONS.staggerBaseDelay): number {
  const safeIndex = Math.max(0, Math.min(13, Math.floor(index)));
  return baseDelay + safeIndex * MOTION_DURATIONS.staggerStep;
}

export const springs = {
  dockPill: {
    damping: 18,
    stiffness: 220,
    mass: 0.8,
  },
  cardPress: {
    damping: 15,
    stiffness: 300,
    mass: 0.6,
  },
  sheet: {
    damping: 24,
    stiffness: 260,
    mass: 1.0,
  },
  subtle: {
    damping: 20,
    stiffness: 180,
    mass: 1.0,
  },
};

export const hapticFeedback = {
  light: async () => {
    if (!Haptics?.impactAsync || !Haptics?.ImpactFeedbackStyle) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  },
  medium: async () => {
    if (!Haptics?.impactAsync || !Haptics?.ImpactFeedbackStyle) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  },
  selection: async () => {
    if (!Haptics?.selectionAsync) return;
    try {
      await Haptics.selectionAsync();
    } catch {}
  },
  success: async () => {
    if (!Haptics?.notificationAsync || !Haptics?.NotificationFeedbackType) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  },
};
