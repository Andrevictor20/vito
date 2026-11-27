import React, { useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { MOTION_CURVES } from './motion';
import { useScreenEnterKey, useScreenFocus } from './screenFocusContext';
import { useReduceMotion } from './useReduceMotion';

/** Barra de progresso animada na UI thread (scaleX ancorado à esquerda, 850ms --ease-q). */
export const AnimatedProgressBar: React.FC<{
  pct: number;
  color: string;
  trackColor: string;
  height?: number;
  borderRadius?: number;
  delayMs?: number;
  durationMs?: number;
  replayKey?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}> = ({
  pct,
  color,
  trackColor,
  height = 8,
  borderRadius,
  delayMs = 260,
  durationMs = 850,
  replayKey = 0,
  style,
  children,
}) => {
  const reduceMotion = useReduceMotion();
  const { active, enterCount } = useScreenFocus();
  const clamped = Math.max(0, Math.min(100, pct));
  const fillWidth = useSharedValue(0);
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    cancelAnimation(progress);
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    if (!active) {
      progress.value = 0;
      return;
    }
    progress.value = 0;
    const timing = withTiming(1, {
      duration: durationMs,
      easing: Easing.bezier(
        MOTION_CURVES.q[0],
        MOTION_CURVES.q[1],
        MOTION_CURVES.q[2],
        MOTION_CURVES.q[3]
      ),
    });
    progress.value = delayMs > 0 ? withDelay(delayMs, timing) : timing;
    return () => cancelAnimation(progress);
  }, [clamped, delayMs, durationMs, reduceMotion, active, enterCount, replayKey, progress]);

  const handleFillLayout = useCallback(
    (e: LayoutChangeEvent) => {
      fillWidth.value = e.nativeEvent.layout.width;
    },
    [fillWidth]
  );

  const radius = borderRadius ?? height / 2;

  const fillAnimStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const w = fillWidth.value;
    const tx = w > 0 ? -(w * (1 - p)) / 2 : 0;
    return {
      transform: [{ translateX: tx }, { scaleX: Math.max(0.001, p) }],
    };
  });

  return (
    <View
      style={[
        barStyles.barTrack,
        { height, borderRadius: radius, backgroundColor: trackColor },
        style,
      ]}
    >
      {clamped > 0 && (
        <Animated.View
          onLayout={handleFillLayout}
          style={[
            barStyles.barFill,
            {
              width: `${clamped}%`,
              borderRadius: radius,
              backgroundColor: color,
            },
            fillAnimStyle,
          ]}
        />
      )}
      {children}
    </View>
  );
};

export interface SegmentedBarItem {
  key?: string;
  flex: number;
  color: string;
}

const AnimatedSegmentPiece: React.FC<{
  flex: number;
  color: string;
  radius: number;
  delayMs: number;
  durationMs: number;
  replayKey: number;
}> = ({ flex, color, radius, delayMs, durationMs, replayKey }) => {
  const reduceMotion = useReduceMotion();
  const { active, enterCount } = useScreenFocus();
  const segWidth = useSharedValue(0);
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    cancelAnimation(progress);
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    if (!active) {
      progress.value = 0;
      return;
    }
    progress.value = 0;
    const timing = withTiming(1, {
      duration: durationMs,
      easing: Easing.bezier(
        MOTION_CURVES.q[0],
        MOTION_CURVES.q[1],
        MOTION_CURVES.q[2],
        MOTION_CURVES.q[3]
      ),
    });
    progress.value = delayMs > 0 ? withDelay(delayMs, timing) : timing;
    return () => cancelAnimation(progress);
  }, [flex, delayMs, durationMs, reduceMotion, active, enterCount, replayKey, progress]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      segWidth.value = e.nativeEvent.layout.width;
    },
    [segWidth]
  );

  const animStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const w = segWidth.value;
    const tx = w > 0 ? -(w * (1 - p)) / 2 : 0;
    return {
      transform: [{ translateX: tx }, { scaleX: Math.max(0.001, p) }],
    };
  });

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        {
          flex: Math.max(0.15, flex),
          height: '100%',
          borderRadius: radius,
          backgroundColor: color,
        },
        animStyle,
      ]}
    />
  );
};

/** Barra horizontal segmentada (.fx-seg / .rs-tl / .rs-stk) crescendo da esquerda para direita. */
export const AnimatedSegmentedBar: React.FC<{
  segments: readonly SegmentedBarItem[];
  height?: number;
  borderRadius?: number;
  segmentRadius?: number;
  gap?: number;
  delayMs?: number;
  stepMs?: number;
  durationMs?: number;
  replayKey?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}> = ({
  segments,
  height = 10,
  borderRadius,
  segmentRadius = 4,
  gap = 3,
  delayMs = 200,
  stepMs = 110,
  durationMs = 880,
  replayKey = 0,
  style,
  children,
}) => {
  const enterKey = useScreenEnterKey();
  const radius = borderRadius ?? height / 2;

  return (
    <View style={[barStyles.segWrap, { height, borderRadius: radius, gap }, style]}>
      {segments.map((seg, idx) => (
        <AnimatedSegmentPiece
          key={seg.key ?? `seg_${idx}`}
          flex={seg.flex}
          color={seg.color}
          radius={segmentRadius}
          delayMs={delayMs + idx * stepMs}
          durationMs={durationMs}
          replayKey={replayKey + enterKey}
        />
      ))}
      {children}
    </View>
  );
};

const barStyles = StyleSheet.create({
  barTrack: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: {
    height: '100%',
  },
  segWrap: {
    flexDirection: 'row',
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
});
