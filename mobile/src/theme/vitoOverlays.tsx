import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { MOTION_CURVES, MOTION_DURATIONS, VFX_COLORS } from './motion';
import { useReduceMotion } from './useReduceMotion';

export interface ThemeRevealPayload {
  x?: number;
  y?: number;
  backgroundColor: string;
  applyTheme: () => void;
}

const themeRevealListeners = new Set<(payload: ThemeRevealPayload) => void>();

/** Revelação circular na troca de tema (720ms View Transitions no Web / radial Reanimated 4 nativo). */
export function triggerThemeReveal(payload: ThemeRevealPayload): void {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => {
        ready: Promise<void>;
        finished: Promise<void>;
      };
    };
    const rm =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!rm && typeof doc.startViewTransition === 'function') {
      const x = payload.x ?? window.innerWidth / 2;
      const y = payload.y ?? window.innerHeight / 2;
      const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );
      const vt = doc.startViewTransition(() => {
        doc.documentElement.classList.add('vt-switch');
        payload.applyTheme();
      });
      vt.ready
        .then(() => {
          doc.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${radius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: MOTION_DURATIONS.themeReveal,
              easing: 'cubic-bezier(.22,1,.36,1)',
            }
          );
        })
        .catch(() => {});
      vt.finished.finally(() => doc.documentElement.classList.remove('vt-switch'));
      return;
    }
  }

  if (themeRevealListeners.size === 0) {
    payload.applyTheme();
    return;
  }
  themeRevealListeners.forEach((cb) => cb(payload));
}

export const CircularThemeRevealOverlay: React.FC = () => {
  const reduceMotion = useReduceMotion();
  const [reveal, setReveal] = useState<{
    x: number;
    y: number;
    color: string;
    radius: number;
  } | null>(null);
  const anim = useSharedValue(0);

  useEffect(() => {
    const handler = (payload: ThemeRevealPayload) => {
      if (reduceMotion) {
        payload.applyTheme();
        return;
      }
      const { width, height } = Dimensions.get('window');
      const x = payload.x ?? width / 2;
      const y = payload.y ?? height / 2;
      const radius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
      setReveal({ x, y, color: payload.backgroundColor, radius });
      anim.value = 0;
      payload.applyTheme();
      anim.value = withTiming(
        1,
        {
          duration: MOTION_DURATIONS.themeReveal,
          easing: Easing.bezier(
            MOTION_CURVES.q[0],
            MOTION_CURVES.q[1],
            MOTION_CURVES.q[2],
            MOTION_CURVES.q[3]
          ),
        },
        (finished) => {
          if (finished) {
            scheduleOnRN(setReveal, null);
          }
        }
      );
    };

    themeRevealListeners.add(handler);
    return () => {
      themeRevealListeners.delete(handler);
    };
  }, [anim, reduceMotion]);

  const circleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(anim.value, [0, 0.7, 1], [0.85, 0.45, 0], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(anim.value, [0, 1], [0.02, 1], Extrapolation.CLAMP) },
    ],
  }));

  if (!reveal) return null;

  const size = reveal.radius * 2;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]} pointerEvents="none">
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: reveal.x - reveal.radius,
            top: reveal.y - reveal.radius,
            width: size,
            height: size,
            borderRadius: reveal.radius,
            backgroundColor: reveal.color,
          },
          circleStyle,
        ]}
      />
    </View>
  );
};

export interface VfxBurstEvent {
  x: number;
  y: number;
}

const vfxListeners = new Set<(event: VfxBurstEvent) => void>();

/** Dispara explosão .vfx (12 partículas coloridas + anel expansivo). */
export function triggerVfxBurst(x: number, y: number): void {
  vfxListeners.forEach((cb) => cb({ x, y }));
}

export const VfxCelebrationOverlay: React.FC = () => {
  const reduceMotion = useReduceMotion();
  const [bursts, setBursts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const seqRef = useRef(0);

  useEffect(() => {
    const handler = (event: VfxBurstEvent) => {
      if (reduceMotion) return;
      const id = ++seqRef.current;
      setBursts((prev) => [...prev, { id, x: event.x, y: event.y }]);
      setTimeout(() => {
        setBursts((prev) => prev.filter((b) => b.id !== id));
      }, 900);
    };
    vfxListeners.add(handler);
    return () => {
      vfxListeners.delete(handler);
    };
  }, [reduceMotion]);

  if (bursts.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {bursts.map((b) => (
        <VfxBurstNode key={b.id} x={b.x} y={b.y} />
      ))}
    </View>
  );
};

const VfxParticle: React.FC<{
  dx: number;
  dy: number;
  color: string;
  progress: ReturnType<typeof useSharedValue<number>>;
}> = ({ dx, dy, color, progress }) => {
  const particleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.8, 1], [1, 0.7, 0], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [0, dx], Extrapolation.CLAMP) },
      { translateY: interpolate(progress.value, [0, 1], [0, dy], Extrapolation.CLAMP) },
      { scale: interpolate(progress.value, [0, 1], [1, 0], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: -3,
          top: -3,
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: color,
        },
        particleStyle,
      ]}
    />
  );
};

const VfxBurstNode: React.FC<{ x: number; y: number }> = ({ x, y }) => {
  const ringAnim = useSharedValue(0);
  const particleAnim = useSharedValue(0);
  const vectors = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2 + (i % 3) * 0.12;
        const dist = 28 + (i % 4) * 7;
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          color: VFX_COLORS[i % VFX_COLORS.length],
        };
      }),
    []
  );

  useEffect(() => {
    ringAnim.value = withTiming(1, {
      duration: MOTION_DURATIONS.vfxRing,
      easing: Easing.out(Easing.ease),
    });
    particleAnim.value = withTiming(1, {
      duration: MOTION_DURATIONS.vfxParticleMax,
      easing: Easing.bezier(
        MOTION_CURVES.std[0],
        MOTION_CURVES.std[1],
        MOTION_CURVES.std[2],
        MOTION_CURVES.std[3]
      ),
    });
  }, [ringAnim, particleAnim]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ringAnim.value, [0, 1], [0.9, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(ringAnim.value, [0, 1], [0.6, 2.3], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={{ position: 'absolute', left: x, top: y }} pointerEvents="none">
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: -13,
            top: -13,
            width: 26,
            height: 26,
            borderRadius: 13,
            borderWidth: 2,
            borderColor: VFX_COLORS[0],
          },
          ringStyle,
        ]}
      />
      {vectors.map((v, idx) => (
        <VfxParticle key={idx} dx={v.dx} dy={v.dy} color={v.color} progress={particleAnim} />
      ))}
    </View>
  );
};
