import React, { useEffect, useId } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { getBezier } from '../../ds/tokens';
import { useScreenFocus } from '../../ds/screenFocusContext';
import { hapticFeedback } from '../../theme/motion';
import { tabularNumbers } from '../../theme/tokens';
import { CountUpText, useReduceMotion } from '../../theme/vitoMotion';
import { withHexAlpha } from '../finance/financeHelpers';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const { active, enterCount } = useScreenFocus();
  const gradId = useId().replace(/:/g, '');
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const labelOpacity = useSharedValue(reduceMotion ? 1 : 0);

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
    const [x1, y1, x2, y2] = getBezier('--ease-q');
    progress.value = 0;
    labelOpacity.value = 0;
    const delay = index * 75;
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 860, easing: Easing.bezier(x1, y1, x2, y2) })
    );
    labelOpacity.value = withDelay(delay + 380, withTiming(1, { duration: 360 }));
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

  const fallbackBg = item.holiday ? colors.orangeBg : withHexAlpha(colors.blue, 0.28);

  const inner = (
    <>
      <Animated.Text
        style={[
          styles.barTopText,
          tabularNumbers,
          { color: item.selected ? colors.ink : colors.muted },
          topStyle,
        ]}
        numberOfLines={1}
      >
        {item.topText}
      </Animated.Text>
      <Animated.View
        style={[
          styles.barPill,
          { height: heightPx, backgroundColor: item.selected ? colors.blue : fallbackBg },
          barStyle,
        ]}
      >
        {item.selected ? (
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
  const { colors } = useTheme();
  if (items.length === 0) return null;

  const maxBarH = compact ? 54 : 84;
  const maxVal = Math.max(0.5, ...items.map((i) => i.value));
  const avgVal = items.reduce((sum, i) => sum + i.value, 0) / items.length;
  const avgBottom = Math.round((avgVal / maxVal) * maxBarH) + 21;
  const lastVal = items[items.length - 1]?.value ?? 0;
  const firstVal = items[0]?.value ?? 0;
  const avgOnLeft =
    Math.abs(lastVal - avgVal) / maxVal < 0.28 &&
    Math.abs(firstVal - avgVal) / maxVal >= 0.22;

  return (
    <View style={[styles.barsWrap, compact && styles.barsWrapSm]}>
      {showAvg && avgVal > 0 ? (
        <View
          pointerEvents="none"
          style={[
            styles.avgLine,
            { bottom: avgBottom, borderTopColor: withHexAlpha(colors.muted, 0.55) },
          ]}
        >
          <View
            style={[
              styles.avgBadge,
              avgOnLeft ? { left: 0 } : { right: 0 },
              { backgroundColor: colors.bg },
            ]}
          >
            <Text style={[styles.avgLabel, { color: colors.muted }]}>média</Text>
          </View>
        </View>
      ) : null}

      {items.map((item, idx) => {
        const barH = Math.max(6, Math.round((item.value / maxVal) * maxBarH));
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
  );
};

export const SummaryTrendLineChart: React.FC<{
  points: ReadonlyArray<{ label: string; value: number }>;
  replayKey?: number;
}> = ({ points, replayKey = 0 }) => {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const { active, enterCount } = useScreenFocus();
  const gradId = useId().replace(/:/g, '');
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
    const [x1, y1, x2, y2] = getBezier('--ease-q');
    progress.value = 0;
    progress.value = withDelay(
      120,
      withTiming(1, { duration: 1250, easing: Easing.bezier(x1, y1, x2, y2) })
    );
    return () => cancelAnimation(progress);
  }, [points.length, reduceMotion, active, enterCount, replayKey, progress]);

  const safePts = points.length >= 2 ? points : [{ label: 'S1', value: 0 }, { label: 'S2', value: 0 }];
  const maxVal = Math.max(1, ...safePts.map((p) => p.value));
  const coords = safePts.map((p, k) => ({
    x: 28 + k * (244 / Math.max(1, safePts.length - 1)),
    y: 96 - (p.value / maxVal) * 62,
    label: p.label,
    value: p.value,
  }));

  let d = `M${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  let approxLen = 0;
  for (let k = 1; k < coords.length; k++) {
    const a = coords[k - 1];
    const b = coords[k];
    const m = (a.x + b.x) / 2;
    d += ` C${m.toFixed(1)} ${a.y.toFixed(1)} ${m.toFixed(1)} ${b.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    approxLen += Math.hypot(b.x - a.x, b.y - a.y) * 1.15;
  }
  approxLen = Math.max(320, Math.ceil(approxLen));
  const areaD = `${d} L${coords[coords.length - 1].x.toFixed(1)} 106 L${coords[0].x.toFixed(1)} 106 Z`;

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(progress.value, [0, 1], [approxLen, 0], Extrapolation.CLAMP),
  }), [approxLen]);

  const areaProps = useAnimatedProps(() => ({
    opacity: interpolate(progress.value, [0.2, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <Svg width="100%" height={138} viewBox="0 0 300 136" style={{ marginTop: 10 }}>
      <Defs>
        <LinearGradient id={`rsg_${gradId}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.blue} stopOpacity={0.28} />
          <Stop offset="1" stopColor={colors.blue} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Line x1={20} x2={280} y1={106} y2={106} stroke={colors.line} strokeWidth={1} />
      <AnimatedPath d={areaD} fill={`url(#rsg_${gradId})`} animatedProps={areaProps} />
      <AnimatedPath
        d={d}
        fill="none"
        stroke={colors.blue}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={`${approxLen} ${approxLen}`}
        animatedProps={lineProps}
      />
      {coords.map((pt, idx) => (
        <React.Fragment key={`${pt.label}_${idx}`}>
          <Circle cx={pt.x} cy={pt.y} r={5} fill={colors.bg} stroke={colors.blue} strokeWidth={2.5} />
          <SvgText x={pt.x} y={pt.y - 12} textAnchor="middle" fontSize={11} fontFamily="Geist_500Medium" fill={colors.muted}>
            {pt.value.toFixed(1).replace('.', ',')}h
          </SvgText>
          <SvgText x={pt.x} y={124} textAnchor="middle" fontSize={11} fontFamily="Geist_500Medium" fill={colors.muted}>
            {pt.label}
          </SvgText>
        </React.Fragment>
      ))}
    </Svg>
  );
};

export const SummaryBalanceDonut: React.FC<{
  personalRatio: number;
  workRatio: number;
  replayKey?: number;
}> = ({ personalRatio, workRatio, replayKey = 0 }) => {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const { active, enterCount } = useScreenFocus();
  const r = 38;
  const circ = 2 * Math.PI * r;
  const pLen = (Math.max(0, Math.min(100, personalRatio)) / 100) * circ;
  const wLen = (Math.max(0, Math.min(100, workRatio)) / 100) * circ;

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
    const [x1, y1, x2, y2] = getBezier('--ease-q');
    progress.value = 0;
    progress.value = withDelay(
      140,
      withTiming(1, { duration: 1200, easing: Easing.bezier(x1, y1, x2, y2) })
    );
    return () => cancelAnimation(progress);
  }, [personalRatio, workRatio, reduceMotion, active, enterCount, replayKey, progress]);

  const personalProps = useAnimatedProps(
    () => ({ strokeDasharray: `${(pLen * progress.value).toFixed(2)} ${circ.toFixed(2)}` }),
    [pLen, circ]
  );

  const workProps = useAnimatedProps(
    () => ({
      strokeDasharray: `${(wLen * progress.value).toFixed(2)} ${circ.toFixed(2)}`,
      strokeDashoffset: -(pLen * progress.value),
    }),
    [wLen, pLen, circ]
  );

  return (
    <View style={styles.donutBox}>
      <Svg width={112} height={112} viewBox="0 0 100 100">
        <G rotation={-90} origin="50, 50">
          <Circle cx={50} cy={50} r={r} fill="none" stroke={colors.line} strokeWidth={15} />
          <AnimatedCircle cx={50} cy={50} r={r} fill="none" stroke={colors.acc} strokeWidth={15} animatedProps={personalProps} />
          <AnimatedCircle cx={50} cy={50} r={r} fill="none" stroke={colors.ink} strokeWidth={15} animatedProps={workProps} />
        </G>
      </Svg>
      <View style={styles.donutCenter}>
        <CountUpText value={personalRatio} suffix="%" durationMs={1100} replayKey={replayKey} style={[styles.donutPct, { color: colors.ink }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  barsWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 138, paddingTop: 18, marginTop: 14, position: 'relative' },
  barsWrapSm: { height: 102, gap: 7, paddingTop: 16 },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 5, minWidth: 0 },
  barTopText: { fontFamily: 'Geist_500Medium', fontSize: 11 },
  barPill: { width: '100%', maxWidth: 46, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, overflow: 'hidden' },
  barLbl: { fontSize: 11 },
  avgLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1.5, borderStyle: 'dashed', zIndex: 2 },
  avgBadge: { position: 'absolute', top: -9, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 },
  avgLabel: { fontFamily: 'Geist_500Medium', fontSize: 10.5 },
  donutBox: { width: 112, height: 112, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  donutCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  donutPct: { fontFamily: 'Geist_500Medium', fontSize: 20, letterSpacing: -0.4 },
});
