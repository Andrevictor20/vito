import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Platform, StyleSheet, View } from 'react-native';
import { MOTION_CURVES, MOTION_DURATIONS, VFX_COLORS } from './motion';
import { useReduceMotion } from './useReduceMotion';

export interface ThemeRevealPayload {
  x?: number;
  y?: number;
  backgroundColor: string;
  applyTheme: () => void;
}

const themeRevealListeners = new Set<(payload: ThemeRevealPayload) => void>();

/** Revelação circular na troca de tema (720ms View Transitions no Web / radial fallback nativo). */
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
  const anim = useRef(new Animated.Value(0)).current;

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
      anim.setValue(0);
      payload.applyTheme();
      Animated.timing(anim, {
        toValue: 1,
        duration: MOTION_DURATIONS.themeReveal,
        easing: Easing.bezier(...MOTION_CURVES.q),
        useNativeDriver: true,
      }).start(() => setReveal(null));
    };

    themeRevealListeners.add(handler);
    return () => {
      themeRevealListeners.delete(handler);
    };
  }, [anim, reduceMotion]);

  if (!reveal) return null;

  const size = reveal.radius * 2;
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.02, 1] });
  const opacity = anim.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0.22, 0.12, 0] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={{
          position: 'absolute',
          left: reveal.x - reveal.radius,
          top: reveal.y - reveal.radius,
          width: size,
          height: size,
          borderRadius: reveal.radius,
          backgroundColor: reveal.color,
          opacity,
          transform: [{ scale }],
        }}
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

const VfxBurstNode: React.FC<{ x: number; y: number }> = ({ x, y }) => {
  const ringAnim = useRef(new Animated.Value(0)).current;
  const particleAnim = useRef(new Animated.Value(0)).current;
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
    Animated.parallel([
      Animated.timing(ringAnim, {
        toValue: 1,
        duration: MOTION_DURATIONS.vfxRing,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(particleAnim, {
        toValue: 1,
        duration: MOTION_DURATIONS.vfxParticleMax,
        easing: Easing.bezier(...MOTION_CURVES.std),
        useNativeDriver: true,
      }),
    ]).start();
  }, [ringAnim, particleAnim]);

  return (
    <View style={{ position: 'absolute', left: x, top: y }} pointerEvents="none">
      <Animated.View
        style={{
          position: 'absolute',
          left: -13,
          top: -13,
          width: 26,
          height: 26,
          borderRadius: 13,
          borderWidth: 2,
          borderColor: VFX_COLORS[0],
          opacity: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
          transform: [
            { scale: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.3] }) },
          ],
        }}
      />
      {vectors.map((v, idx) => (
        <Animated.View
          key={idx}
          style={{
            position: 'absolute',
            left: -3,
            top: -3,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: v.color,
            opacity: particleAnim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 0.7, 0] }),
            transform: [
              {
                translateX: particleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, v.dx],
                }),
              },
              {
                translateY: particleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, v.dy],
                }),
              },
              { scale: particleAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
            ],
          }}
        />
      ))}
    </View>
  );
};
