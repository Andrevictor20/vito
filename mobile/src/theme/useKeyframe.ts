/**
 * useKeyframe.ts — Compila um KeyframeSpec em valores animados do React Native.
 *
 * - Respeita ReduceMotion (salta para o frame de repouso, sem animar).
 * - Usa native driver quando o spec só mexe em opacity/transform numérico.
 * - Exporta `progress` para consumidores SVG (strokeDashoffset).
 * - Nunca inventa animação: o spec vem sempre de `theme/keyframes.ts`.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, type ViewStyle } from 'react-native';
import { KEYFRAMES, type KeyframeFrame, type KeyframeSpec } from './keyframes';
import { useReduceMotion } from './useReduceMotion';

export interface UseKeyframeOptions {
  /** Roda ao montar (default true). */
  autoPlay?: boolean;
  /** Sobrepõe o delay do spec. */
  delay?: number;
  /** Repete indefinidamente (sobrepõe o spec). */
  loop?: boolean;
  /** Repetições finitas. */
  iterations?: number;
  /** Desliga a animação sem desmontar. */
  enabled?: boolean;
}

export interface KeyframeController {
  progress: Animated.Value;
  style: Animated.WithAnimatedObject<ViewStyle>;
  play: () => void;
  reset: () => void;
  isNative: boolean;
}

type AnimatedNumber = Animated.AnimatedInterpolation<number>;
type AnimatedString = Animated.AnimatedInterpolation<string>;

interface NormalizedKeyframe {
  at: number;
  opacity: number;
  translateX: number;
  translateXPercent: number;
  translateY: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  rotate: number;
}

const DEFAULTS = {
  opacity: 1,
  translateX: 0,
  translateXPercent: 0,
  translateY: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotate: 0,
} as const;

const ANIMATED_KEYS = [
  'opacity',
  'translateX',
  'translateXPercent',
  'translateY',
  'scale',
  'scaleX',
  'scaleY',
  'rotate',
] as const;

function normalizeFrames(spec: KeyframeSpec): NormalizedKeyframe[] {
  const sorted = [...spec.frames].sort((a, b) => a.at - b.at);
  const frames: NormalizedKeyframe[] = [];
  let previous: NormalizedKeyframe = { at: 0, ...DEFAULTS };

  for (const frame of sorted) {
    const next: NormalizedKeyframe = {
      at: frame.at,
      opacity: frame.opacity ?? previous.opacity,
      translateX: frame.translateX ?? previous.translateX,
      translateXPercent: frame.translateXPercent ?? previous.translateXPercent,
      translateY: frame.translateY ?? previous.translateY,
      scale: frame.scale ?? previous.scale,
      scaleX: frame.scaleX ?? previous.scaleX,
      scaleY: frame.scaleY ?? previous.scaleY,
      rotate: frame.rotate ?? previous.rotate,
    };
    frames.push(next);
    previous = next;
  }

  if (frames.length === 0) {
    frames.push({ at: 0, ...DEFAULTS });
  }
  if (frames[0].at > 0) {
    frames.unshift({ ...frames[0], at: 0 });
  }
  if (frames[frames.length - 1].at < 1) {
    frames.push({ ...frames[frames.length - 1], at: 1 });
  }
  return frames;
}

function usesPercent(frames: NormalizedKeyframe[]): boolean {
  return frames.some((frame) => frame.translateXPercent !== 0);
}

export function buildKeyframeStyle(
  progress: Animated.Value,
  spec: KeyframeSpec
): { style: Animated.WithAnimatedObject<ViewStyle>; isNative: boolean } {
  const frames = normalizeFrames(spec);
  const inputRange = frames.map((frame) => frame.at);
  const isNative = !usesPercent(frames);

  const interpolate = (key: (typeof ANIMATED_KEYS)[number]): AnimatedNumber =>
    progress.interpolate({
      inputRange,
      outputRange: frames.map((frame) => frame[key]),
    });

  const translateX = usesPercent(frames)
    ? progress.interpolate({
        inputRange,
        outputRange: frames.map((frame) => `${frame.translateXPercent}%`),
      })
    : interpolate('translateX');

  const rotate = progress.interpolate({
    inputRange,
    outputRange: frames.map((frame) => `${frame.rotate}deg`),
  }) as AnimatedString;

  return {
    isNative,
    style: {
      opacity: interpolate('opacity'),
      transform: [
        { translateX: translateX as AnimatedNumber | AnimatedString },
        { translateY: interpolate('translateY') },
        { scale: interpolate('scale') },
        { scaleX: interpolate('scaleX') },
        { scaleY: interpolate('scaleY') },
        { rotate },
      ],
    } as Animated.WithAnimatedObject<ViewStyle>,
  };
}

export function useKeyframe(
  name: string,
  options: UseKeyframeOptions = {}
): KeyframeController {
  const spec = KEYFRAMES[name];
  const reduceMotion = useReduceMotion();
  const { autoPlay = true, delay, loop, iterations, enabled = true } = options;

  if (!spec) {
    throw new Error(`[useKeyframe] Keyframe inexistente: ${name}`);
  }

  const progress = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const restingValue = spec.iterations === 'infinite' || loop ? 0 : 1;

  const stop = useCallback(() => {
    animationRef.current?.stop();
    animationRef.current = null;
  }, []);

  const play = useCallback(() => {
    stop();
    if (!enabled) return;
    if (reduceMotion) {
      progress.setValue(restingValue);
      return;
    }
    progress.setValue(0);
    const timing = Animated.timing(progress, {
      toValue: 1,
      duration: spec.duration,
      easing: Easing.bezier(...spec.easing),
      useNativeDriver: !usesPercent(normalizeFrames(spec)),
    });
    const delayMs = delay ?? spec.delay ?? 0;
    const sequence =
      delayMs > 0 ? Animated.sequence([Animated.delay(delayMs), timing]) : timing;
    const totalIterations = iterations ?? (loop ? undefined : spec.iterations);
    const animation =
      totalIterations === 'infinite' || (totalIterations === undefined && spec.iterations === 'infinite')
        ? Animated.loop(sequence)
        : totalIterations && totalIterations > 1
          ? Animated.loop(sequence, { iterations: totalIterations })
          : sequence;
    animationRef.current = animation;
    animation.start();
  }, [delay, enabled, iterations, loop, progress, reduceMotion, restingValue, spec, stop]);

  const reset = useCallback(() => {
    stop();
    progress.setValue(0);
  }, [progress, stop]);

  useEffect(() => {
    if (!autoPlay) return;
    play();
    return stop;
  }, [autoPlay, play, stop]);

  const { style, isNative } = useMemo(() => buildKeyframeStyle(progress, spec), [progress, spec]);

  return { progress, style, play, reset, isNative };
}

export type { KeyframeFrame, KeyframeSpec };
