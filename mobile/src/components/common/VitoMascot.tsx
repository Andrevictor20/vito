import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

// Corpo sem olhos: a camada animada é a única fonte dos olhos (evita o bug dos 4 olhos).
const MASCOT_BODY = require('../../../assets/mascot-body.png');

// Geometria medida no canvas 512x512 do mascot.png original (centros dos olhos).
const EYE = {
  width: 29 / 512,
  height: 71 / 512,
  centerY: 216.5 / 512,
  leftCenterX: 214.5 / 512,
  rightCenterX: 297.5 / 512,
};

// Movimento estilo "sacada + fixação": deslocamento rápido e suave seguido de pausa.
const SACCADE_EASING = Easing.bezier(0.33, 0, 0.2, 1);
const DRIFT_EASING = Easing.bezier(0.45, 0, 0.55, 1);

type Gaze = { x: number; y: number };

const IDLE_TARGETS: Gaze[] = [
  { x: 0, y: 0 },
  { x: 0.8, y: 0.1 },
  { x: -0.8, y: 0.1 },
  { x: 0.5, y: -0.4 },
  { x: -0.5, y: -0.4 },
  { x: 0, y: 0.35 },
];

const THINKING_TARGETS: Gaze[] = [
  { x: 0.9, y: -0.9 },
  { x: -0.7, y: -1 },
  { x: 0.2, y: -1 },
];

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

export interface VitoMascotProps {
  size?: number;
  animated?: boolean;
  state?: 'idle' | 'thinking' | 'success';
  style?: StyleProp<ViewStyle>;
}

/**
 * Componente executivo do mascote Vito (O Polvo Executivo).
 * Design comercial ultra-polido:
 * - Corpo estável; apenas os olhos (camada única) se movem.
 * - Piscar orgânico (2.8s - 6s) com piscada dupla ocasional.
 * - Idle: sacadas suaves entre pontos de fixação; thinking: olhar deriva para o alto.
 * - Success: recentra e pisca. Respeita "reduzir movimento" do sistema.
 */
export const VitoMascot: React.FC<VitoMascotProps> = ({
  size = 48,
  animated = true,
  state = 'idle',
  style,
}) => {
  const blink = useRef(new Animated.Value(1)).current;
  const gazeX = useRef(new Animated.Value(0)).current;
  const gazeY = useRef(new Animated.Value(0)).current;
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        reduceMotion.current = enabled;
      })
      .catch(() => undefined);
  }, []);

  const runBlink = (double: boolean, onEnd?: () => void) => {
    const close = Animated.timing(blink, {
      toValue: 0.1,
      duration: 70,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    const open = Animated.timing(blink, {
      toValue: 1,
      duration: 130,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    const steps = double
      ? [close, Animated.delay(30), open, Animated.delay(90), close, Animated.delay(30), open]
      : [close, Animated.delay(35), open];
    Animated.sequence(steps).start(() => onEnd?.());
  };

  useEffect(() => {
    if (!animated) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const schedule = (delay: number) => {
      timer = setTimeout(() => {
        if (!alive) return;
        runBlink(Math.random() < 0.18, () => alive && schedule(randomBetween(2800, 6000)));
      }, delay);
    };
    schedule(randomBetween(1200, 2400));

    return () => {
      alive = false;
      clearTimeout(timer);
      blink.stopAnimation();
      blink.setValue(1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animated, blink]);

  useEffect(() => {
    if (!animated) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let last: Gaze = { x: 0, y: 0 };
    const maxX = size * 0.035;
    const maxY = size * 0.025;

    const moveTo = (target: Gaze, duration: number, easing: (v: number) => number, onEnd: () => void) => {
      Animated.parallel([
        Animated.timing(gazeX, { toValue: target.x * maxX, duration, easing, useNativeDriver: true }),
        Animated.timing(gazeY, { toValue: target.y * maxY, duration, easing, useNativeDriver: true }),
      ]).start(({ finished }) => finished && alive && onEnd());
    };

    if (state === 'success') {
      moveTo({ x: 0, y: 0 }, 220, SACCADE_EASING, () => runBlink(false));
      return () => {
        alive = false;
      };
    }

    const targets = state === 'thinking' ? THINKING_TARGETS : IDLE_TARGETS;
    const holdRange: [number, number] = state === 'thinking' ? [700, 1400] : [1400, 3600];

    const step = () => {
      if (!alive) return;
      if (reduceMotion.current) {
        moveTo({ x: 0, y: 0 }, 200, SACCADE_EASING, () => undefined);
        return;
      }
      const candidates = targets.filter((t) => t.x !== last.x || t.y !== last.y);
      const next = candidates[Math.floor(Math.random() * candidates.length)];
      const distance = Math.hypot(next.x - last.x, next.y - last.y);
      const duration = state === 'thinking' ? 520 : 180 + distance * 110;
      // Olhares amplos costumam vir acompanhados de uma piscada.
      if (distance > 1.2 && Math.random() < 0.35) runBlink(false);
      last = next;
      moveTo(next, duration, state === 'thinking' ? DRIFT_EASING : SACCADE_EASING, () => {
        timer = setTimeout(step, randomBetween(holdRange[0], holdRange[1]));
      });
    };

    timer = setTimeout(step, state === 'thinking' ? 0 : randomBetween(1500, 3000));

    return () => {
      alive = false;
      clearTimeout(timer);
      gazeX.stopAnimation();
      gazeY.stopAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animated, state, size, gazeX, gazeY]);

  const eyeWidth = Math.max(2, size * EYE.width);
  const eyeHeight = Math.max(3, size * EYE.height);
  const eyeTop = size * EYE.centerY - eyeHeight / 2;

  const eyeStyle = (centerX: number) => [
    styles.eye,
    {
      width: eyeWidth,
      height: eyeHeight,
      borderRadius: eyeWidth / 2,
      top: eyeTop,
      left: size * centerX - eyeWidth / 2,
      transform: [{ translateX: gazeX }, { translateY: gazeY }, { scaleY: blink }],
    },
  ];

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Image source={MASCOT_BODY} style={{ width: size, height: size }} resizeMode="contain" />
      <Animated.View pointerEvents="none" style={eyeStyle(EYE.leftCenterX)} />
      <Animated.View pointerEvents="none" style={eyeStyle(EYE.rightCenterX)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  eye: {
    position: 'absolute',
    backgroundColor: '#000000',
  },
});

