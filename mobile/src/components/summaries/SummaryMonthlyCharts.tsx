import React, { useEffect, useId, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
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

const AnimatedPointCircle: React.FC<{
  cx: number;
  cy: number;
  index: number;
  selected: boolean;
  fill: string;
  stroke: string;
  reduceMotion: boolean;
  active: boolean;
  enterCount: number;
  replayKey: number;
}> = ({ cx, cy, index, selected, fill, stroke, reduceMotion, active, enterCount, replayKey }) => {
  const pop = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    cancelAnimation(pop);
    if (reduceMotion) {
      pop.value = 1;
      return;
    }
    if (!active) {
      pop.value = 0;
      return;
    }
    pop.value = 0;
    pop.value = withDelay(
      360 + index * 140,
      withTiming(1, { duration: 420, easing: Easing.bezier(0.34, 1.56, 0.64, 1) })
    );
    return () => cancelAnimation(pop);
  }, [index, reduceMotion, active, enterCount, replayKey, pop]);

  const animatedProps = useAnimatedProps(() => ({
    r: interpolate(pop.value, [0, 1], [0, selected ? 6 : 4.5], Extrapolation.CLAMP),
    opacity: pop.value,
  }), [selected]);

  return (
    <>
      {selected ? (
        <Circle cx={cx} cy={cy} r={10} fill={withHexAlpha(stroke, 0.16)} />
      ) : null}
      <AnimatedCircle
        cx={cx}
        cy={cy}
        fill={selected ? stroke : fill}
        stroke={stroke}
        strokeWidth={2.5}
        animatedProps={animatedProps}
      />
    </>
  );
};

