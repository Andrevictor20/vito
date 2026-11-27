import React, { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../../../context/ThemeContext';
import { ProtoUiIcon, type ProtoUiIconName } from '../../../../icons/ProtoUiIcons';
import { tabularNumbers } from '../../../../theme/tokens';
import { AnimatedProgressBar, useReduceMotion } from '../../../../theme/vitoMotion';
import { withHexAlpha } from '../../../finance/utils/financeHelpers';

export {
  SummaryBalanceDonut,
  SummaryInteractiveBars,
  SummaryTrendLineChart,
  type SummaryBarDatum,
} from './SummaryCharts';

export const SummaryHeroCard: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ children, style }) => {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.heroCard, { backgroundColor: colors.bg }, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={[
          withHexAlpha(colors.blue, isDark ? 0.22 : 0.16),
          withHexAlpha(colors.purple, isDark ? 0.16 : 0.12),
          colors.bg,
        ]}
        locations={[0, 0.68, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
};

export const SummaryCard: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ children, style }) => {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.surf }, style]}>{children}</View>;
};

export const SummaryEyebrow: React.FC<{
  label: string;
  icon?: ProtoUiIconName;
  color?: string;
}> = ({ label, icon, color }) => {
  const { colors } = useTheme();
  const fg = color ?? colors.muted;
  return (
    <View style={styles.ebRow}>
      {icon ? <ProtoUiIcon name={icon} size={14} color={fg} /> : null}
      <Text style={[styles.eyebrow, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

export interface SummaryCategoryRow {
  name: string;
  hours: number;
  color: string;
}

export const SummaryCategoryBreakdown: React.FC<{
  items: readonly SummaryCategoryRow[];
  replayKey?: number;
}> = ({ items, replayKey = 0 }) => {
  const { colors } = useTheme();
  const total = items.reduce((sum, i) => sum + i.hours, 0) || 1;
  if (items.length === 0) return null;

  return (
    <View style={styles.catList}>
      {items.map((item, idx) => {
        const pct = Math.max(4, Math.round((item.hours / total) * 100));
        return (
          <View key={`${item.name}_${idx}`} style={styles.catRow}>
            <View style={[styles.catDot, { backgroundColor: item.color }]} />
            <View style={styles.catBarCol}>
              <AnimatedProgressBar
                pct={pct}
                color={item.color}
                trackColor={colors.bg}
                height={6}
                delayMs={200 + idx * 100}
                durationMs={900}
                replayKey={replayKey}
              />
            </View>
            <Text style={[styles.catVal, tabularNumbers, { color: colors.muted }]} numberOfLines={1}>
              {item.name} · {item.hours.toFixed(1).replace('.', ',')}h ({Math.round((item.hours / total) * 100)}%)
            </Text>
          </View>
        );
      })}
    </View>
  );
};

export const SummaryNowIndicator: React.FC<{ leftPct: number }> = ({ leftPct }) => {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(pulse);
    if (reduceMotion) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.45, { duration: 850, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    return () => cancelAnimation(pulse);
  }, [reduceMotion, pulse]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const clamped = Math.max(2, Math.min(98, leftPct));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.nowMarker,
        { left: `${clamped}%`, backgroundColor: colors.red },
        animStyle,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  heroCard: { width: '100%', borderRadius: 24, padding: 18, overflow: 'hidden' },
  card: { width: '100%', borderRadius: 24, padding: 18 },
  ebRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: { fontFamily: 'Geist_500Medium', fontSize: 11.5, letterSpacing: 0.7, textTransform: 'uppercase' },
  catList: { marginTop: 14, gap: 10 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catBarCol: { flex: 1, minWidth: 60 },
  catVal: { fontFamily: 'Geist_500Medium', fontSize: 12.5, flexShrink: 0 },
  nowMarker: { position: 'absolute', top: -4, width: 3, height: 24, borderRadius: 2, marginLeft: -1.5 },
});
