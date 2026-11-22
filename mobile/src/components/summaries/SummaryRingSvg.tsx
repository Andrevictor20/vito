import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';

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
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!mounted) return;
        if (reduced) {
          anim.setValue(clamped);
          return;
        }
        anim.setValue(0);
        Animated.timing(anim, {
          toValue: clamped,
          duration: 950,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      })
      .catch(() => anim.setValue(clamped));
    return () => {
      mounted = false;
    };
  }, [clamped, anim]);

  const strokeDashoffset = anim.interpolate({
    inputRange: [0, 100],
    outputRange: [circ, 0],
    extrapolate: 'clamp',
  });

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
          strokeDashoffset={strokeDashoffset}
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
    fontWeight: '600',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
});
