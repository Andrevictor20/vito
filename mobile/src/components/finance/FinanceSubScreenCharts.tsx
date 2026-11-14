import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { buildFinScale } from './financeHelpers';

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
  const { colors } = useTheme();
  const finScale = buildFinScale(colors.fin);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((acc, s) => acc + Math.max(0, s.value), 0);

  let offset = 0;

  return (
    <View style={styles.donutWrap}>
      <Svg width={176} height={176} viewBox="0 0 120 120">
        <Circle
          cx={60}
          cy={60}
          r={radius}
          fill="none"
          stroke={colors.line}
          strokeWidth={14}
        />
        {total > 0 &&
          segments.map((seg, idx) => {
            const val = Math.max(0, seg.value);
            const len = (val / total) * circumference;
            const currentOffset = offset;
            offset += len;
            if (len <= 0.5) return null;

            return (
              <Circle
                key={`${seg.label}_${idx}`}
                cx={60}
                cy={60}
                r={radius}
                fill="none"
                stroke={finScale[idx % finScale.length]}
                strokeWidth={14}
                strokeDasharray={[Math.max(len - 2, 0.5), Math.max(circumference - len + 2, 0.5)]}
                strokeDashoffset={-currentOffset}
                origin="60, 60"
                rotation={-90}
              />
            );
          })}

        <SvgText
          x={60}
          y={56}
          textAnchor="middle"
          fontSize={8.5}
          fill={colors.muted}
        >
          {centerSecondary}
        </SvgText>
        <SvgText
          x={60}
          y={71}
          textAnchor="middle"
          fontSize={12.5}
          fontWeight="800"
          fill={colors.ink}
        >
          {centerPrimary}
        </SvgText>
      </Svg>
    </View>
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
  const { colors } = useTheme();
  if (values.length === 0) return null;

  const W = 320;
  const H = 110;
  const maxVal = Math.max(...values, averageValue, 1) * 1.1;
  const bw = W / values.length;
  const avgY = H - (averageValue / maxVal) * H;

  return (
    <Svg width="100%" height={134} viewBox={`0 0 ${W} ${H + 18}`}>
      {values.map((val, idx) => {
        const barH = Math.max(0, (val / maxVal) * H);
        const isHi = idx === highlightIndex;
        return (
          <Rect
            key={`bar_${idx}`}
            x={idx * bw + bw * 0.18}
            y={H - barH}
            width={Math.max(2, bw * 0.64)}
            height={barH}
            rx={3}
            fill={isHi ? colors.orange : colors.fin}
            opacity={isHi ? 1 : 0.72}
          />
        );
      })}
      {averageValue > 0 && (
        <Line
          x1={0}
          x2={W}
          y1={avgY}
          y2={avgY}
          stroke={colors.muted}
          strokeWidth={1.2}
          strokeDasharray="4,4"
        />
      )}
      {labels.map((item) => (
        <SvgText
          key={`lbl_${item.index}`}
          x={item.index * bw + bw / 2}
          y={H + 13}
          textAnchor="middle"
          fontSize={10}
          fill={colors.muted}
        >
          {item.label}
        </SvgText>
      ))}
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
  const { colors } = useTheme();
  if (labels.length === 0) return null;

  const W = 320;
  const H = 110;
  const maxVal = Math.max(...income, ...expenses, 1) * 1.1;
  const g = W / labels.length;
  const w = Math.min(24, g * 0.28);

  return (
    <Svg width="100%" height={134} viewBox={`0 0 ${W} ${H + 18}`}>
      {labels.map((lbl, idx) => {
        const h1 = Math.max(0, ((income[idx] || 0) / maxVal) * H);
        const h2 = Math.max(0, ((expenses[idx] || 0) / maxVal) * H);
        const x0 = idx * g + g / 2 - w - 1.5;
        return (
          <React.Fragment key={`grp_${lbl}_${idx}`}>
            <Rect
              x={x0}
              y={H - h1}
              width={w}
              height={h1}
              rx={3}
              fill={colors.acc}
            />
            <Rect
              x={x0 + w + 3}
              y={H - h2}
              width={w}
              height={h2}
              rx={3}
              fill={colors.red}
            />
            <SvgText
              x={idx * g + g / 2}
              y={H + 13}
              textAnchor="middle"
              fontSize={10}
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
