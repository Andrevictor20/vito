import React, { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, type CircleProps } from 'react-native-svg';
import { useTheme } from '../../../../context/ThemeContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface SummaryRingSvgProps {
  percent: number;
  color: string;
  size?: number;
  label?: string;
}

export const SummaryRingSvg: React.FC<SummaryRingSvgProps> = ({
  percent,
  color,
  size = 104,
  label,
}) => {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const r = 42;
  const circ = 2 * Math.PI * r;
  const anim = useSharedValue(0);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!mounted) return;
        if (reduced) {
          anim.value = clamped;
          return;
        }
        anim.value = 0;
        anim.value = withTiming(clamped, {
          duration: 950,
          easing: Easing.out(Easing.cubic),
        });
      })
      .catch(() => {
        anim.value = clamped;
      });
    return () => {
      mounted = false;
    };
  }, [clamped, anim]);

  const circleProps = useAnimatedProps<Partial<CircleProps>>(() => ({
    strokeDashoffset: interpolate(anim.value, [0, 100], [circ, 0], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={colors.line}
          strokeWidth={10}
        />
        <AnimatedCircle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          animatedProps={circleProps}
          transform="rotate(-90 50 50)"
        />
      </Svg>
      <View style={styles.center}>
        <Text
          style={[
            styles.pct,
            { color: colors.ink, fontSize: size <= 70 ? 15 : 22 },
          ]}
        >
          {clamped}%
        </Text>
        {label ? (
          <Text style={[styles.subLabel, { color: colors.muted }]}>{label}</Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pct: {
    fontFamily: 'Geist_600SemiBold',
    fontWeight: '600',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  subLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
});
