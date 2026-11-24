import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
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
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { ProtoDonutChart } from '../../charts/ProtoDonutChart';
import { getBezier } from '../../ds/tokens';
import { useScreenEnterKey } from '../../theme/screenFocusContext';
import { useReduceMotion } from '../../theme/useReduceMotion';
import { getFinanceChartPalette, resolveCategoryVisual } from './FinanceSemanticIcons';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface DonutSegment {
  label: string;
  value: number;
}

interface FinanceDonutChartProps {
  segments: DonutSegment[];
  centerPrimary: string;
  centerSecondary: string;
}

export const FinanceDonutChart: React.FC<FinanceDonutChartProps> = ({
  segments,
  centerPrimary,
  centerSecondary,
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
        size={176}
      />
    </View>
  );
};

const AnimatedSvgBar: React.FC<{
  x: number;
  width: number;
  targetHeight: number;
  chartHeight: number;
  fill: string;
  opacity?: number;
  delayMs: number;
  reduceMotion: boolean;
  animKey: string;
}> = ({ x, width, targetHeight, chartHeight, fill, opacity = 1, delayMs, reduceMotion, animKey }) => {
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
        duration: 540,
        easing: Easing.bezier(x1, y1, x2, y2),
      }),
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
      rx={3.5}
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
}

export const FinanceDailyBarsChart: React.FC<FinanceDailyBarsChartProps> = ({
  values,
  labels,
  highlightIndex = -1,
  averageValue = 0,
}) => {
  const { colors, isDark } = useTheme();
  const reduceMotion = useReduceMotion();
  const enterKey = useScreenEnterKey();
  if (values.length === 0) return null;

  const pal = getFinanceChartPalette(isDark);
  const W = 320;
  const H = 110;
  const maxVal = Math.max(...values, averageValue, 1) * 1.1;
  const bw = W / values.length;
  const avgY = H - (averageValue / maxVal) * H;
  const animKey = `${enterKey}|${values.join(',')}`;
  const peakVal = highlightIndex >= 0 && highlightIndex < values.length ? values[highlightIndex] : 0;
  const peakH = peakVal > 0 ? (peakVal / maxVal) * H : 0;
  const peakX = highlightIndex >= 0 ? Math.max(24, Math.min(W - 24, highlightIndex * bw + bw / 2)) : 0;

  return (
    <Svg width="100%" height={144} viewBox={`0 -14 ${W} ${H + 36}`}>
      <Line x1={0} x2={W} y1={H} y2={H} stroke={colors.line} strokeWidth={1} />
      {values.map((val, idx) => {
        const barH = Math.max(0, (val / maxVal) * H);
        if (barH <= 0) return null;
        const isHi = idx === highlightIndex;
        const aboveAvg = averageValue > 0 && val > averageValue;
        const fill = isHi ? pal[4] : aboveAvg ? pal[2] : pal[0];
        return (
          <AnimatedSvgBar
            key={`bar_${idx}`}
            x={idx * bw + bw * 0.18}
            width={Math.max(2, bw * 0.64)}
            targetHeight={barH}
            chartHeight={H}
            fill={fill}
            opacity={isHi ? 1 : aboveAvg ? 0.88 : 0.72}
            delayMs={Math.min(idx * 22, 320)}
            reduceMotion={reduceMotion}
            animKey={animKey}
          />
        );
      })}
      {averageValue > 0 && (
        <>
          <Line
            x1={0}
            x2={W}
            y1={avgY}
            y2={avgY}
            stroke={colors.muted}
            strokeWidth={1.2}
            strokeDasharray="4,4"
          />
          <SvgText
            x={W - 2}
            y={Math.max(4, avgY - 4)}
            textAnchor="end"
            fontSize={9.5}
            fontFamily="Geist_500Medium"
            fill={colors.muted}
          >
            média
          </SvgText>
        </>
      )}
      {peakVal > 0 && highlightIndex >= 0 && (
        <SvgText
          x={peakX}
          y={Math.max(-3, H - peakH - 5)}
          textAnchor="middle"
          fontSize={9.5}
          fontFamily="Geist_600SemiBold"
          fill={pal[4]}
        >
          R$ {Math.round(peakVal)}
        </SvgText>
      )}
      {labels.map((item) => {
        const lx = Math.max(12, Math.min(W - 12, item.index * bw + bw / 2));
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
  );
};

interface FinanceGroupedFlowChartProps {
  income: number[];
  expenses: number[];
  labels: string[];
}

export const FinanceGroupedFlowChart: React.FC<FinanceGroupedFlowChartProps> = ({
  income,
  expenses,
  labels,
}) => {
  const { colors, isDark } = useTheme();
  const reduceMotion = useReduceMotion();
  const enterKey = useScreenEnterKey();
  if (labels.length === 0) return null;

  const pal = getFinanceChartPalette(isDark);
  const W = 320;
  const H = 110;
  const maxVal = Math.max(...income, ...expenses, 1) * 1.1;
  const g = W / labels.length;
  const w = Math.min(24, g * 0.28);
  const animKey = `${enterKey}|${income.join(',')}|${expenses.join(',')}`;

  return (
    <Svg width="100%" height={138} viewBox={`0 0 ${W} ${H + 22}`}>
      <Line x1={0} x2={W} y1={H * 0.5} y2={H * 0.5} stroke={colors.line} strokeWidth={0.8} strokeDasharray="3,4" />
      <Line x1={0} x2={W} y1={H} y2={H} stroke={colors.line} strokeWidth={1} />
      {labels.map((lbl, idx) => {
        const h1 = Math.max(0, ((income[idx] || 0) / maxVal) * H);
        const h2 = Math.max(0, ((expenses[idx] || 0) / maxVal) * H);
        const x0 = idx * g + g / 2 - w - 1.5;
        return (
          <React.Fragment key={`grp_${lbl}_${idx}`}>
            {h1 > 0 && (
              <AnimatedSvgBar
                x={x0}
                width={w}
                targetHeight={h1}
                chartHeight={H}
                fill={pal[1]}
                delayMs={idx * 45}
                reduceMotion={reduceMotion}
                animKey={animKey}
              />
            )}
            {h2 > 0 && (
              <AnimatedSvgBar
                x={x0 + w + 3}
                width={w}
                targetHeight={h2}
                chartHeight={H}
                fill={pal[3]}
                delayMs={idx * 45 + 35}
                reduceMotion={reduceMotion}
                animKey={animKey}
              />
            )}
            <SvgText
              x={idx * g + g / 2}
              y={H + 15}
              textAnchor="middle"
              fontSize={10}
              fontFamily="Geist"
              fill={colors.muted}
            >
              {lbl}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
};

const styles = StyleSheet.create({
  donutWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
});
