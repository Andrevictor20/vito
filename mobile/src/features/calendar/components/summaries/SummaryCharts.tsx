import React, { useEffect, useId } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../../../../context/ThemeContext';
import { MOTION_CURVES, hapticFeedback } from '../../../../theme/motion';
import { useScreenFocus } from '../../../../theme/screenFocusContext';
import { tabularNumbers } from '../../../../theme/tokens';
import { useReduceMotion } from '../../../../theme/vitoMotion';
import { withHexAlpha } from '../../../finance/utils/financeHelpers';

export { SummaryBalanceDonut, SummaryTrendLineChart } from './SummaryMonthlyCharts';

export interface SummaryBarDatum {
  key: string;
  value: number;
  label: string;
  topText: string;
  selected?: boolean;
  holiday?: boolean;
}

const AnimatedSummaryBarColumn: React.FC<{
  item: SummaryBarDatum;
  index: number;
  heightPx: number;
  selectable: boolean;
  replayKey: number;
  onPress?: () => void;
}> = ({ item, index, heightPx, selectable, replayKey, onPress }) => {
  const { colors, isDark } = useTheme();
  const reduceMotion = useReduceMotion();
  const { active, enterCount } = useScreenFocus();
  const gradId = useId().replace(/:/g, '');
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const labelOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const hasValue = item.value > 0;
  const isActiveBar = Boolean(item.selected && hasValue);

  useEffect(() => {
    cancelAnimation(progress);
    cancelAnimation(labelOpacity);
    if (reduceMotion) {
      progress.value = 1;
      labelOpacity.value = 1;
      return;
    }
    if (!active) {
      progress.value = 0;
      labelOpacity.value = 0;
      return;
    }
    const [x1, y1, x2, y2] = MOTION_CURVES.q;
    progress.value = 0;
    labelOpacity.value = 0;
    const delay = index * 75;
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 860, easing: Easing.bezier(x1, y1, x2, y2) })
    );
    labelOpacity.value = withDelay(delay + 360, withTiming(1, { duration: 360 }));
    return () => {
      cancelAnimation(progress);
      cancelAnimation(labelOpacity);
    };
  }, [index, heightPx, reduceMotion, active, enterCount, replayKey, progress, labelOpacity]);

  const barStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const ty = (heightPx * (1 - p)) / 2;
    return {
      transform: [{ translateY: ty }, { scaleY: Math.max(0.01, p) }],
    };
  }, [heightPx]);

  const topStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
  }));

  const inactiveBg = !hasValue
    ? withHexAlpha(colors.muted, isDark ? 0.22 : 0.16)
    : item.holiday
      ? withHexAlpha(colors.orange, isDark ? 0.52 : 0.42)
      : withHexAlpha(colors.blue, isDark ? 0.36 : 0.28);

  const inner = (
    <>
      {item.topText ? (
        <Animated.Text
          style={[
            styles.barTopText,
            tabularNumbers,
            { color: isActiveBar ? colors.ink : colors.muted },
            topStyle,
          ]}
          numberOfLines={1}
        >
          {item.topText}
        </Animated.Text>
      ) : (
        <View style={styles.barTopSpacer} />
      )}
      <Animated.View
        style={[
          styles.barPill,
          !hasValue && styles.barPillEmpty,
          { height: heightPx, backgroundColor: isActiveBar ? colors.blue : inactiveBg },
          barStyle,
        ]}
      >
        {isActiveBar ? (
          <Svg
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            <Defs>
              <LinearGradient id={`bar_${gradId}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.blue} stopOpacity={1} />
                <Stop offset="1" stopColor={colors.purple} stopOpacity={0.85} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="100" fill={`url(#bar_${gradId})`} />
          </Svg>
        ) : null}
      </Animated.View>
      <View style={styles.barLblWrap}>
        <Text
          style={[
            styles.barLbl,
            {
              color: item.selected ? colors.ink : colors.muted,
              fontFamily: item.selected ? 'Geist_600SemiBold' : 'Geist',
            },
          ]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
        {item.selected ? <View style={[styles.barTodayDot, { backgroundColor: colors.blue }]} /> : null}
      </View>
    </>
  );

  if (selectable && onPress) {
    return (
      <TouchableOpacity
        style={styles.barCol}
        onPress={() => {
          hapticFeedback.selection();
          onPress();
        }}
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityLabel={item.label}
      >
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={styles.barCol}>{inner}</View>;
};

export const SummaryInteractiveBars: React.FC<{
  items: readonly SummaryBarDatum[];
  compact?: boolean;
  showAvg?: boolean;
  selectable?: boolean;
  replayKey?: number;
  onSelectIndex?: (index: number) => void;
}> = ({
  items,
  compact = false,
  showAvg = false,
  selectable = false,
  replayKey = 0,
  onSelectIndex,
}) => {
  const { colors, isDark } = useTheme();
  if (items.length === 0) return null;

  const maxBarH = compact ? 58 : 84;
  const labelFooterH = 22;
  const maxVal = Math.max(0.5, ...items.map((i) => i.value));
  const avgVal = items.reduce((sum, i) => sum + i.value, 0) / items.length;
  const avgBottom = Math.round((avgVal / maxVal) * maxBarH) + labelFooterH;
  const avgFormatted = `${avgVal.toFixed(1).replace('.', ',')}h`;

  return (
    <View>
      {showAvg && avgVal > 0 ? (
        <View style={styles.avgHeaderRow}>
          <View style={[styles.avgHeaderPill, { backgroundColor: withHexAlpha(colors.ink, isDark ? 0.1 : 0.06) }]}>
            <View style={[styles.avgDashSample, { borderTopColor: withHexAlpha(colors.muted, 0.8) }]} />
            <Text style={[styles.avgLabel, tabularNumbers, { color: colors.muted }]}>
              média · {avgFormatted}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={[styles.barsWrap, compact && styles.barsWrapSm, showAvg && styles.barsWrapWithAvg]}>
        {!compact ? (
          <View
            pointerEvents="none"
            style={[
              styles.gridLine,
              { bottom: Math.round(maxBarH * 0.5) + labelFooterH, borderTopColor: withHexAlpha(colors.line, 0.7) },
            ]}
          />
        ) : null}

        {showAvg && avgVal > 0 ? (
          <View
            pointerEvents="none"
            style={[
              styles.avgLine,
              { bottom: avgBottom, borderTopColor: withHexAlpha(colors.muted, 0.55) },
            ]}
          />
        ) : null}

        {items.map((item, idx) => {
          const barH = item.value <= 0 ? 4 : Math.max(8, Math.round((item.value / maxVal) * maxBarH));
          return (
            <AnimatedSummaryBarColumn
              key={item.key}
              item={item}
              index={idx}
              heightPx={barH}
              selectable={selectable}
              replayKey={replayKey}
              onPress={onSelectIndex ? () => onSelectIndex(idx) : undefined}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  avgHeaderRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, marginBottom: -4 },
  avgHeaderPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  avgDashSample: { width: 12, borderTopWidth: 1.5, borderStyle: 'dashed' },
  barsWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 140, paddingTop: 22, marginTop: 12, position: 'relative' },
  barsWrapSm: { height: 110, gap: 7, paddingTop: 20 },
  barsWrapWithAvg: { marginTop: 8 },
  gridLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', zIndex: 0 },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 5, minWidth: 0, zIndex: 2 },
  barTopText: { fontFamily: 'Geist_500Medium', fontSize: 11 },
  barTopSpacer: { height: 15 },
  barPill: { width: '100%', maxWidth: 46, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, overflow: 'hidden' },
  barPillEmpty: { borderRadius: 3 },
  barLblWrap: { alignItems: 'center', height: 18 },
  barLbl: { fontSize: 11 },
  barTodayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
  avgLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1.5, borderStyle: 'dashed', zIndex: 1 },
  avgLabel: { fontFamily: 'Geist_500Medium', fontSize: 10.5 },
});