export const SummaryTrendLineChart: React.FC<{
  points: ReadonlyArray<{ label: string; value: number }>;
  replayKey?: number;
}> = ({ points, replayKey = 0 }) => {
  const { colors, isDark } = useTheme();
  const reduceMotion = useReduceMotion();
  const { active, enterCount } = useScreenFocus();
  const gradId = useId().replace(/:/g, '');
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);

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
  const avgVal = safePts.reduce((sum, p) => sum + p.value, 0) / safePts.length;
  const chartTop = 26;
  const chartBottom = 104;
  const chartH = chartBottom - chartTop;

  const coords = safePts.map((p, k) => ({
    x: 36 + k * (242 / Math.max(1, safePts.length - 1)),
    y: chartBottom - (p.value / maxVal) * (chartH - 8),
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
  const areaD = `${d} L${coords[coords.length - 1].x.toFixed(1)} ${chartBottom} L${coords[0].x.toFixed(1)} ${chartBottom} Z`;
  const avgY = chartBottom - (avgVal / maxVal) * (chartH - 8);
  const midY = chartTop + chartH * 0.5;

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(progress.value, [0, 1], [approxLen, 0], Extrapolation.CLAMP),
  }), [approxLen]);

  const areaProps = useAnimatedProps(() => ({
    opacity: interpolate(progress.value, [0.2, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const activePoint = selectedIdx >= 0 && selectedIdx < safePts.length ? safePts[selectedIdx] : null;
  const diffFromAvg = activePoint ? activePoint.value - avgVal : 0;

  return (
    <View>
      <View style={styles.trendChartBox}>
        <Svg width="100%" height={144} viewBox="0 0 300 138">
          <Defs>
            <LinearGradient id={`rsg_${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.blue} stopOpacity={isDark ? 0.34 : 0.26} />
              <Stop offset="1" stopColor={colors.blue} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          <Line x1={28} x2={286} y1={chartTop} y2={chartTop} stroke={colors.line} strokeWidth={0.8} strokeDasharray="3,4" />
          <Line x1={28} x2={286} y1={midY} y2={midY} stroke={colors.line} strokeWidth={0.8} strokeDasharray="3,4" />
          <Line x1={28} x2={286} y1={chartBottom} y2={chartBottom} stroke={colors.line} strokeWidth={1} />
          <SvgText x={22} y={chartTop + 3} textAnchor="end" fontSize={9.5} fontFamily="Geist" fill={colors.muted}>
            {maxVal.toFixed(0)}h
          </SvgText>
          <SvgText x={22} y={midY + 3} textAnchor="end" fontSize={9.5} fontFamily="Geist" fill={colors.muted}>
            {(maxVal / 2).toFixed(1).replace('.', ',')}h
          </SvgText>
          <SvgText x={22} y={chartBottom + 3} textAnchor="end" fontSize={9.5} fontFamily="Geist" fill={colors.muted}>
            0h
          </SvgText>

          {avgVal > 0 ? (
            <Line
              x1={28}
              x2={286}
              y1={avgY}
              y2={avgY}
              stroke={withHexAlpha(colors.muted, 0.6)}
              strokeWidth={1.1}
              strokeDasharray="4,4"
            />
          ) : null}

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
          {coords.map((pt, idx) => {
            const isSel = idx === selectedIdx;
            return (
              <React.Fragment key={`${pt.label}_${idx}`}>
                <AnimatedPointCircle
                  cx={pt.x}
                  cy={pt.y}
                  index={idx}
                  selected={isSel}
                  fill={colors.bg}
                  stroke={colors.blue}
                  reduceMotion={reduceMotion}
                  active={active}
                  enterCount={enterCount}
                  replayKey={replayKey}
                />
                <SvgText
                  x={pt.x}
                  y={Math.max(12, pt.y - 12)}
                  textAnchor="middle"
                  fontSize={isSel ? 11.5 : 10.5}
                  fontFamily={isSel ? 'Geist_600SemiBold' : 'Geist_500Medium'}
                  fill={isSel ? colors.ink : colors.muted}
                >
                  {pt.value.toFixed(1).replace('.', ',')}h
                </SvgText>
                <SvgText
                  x={pt.x}
                  y={124}
                  textAnchor="middle"
                  fontSize={11}
                  fontFamily={isSel ? 'Geist_600SemiBold' : 'Geist_500Medium'}
                  fill={isSel ? colors.ink : colors.muted}
                >
                  {pt.label}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>

        <View style={styles.trendTouchRow}>
          {coords.map((pt, idx) => (
            <TouchableOpacity
              key={`touch_${pt.label}_${idx}`}
              style={styles.trendTouchCol}
              onPress={() => {
                hapticFeedback.selection();
                setSelectedIdx((prev) => (prev === idx ? -1 : idx));
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Selecionar ${pt.label}`}
            />
          ))}
        </View>
      </View>

      <View style={styles.trendMetaRow}>
        <Text style={[styles.trendMetaText, tabularNumbers, { color: colors.muted }]}>
          {activePoint
            ? `${activePoint.label}: ${activePoint.value.toFixed(1).replace('.', ',')}h (${diffFromAvg >= 0 ? '+' : '−'}${Math.abs(diffFromAvg).toFixed(1).replace('.', ',')}h vs média)`
            : `Média semanal: ${avgVal.toFixed(1).replace('.', ',')}h · Toque em um ponto`}
        </Text>
      </View>
    </View>
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
        <Text style={[styles.donutSub, { color: colors.muted }]}>pessoal</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  trendChartBox: { marginTop: 10, position: 'relative' },
  trendTouchRow: { ...StyleSheet.absoluteFill, flexDirection: 'row', paddingLeft: 24 },
  trendTouchCol: { flex: 1, height: '100%' },
  trendMetaRow: { marginTop: 4, alignItems: 'center' },
  trendMetaText: { fontFamily: 'Geist', fontSize: 11.5 },
  donutBox: { width: 112, height: 112, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  donutCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  donutPct: { fontFamily: 'Geist_500Medium', fontSize: 20, letterSpacing: -0.4 },
  donutSub: { fontFamily: 'Geist', fontSize: 10.5, marginTop: 1 },
});
