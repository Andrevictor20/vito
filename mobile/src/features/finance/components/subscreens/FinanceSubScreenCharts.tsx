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
import Svg, { Defs, Line, LinearGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../../../context/ThemeContext';
import { ProtoDonutChart } from '../../../../charts/ProtoDonutChart';
import { getBezier } from '../../../../ds/tokens';
import { hapticFeedback } from '../../../../theme/motion';
import { useScreenEnterKey } from '../../../../theme/screenFocusContext';
import { tabularNumbers } from '../../../../theme/tokens';
import { useReduceMotion } from '../../../../theme/useReduceMotion';
import { formatBRL, maskBRL, withHexAlpha } from '../shared/financeHelpers';
import { getFinanceChartPalette, resolveCategoryVisual } from '../shared/FinanceSemanticIcons';

export { FinanceGroupedFlowChart } from '../dashboard/FinanceFlowChart';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export function formatCompactAxisBRL(val: number): string {
  if (val >= 1000) {
    const k = val / 1000;
    return `R$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1).replace('.', ',')}k`;
  }
  return `R$${Math.round(val)}`;
}

interface DonutSegment {
  label: string;
  value: number;
}

interface FinanceDonutChartProps {
  segments: DonutSegment[];
  centerPrimary: string;
  centerSecondary: string;
  selectedIndex?: number | null;
  onSelectIndex?: (index: number | null) => void;
}

export const FinanceDonutChart: React.FC<FinanceDonutChartProps> = ({
  segments,
  centerPrimary,
  centerSecondary,
  selectedIndex = null,
  onSelectIndex,
}) => {
  const { isDark } = useTheme();
  const reduceMotion = useReduceMotion();
  const data = segments.map((s, idx) => ({
    label: s.label,
    value: Math.max(0, s.value),
    color: resolveCategoryVisual(s.label, isDark, idx).color,
  }));

  return (
    <View style={styles.donutWrap}>
      <ProtoDonutChart
        data={data}
        totalLabel={centerPrimary}
        subtitleLabel={centerSecondary}
        isDark={isDark}
        reduceMotion={reduceMotion}
        size={184}
        selectedIndex={selectedIndex}
        onSelectIndex={onSelectIndex}
      />
    </View>
  );
};

export const AnimatedSvgBar: React.FC<{
  x: number;
  width: number;
  targetHeight: number;
  chartHeight: number;
  fill: string;
  opacity?: number;
  rx?: number;
  delayMs: number;
  reduceMotion: boolean;
  animKey: string;
}> = ({
  x,
  width,
  targetHeight,
  chartHeight,
  fill,
  opacity = 1,
  rx = 4,
  delayMs,
  reduceMotion,
  animKey,
}) => {
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    cancelAnimation(progress);
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    const [x1, y1, x2, y2] = getBezier('--ease-q');
    progress.value = 0;
    progress.value = withDelay(
      delayMs,
      withTiming(1, {
        duration: 580,
        easing: Easing.bezier(x1, y1, x2, y2),
      })
    );
    return () => cancelAnimation(progress);
  }, [animKey, delayMs, reduceMotion, progress]);

  const animatedProps = useAnimatedProps(() => {
    const h = interpolate(progress.value, [0, 1], [0, targetHeight], Extrapolation.CLAMP);
    return {
      y: chartHeight - h,
      height: h,
    };
  }, [chartHeight, targetHeight]);

  return (
    <AnimatedRect
      x={x}
      width={width}
      rx={rx}
      fill={fill}
      opacity={opacity}
      animatedProps={animatedProps}
    />
  );
};

interface FinanceDailyBarsChartProps {
  values: number[];
  labels: Array<{ index: number; label: string }>;
  highlightIndex?: number;
  averageValue?: number;
  isPrivacyHidden?: boolean;
}

