import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import { useScreenEnterKey } from '../../theme/screenFocusContext';
import { tabularNumbers } from '../../theme/tokens';
import { useReduceMotion } from '../../theme/useReduceMotion';
import { formatBRL, maskBRL, withHexAlpha } from './financeHelpers';
import { getFinanceChartPalette } from './FinanceSemanticIcons';
import { AnimatedSvgBar, formatCompactAxisBRL } from './FinanceSubScreenCharts';

interface FinanceGroupedFlowChartProps {
  income: number[];
  expenses: number[];
  labels: string[];
  isPrivacyHidden?: boolean;
}

export const FinanceGroupedFlowChart: React.FC<FinanceGroupedFlowChartProps> = ({
  income,
  expenses,
  labels,
  isPrivacyHidden = false,
}) => {
  const { colors, isDark } = useTheme();
  const reduceMotion = useReduceMotion();
  const enterKey = useScreenEnterKey();
  const [selectedIdx, setSelectedIdx] = useState<number>(labels.length - 1);

  useEffect(() => {
    setSelectedIdx(labels.length - 1);
  }, [labels.length]);

  if (labels.length === 0) return null;

  const pal = getFinanceChartPalette(isDark);
  const W = 320;
  const leftPad = 42;
  const plotW = W - leftPad - 4;
  const H = 114;
  const maxVal = Math.max(...income, ...expenses, 1) * 1.15;
  const g = plotW / labels.length;
  const w = Math.min(22, g * 0.28);
  const animKey = `${enterKey}|${income.join(',')}|${expenses.join(',')}`;

  const activeIdx = selectedIdx >= 0 && selectedIdx < labels.length ? selectedIdx : labels.length - 1;
  const selIn = income[activeIdx] || 0;
  const selOut = expenses[activeIdx] || 0;
  const selNet = selIn - selOut;

  return (
    <View>
      <View style={[styles.flowDetailBanner, { backgroundColor: withHexAlpha(colors.ink, isDark ? 0.08 : 0.04) }]}>
        <Text style={[styles.flowDetailMonth, { color: colors.ink }]}>
          {labels[activeIdx]?.toUpperCase()}
        </Text>
        <View style={styles.flowDetailMetrics}>
          <Text style={[styles.flowDetailVal, tabularNumbers, { color: pal[1] }]}>
            +{maskBRL(isPrivacyHidden, formatBRL(selIn, 0))}
          </Text>
          <Text style={[styles.flowDetailSep, { color: colors.muted }]}>·</Text>
          <Text style={[styles.flowDetailVal, tabularNumbers, { color: pal[3] }]}>
            −{maskBRL(isPrivacyHidden, formatBRL(selOut, 0))}
          </Text>
          <Text style={[styles.flowDetailSep, { color: colors.muted }]}>·</Text>
          <Text
            style={[
              styles.flowDetailVal,
              tabularNumbers,
              { color: selNet >= 0 ? colors.acc : colors.red },
            ]}
          >
            {isPrivacyHidden
              ? '••'
              : `${selNet >= 0 ? '+' : '−'}${formatBRL(Math.abs(selNet), 0)}`}
          </Text>
        </View>
      </View>

      <View style={styles.svgTouchWrap}>
        <Svg width="100%" height={148} viewBox={`0 -10 ${W} ${H + 30}`}>
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

          {labels.map((lbl, idx) => {
            const inVal = income[idx] || 0;
            const outVal = expenses[idx] || 0;
            const h1 = Math.max(0, (inVal / maxVal) * H);
            const h2 = Math.max(0, (outVal / maxVal) * H);
            const cx = leftPad + idx * g + g / 2;
            const x0 = cx - w - 1.5;
            const isSel = idx === activeIdx;
            const colOpacity = isSel ? 1 : 0.52;

            return (
              <React.Fragment key={`grp_${lbl}_${idx}`}>
                {isSel ? (
                  <Rect
                    x={cx - g * 0.42}
                    y={-4}
                    width={g * 0.84}
                    height={H + 4}
                    rx={10}
                    fill={withHexAlpha(colors.ink, isDark ? 0.08 : 0.04)}
                  />
                ) : null}

                {h1 > 0 && (
                  <AnimatedSvgBar
                    x={x0}
                    width={w}
                    targetHeight={Math.max(4, h1)}
                    chartHeight={H}
                    fill={pal[1]}
                    opacity={colOpacity}
                    rx={4}
                    delayMs={idx * 50}
                    reduceMotion={reduceMotion}
                    animKey={animKey}
                  />
                )}
                {h2 > 0 && (
                  <AnimatedSvgBar
                    x={x0 + w + 3}
                    width={w}
                    targetHeight={Math.max(4, h2)}
                    chartHeight={H}
                    fill={pal[3]}
                    opacity={colOpacity}
                    rx={4}
                    delayMs={idx * 50 + 35}
                    reduceMotion={reduceMotion}
                    animKey={animKey}
                  />
                )}

                <SvgText
                  x={cx}
                  y={H + 15}
                  textAnchor="middle"
                  fontSize={10}
                  fontFamily={isSel ? 'Geist_600SemiBold' : 'Geist'}
                  fill={isSel ? colors.ink : colors.muted}
                >
                  {lbl}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>

        <View style={[styles.touchGrid, { paddingLeft: `${(leftPad / W) * 100}%` }]}>
          {labels.map((lbl, idx) => (
            <TouchableOpacity
              key={`flow_tap_${lbl}_${idx}`}
              style={styles.touchCol}
              onPress={() => {
                hapticFeedback.selection();
                setSelectedIdx(idx);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Selecionar mês ${lbl}`}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  svgTouchWrap: { position: 'relative', width: '100%' },
  touchGrid: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  touchCol: { flex: 1, height: '100%' },
  flowDetailBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 10,
    gap: 8,
  },
  flowDetailMonth: { fontFamily: 'Geist_600SemiBold', fontSize: 11.5, letterSpacing: 0.6 },
  flowDetailMetrics: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  flowDetailVal: { fontFamily: 'Geist_600SemiBold', fontSize: 12 },
  flowDetailSep: { fontSize: 12 },
});
