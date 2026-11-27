import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {
  MOTION_CURVES,
  MOTION_DURATIONS,
  PRESS_SCALE,
  computeCountUpValue,
  formatCountUpValue,
  getStaggerDelayMs,
} from './motion';
import { useScreenFocus } from './screenFocusContext';
import { useReduceMotion } from './useReduceMotion';

export { useReduceMotion };
export {
  ScreenFocusProvider,
  useScreenEnterKey,
  useScreenFocus,
  type ScreenFocusState,
} from './screenFocusContext';
export {
  AnimatedProgressBar,
  AnimatedSegmentedBar,
  type SegmentedBarItem,
} from './vitoMotionBars';
export {
  CircularThemeRevealOverlay,
  VfxCelebrationOverlay,
  triggerThemeReveal,
  triggerVfxBurst,
  type ThemeRevealPayload,
  type VfxBurstEvent,
} from './vitoOverlays';

/** Entrada escalonada (70ms + 45ms por bloco, 520ms --ease-q) na UI thread (Reanimated 4). */
export function useStaggeredEntrance(index: number, enabled = true, replayKey = 0) {
  const reduceMotion = useReduceMotion();
  const { active, enterCount } = useScreenFocus();
  const progress = useSharedValue(reduceMotion || !enabled ? 1 : 0);

  useEffect(() => {
    if (reduceMotion || !enabled) {
      cancelAnimation(progress);
      progress.value = 1;
      return;
    }
    if (!active) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    cancelAnimation(progress);
    progress.value = 0;
    const timing = withTiming(1, {
      duration: MOTION_DURATIONS.staggerEnter,
      easing: Easing.bezier(
        MOTION_CURVES.q[0],
        MOTION_CURVES.q[1],
        MOTION_CURVES.q[2],
        MOTION_CURVES.q[3]
      ),
    });
    const delayMs = getStaggerDelayMs(index);
    progress.value = delayMs > 0 ? withDelay(delayMs, timing) : timing;
    return () => cancelAnimation(progress);
  }, [index, enabled, reduceMotion, active, enterCount, replayKey, progress]);

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        translateY: interpolate(progress.value, [0, 1], [16, 0], Extrapolation.CLAMP),
      },
    ],
  }));
}

export const StaggerItem: React.FC<{
  index: number;
  enabled?: boolean;
  replayKey?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}> = ({ index, enabled = true, replayKey = 0, style, children }) => {
  const animStyle = useStaggeredEntrance(index, enabled, replayKey);
  return <Animated.View style={[animStyle, style]}>{children}</Animated.View>;
};

/** Contador numérico exponencial (950ms pt-BR, delay 140ms) reativo ao foco da seção. */
export function useCountUp(
  target: number,
  options?: {
    durationMs?: number;
    decimals?: number;
    enabled?: boolean;
    locale?: string;
    delayMs?: number;
    replayKey?: number;
  }
): string {
  const reduceMotion = useReduceMotion();
  const { active, enterCount } = useScreenFocus();
  const durationMs = options?.durationMs ?? MOTION_DURATIONS.countUp;
  const decimals = options?.decimals ?? 0;
  const enabled = options?.enabled ?? true;
  const locale = options?.locale ?? 'pt-BR';
  const delayMs = options?.delayMs ?? 140;
  const replayKey = options?.replayKey ?? 0;
  const absTarget = Number.isFinite(target) ? Math.abs(target) : 0;

  const [display, setDisplay] = useState<string>(() =>
    formatCountUpValue(reduceMotion || !enabled ? absTarget : 0, decimals, locale)
  );

  useEffect(() => {
    if (reduceMotion || !enabled || !Number.isFinite(target) || absTarget === 0) {
      setDisplay(formatCountUpValue(absTarget, decimals, locale));
      return;
    }
    if (!active) {
      setDisplay(formatCountUpValue(0, decimals, locale));
      return;
    }

    let rafId = 0;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    setDisplay(formatCountUpValue(0, decimals, locale));

    const startAnimation = () => {
      const start = Date.now();
      const tick = () => {
        const elapsed = Date.now() - start;
        const p = Math.min(1, elapsed / durationMs);
        setDisplay(formatCountUpValue(computeCountUpValue(absTarget, p), decimals, locale));
        if (p < 1) {
          rafId = requestAnimationFrame(tick);
        }
      };
      rafId = requestAnimationFrame(tick);
    };

    if (delayMs > 0) {
      timerId = setTimeout(startAnimation, delayMs);
    } else {
      startAnimation();
    }

    return () => {
      if (timerId !== null) clearTimeout(timerId);
      cancelAnimationFrame(rafId);
    };
  }, [absTarget, target, durationMs, decimals, enabled, locale, delayMs, reduceMotion, active, enterCount, replayKey]);

  return display;
}

export const CountUpText: React.FC<{
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  signed?: boolean;
  privacyHidden?: boolean;
  maskedText?: string;
  delayMs?: number;
  durationMs?: number;
  enabled?: boolean;
  replayKey?: number;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
}> = ({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  signed = false,
  privacyHidden = false,
  maskedText = 'R$ ••••',
  delayMs = 140,
  durationMs,
  enabled = true,
  replayKey = 0,
  numberOfLines,
  style,
}) => {
  const formatted = useCountUp(value, {
    decimals,
    delayMs,
    durationMs,
    enabled: enabled && !privacyHidden,
    replayKey,
  });

  if (privacyHidden) {
    return (
      <Text style={[{ fontVariant: ['tabular-nums'] }, style]} numberOfLines={numberOfLines}>
        {maskedText}
      </Text>
    );
  }

  const signPrefix = signed ? (value >= 0 ? '+' : '−') : value < 0 ? '−' : '';

  return (
    <Text style={[{ fontVariant: ['tabular-nums'] }, style]} numberOfLines={numberOfLines}>
      {signPrefix}
      {prefix}
      {formatted}
      {suffix}
    </Text>
  );
};

/** Micro-compressão tátil (:active scale(0.965) em 130ms) na UI thread (Reanimated 4). */
export function usePressScale(targetScale = PRESS_SCALE) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);

  const onPressIn = useCallback(() => {
    if (reduceMotion) return;
    scale.value = withTiming(targetScale, {
      duration: MOTION_DURATIONS.press,
      easing: Easing.bezier(
        MOTION_CURVES.std[0],
        MOTION_CURVES.std[1],
        MOTION_CURVES.std[2],
        MOTION_CURVES.std[3]
      ),
    });
  }, [reduceMotion, scale, targetScale]);

  const onPressOut = useCallback(() => {
    if (reduceMotion) return;
    scale.value = withTiming(1, {
      duration: MOTION_DURATIONS.press,
      easing: Easing.bezier(
        MOTION_CURVES.std[0],
        MOTION_CURVES.std[1],
        MOTION_CURVES.std[2],
        MOTION_CURVES.std[3]
      ),
    });
  }, [reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { scale, animatedStyle, onPressIn, onPressOut };
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
      <Animated.View style={[style, press.animatedStyle]}>
        {children as React.ReactNode}
      </Animated.View>
    </Pressable>
  );
};