export const FinanceDailyBarsChart: React.FC<FinanceDailyBarsChartProps> = ({
  values,
  labels,
  highlightIndex = -1,
  averageValue = 0,
  isPrivacyHidden = false,
}) => {
  const { colors, isDark } = useTheme();
  const reduceMotion = useReduceMotion();
  const enterKey = useScreenEnterKey();
  const [selectedIdx, setSelectedIdx] = useState<number>(highlightIndex);
  const gradId = useId().replace(/:/g, '');

  useEffect(() => {
    setSelectedIdx(highlightIndex);
  }, [highlightIndex, values.length]);

  if (values.length === 0) return null;

  const pal = getFinanceChartPalette(isDark);
  const W = 320;
  const leftPad = 38;
  const plotW = W - leftPad - 6;
  const H = 114;
  const maxVal = Math.max(...values, averageValue, 1) * 1.15;
  const bw = plotW / values.length;
  const avgY = H - (averageValue / maxVal) * H;
  const animKey = `${enterKey}|${values.join(',')}`;

  const activeIdx = selectedIdx >= 0 && selectedIdx < values.length ? selectedIdx : highlightIndex;
  const activeVal = activeIdx >= 0 && activeIdx < values.length ? values[activeIdx] : 0;
  const activeH = activeVal > 0 ? (activeVal / maxVal) * H : 0;
  const activeX =
    activeIdx >= 0
      ? Math.max(leftPad + 26, Math.min(W - 26, leftPad + activeIdx * bw + bw / 2))
      : 0;
  const ratioToAvg = averageValue > 0 && activeVal > 0 ? activeVal / averageValue : 0;

  return (
    <View>
      <View style={styles.chartHeaderRow}>
        <View style={[styles.detailPill, { backgroundColor: withHexAlpha(colors.ink, isDark ? 0.1 : 0.05) }]}>
          <Text style={[styles.detailText, tabularNumbers, { color: colors.ink }]} numberOfLines={1}>
            {activeIdx >= 0
              ? `Dia ${activeIdx + 1} · ${maskBRL(isPrivacyHidden, formatBRL(activeVal, 0))}${
                  ratioToAvg >= 1.2 ? ` (${ratioToAvg.toFixed(1).replace('.', ',')}x média)` : ''
                }`
              : 'Toque em um dia'}
          </Text>
        </View>
        {averageValue > 0 ? (
          <View style={[styles.avgPill, { backgroundColor: withHexAlpha(colors.muted, 0.12) }]}>
            <View style={[styles.avgDash, { borderTopColor: colors.muted }]} />
            <Text style={[styles.avgPillText, tabularNumbers, { color: colors.muted }]}>
              média {maskBRL(isPrivacyHidden, formatBRL(averageValue, 0))}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.svgTouchWrap}>
        <Svg width="100%" height={152} viewBox={`0 -16 ${W} ${H + 38}`}>
          <Defs>
            <LinearGradient id={`fd_hi_${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={pal[4]} stopOpacity={1} />
              <Stop offset="1" stopColor={pal[2]} stopOpacity={0.85} />
            </LinearGradient>
          </Defs>

          <Line x1={leftPad} x2={W} y1={0} y2={0} stroke={colors.line} strokeWidth={0.7} strokeDasharray="3,4" />
          <Line x1={leftPad} x2={W} y1={H * 0.5} y2={H * 0.5} stroke={colors.line} strokeWidth={0.7} strokeDasharray="3,4" />
          <Line x1={leftPad} x2={W} y1={H} y2={H} stroke={colors.line} strokeWidth={1} />

          <SvgText x={leftPad - 5} y={4} textAnchor="end" fontSize={9} fontFamily="Geist" fill={colors.muted}>
            {isPrivacyHidden ? '••' : formatCompactAxisBRL(maxVal)}
          </SvgText>
          <SvgText x={leftPad - 5} y={H * 0.5 + 3} textAnchor="end" fontSize={9} fontFamily="Geist" fill={colors.muted}>
            {isPrivacyHidden ? '••' : formatCompactAxisBRL(maxVal * 0.5)}
          </SvgText>
          <SvgText x={leftPad - 5} y={H + 3} textAnchor="end" fontSize={9} fontFamily="Geist" fill={colors.muted}>
            R$0
          </SvgText>

          {averageValue > 0 && (
            <Line
              x1={leftPad}
              x2={W}
              y1={avgY}
              y2={avgY}
              stroke={withHexAlpha(colors.muted, 0.7)}
              strokeWidth={1.2}
              strokeDasharray="4,4"
            />
          )}

          {values.map((val, idx) => {
            const barH = Math.max(0, (val / maxVal) * H);
            if (barH <= 0) return null;
            const isSel = idx === activeIdx;
            const isPeak = idx === highlightIndex;
            const aboveAvg = averageValue > 0 && val > averageValue;
            const fill = isSel
              ? `url(#fd_hi_${gradId})`
              : isPeak
                ? pal[4]
                : aboveAvg
                  ? pal[2]
                  : pal[0];
            const barOpacity = activeIdx >= 0 ? (isSel ? 1 : 0.45) : aboveAvg ? 0.88 : 0.72;
            return (
              <AnimatedSvgBar
                key={`bar_${idx}`}
                x={leftPad + idx * bw + bw * 0.16}
                width={Math.max(3, bw * 0.68)}
                targetHeight={Math.max(4, barH)}
                chartHeight={H}
                fill={fill}
                opacity={barOpacity}
                rx={Math.min(4, Math.max(2, bw * 0.28))}
                delayMs={Math.min(idx * 18, 320)}
                reduceMotion={reduceMotion}
                animKey={animKey}
              />
            );
          })}

          {activeVal > 0 && activeIdx >= 0 && !isPrivacyHidden && (
            <SvgText
              x={activeX}
              y={Math.max(-4, H - activeH - 5)}
              textAnchor="middle"
              fontSize={9.5}
              fontFamily="Geist_600SemiBold"
              fill={pal[4]}
            >
              R$ {Math.round(activeVal)}
            </SvgText>
          )}

          {labels.map((item) => {
            const lx = Math.max(leftPad + 8, Math.min(W - 8, leftPad + item.index * bw + bw / 2));
            return (
              <SvgText
                key={`lbl_${item.index}`}
                x={lx}
                y={H + 15}
                textAnchor="middle"
                fontSize={10}
                fontFamily="Geist"
                fill={colors.muted}
              >
                {item.label}
              </SvgText>
            );
          })}
        </Svg>

        <View style={[styles.touchGrid, { paddingLeft: `${(leftPad / W) * 100}%` }]}>
          {values.map((_, idx) => (
            <TouchableOpacity
              key={`day_tap_${idx}`}
              style={styles.touchCol}
              onPress={() => {
                hapticFeedback.selection();
                setSelectedIdx(idx);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Dia ${idx + 1}`}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  donutWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  chartHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  detailPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  detailText: { fontFamily: 'Geist_500Medium', fontSize: 12 },
  avgPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  avgDash: { width: 12, borderTopWidth: 1.5, borderStyle: 'dashed' },
  avgPillText: { fontFamily: 'Geist_500Medium', fontSize: 11 },
  svgTouchWrap: { position: 'relative', width: '100%' },
  touchGrid: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  touchCol: { flex: 1, height: '100%' },
});
