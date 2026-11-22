import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import {
  MOTION_CURVES,
  MOTION_DURATIONS,
  PRESS_SCALE,
  SCREEN_TRANSITIONS,
  computeCountUpValue,
  formatCountUpValue,
  getStaggerDelayMs,
  type ScreenTransitionMode,
} from './motion';
import { useReduceMotion } from './useReduceMotion';

export { useReduceMotion };
export {
  CircularThemeRevealOverlay,
  VfxCelebrationOverlay,
  triggerThemeReveal,
  triggerVfxBurst,
  type ThemeRevealPayload,
  type VfxBurstEvent,
} from './vitoOverlays';

/** Entrada escalonada (45ms por filho) respeitando ReduceMotion. */
export function useStaggeredEntrance(index: number, enabled = true) {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(reduceMotion || !enabled ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion || !enabled) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: MOTION_DURATIONS.staggerEnter,
      delay: getStaggerDelayMs(index),
      easing: Easing.bezier(...MOTION_CURVES.q),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [index, enabled, reduceMotion, progress]);

  return useMemo(
    () => ({
      opacity: progress,
      transform: [
        {
          translateY: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [16, 0],
          }),
        },
      ],
    }),
    [progress]
  );
}

export const StaggerItem: React.FC<{
  index: number;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}> = ({ index, enabled = true, style, children }) => {
  const animStyle = useStaggeredEntrance(index, enabled);
  return <Animated.View style={[animStyle, style]}>{children}</Animated.View>;
};

/** Contador numérico exponencial (950ms pt-BR) com suporte estrito a ReduceMotion. */
export function useCountUp(
  target: number,
  options?: { durationMs?: number; decimals?: number; enabled?: boolean; locale?: string }
): string {
  const reduceMotion = useReduceMotion();
  const durationMs = options?.durationMs ?? MOTION_DURATIONS.countUp;
  const decimals = options?.decimals ?? 0;
  const enabled = options?.enabled ?? true;
  const locale = options?.locale ?? 'pt-BR';

  const [display, setDisplay] = useState<string>(() =>
    formatCountUpValue(reduceMotion || !enabled ? target : 0, decimals, locale)
  );

  useEffect(() => {
    if (reduceMotion || !enabled || !Number.isFinite(target) || target <= 0) {
      setDisplay(formatCountUpValue(target, decimals, locale));
      return;
    }

    let rafId = 0;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(1, elapsed / durationMs);
      setDisplay(formatCountUpValue(computeCountUpValue(target, p), decimals, locale));
      if (p < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, durationMs, decimals, enabled, locale, reduceMotion]);

  return display;
}

export const CountUpText: React.FC<{
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  style?: StyleProp<TextStyle>;
}> = ({ value, decimals = 0, prefix = '', suffix = '', style }) => {
  const formatted = useCountUp(value, { decimals });
  return (
    <Text style={[{ fontVariant: ['tabular-nums'] }, style]}>
      {prefix}
      {formatted}
      {suffix}
    </Text>
  );
};

/** Micro-compressão tátil (:active scale(0.965) em 130ms). */
export function usePressScale(targetScale = PRESS_SCALE) {
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    if (reduceMotion) return;
    Animated.timing(scale, {
      toValue: targetScale,
      duration: MOTION_DURATIONS.press,
      easing: Easing.bezier(...MOTION_CURVES.std),
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, scale, targetScale]);

  const onPressOut = useCallback(() => {
    if (reduceMotion) return;
    Animated.timing(scale, {
      toValue: 1,
      duration: MOTION_DURATIONS.press,
      easing: Easing.bezier(...MOTION_CURVES.std),
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, scale]);

  return { scale, onPressIn, onPressOut };
}

export const PressableScale: React.FC<
  PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number }
> = ({ style, scaleTo = PRESS_SCALE, onPressIn, onPressOut, children, ...rest }) => {
  const press = usePressScale(scaleTo);
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        press.onPressIn();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        press.onPressOut();
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale: press.scale }] }]}>
        {children as React.ReactNode}
      </Animated.View>
    </Pressable>
  );
};

/** Transição simultânea de tela (tr-tab/lv-tab, tr-push/lv-push, tr-pop/lv-pop). */
export const TransitioningView: React.FC<{
  visible: boolean;
  mode?: ScreenTransitionMode;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}> = ({ visible, mode = 'push', style, children }) => {
  const reduceMotion = useReduceMotion();
  const [rendered, setRendered] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const spec = SCREEN_TRANSITIONS[mode];

  useEffect(() => {
    if (visible) {
      setRendered(true);
      if (reduceMotion) {
        progress.setValue(1);
        return;
      }
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: spec.enterMs,
        delay: spec.enterDelayMs,
        easing: Easing.bezier(...spec.enterCurve),
        useNativeDriver: true,
      }).start();
    } else if (rendered) {
      if (reduceMotion) {
        progress.setValue(0);
        setRendered(false);
        return;
      }
      Animated.timing(progress, {
        toValue: -1,
        duration: spec.leaveMs,
        easing: Easing.bezier(...spec.leaveCurve),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [visible, reduceMotion, progress, spec, rendered]);

  if (!rendered) return null;

  const translateX = progress.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [spec.leaveOffset.x, spec.enterOffset.x, 0],
  });
  const translateY = progress.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [spec.leaveOffset.y, spec.enterOffset.y, 0],
  });
  const opacity = progress.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateX }, { translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};
