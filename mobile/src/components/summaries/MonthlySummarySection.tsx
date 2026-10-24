import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import { VitoMascot } from '../common/VitoMascot';
import type { MonthWeekItem } from '../../utils/summaryCalculators';

interface MonthlyMetrics {
  totalHours: string;
  totalEvents: number;
  totalTodos: number;
  completionRate: number;
  workRatio: number;
  personalRatio: number;
  weeks?: MonthWeekItem[];
  hasData?: boolean;
}

interface MonthlySummarySectionProps {
  metrics: MonthlyMetrics;
  diagnosisText: string;
  onOpenRaioX: () => void;
  onAlignWeek?: () => void;
  weeks?: MonthWeekItem[];
}

export const MonthlySummarySection: React.FC<MonthlySummarySectionProps> = ({
  metrics,
  diagnosisText,
  onOpenRaioX,
  onAlignWeek,
  weeks,
}) => {
  const { colors } = useTheme();

  const monthName = React.useMemo(() => {
    const months = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];
    return months[new Date().getMonth()];
  }, []);

  const effectiveWeeks = React.useMemo<MonthWeekItem[]>(() => {
    if (weeks && weeks.length > 0) return weeks;
    if (metrics.weeks && metrics.weeks.length > 0) return metrics.weeks;
    return [];
  }, [weeks, metrics.weeks]);

  const hasData =
    metrics.hasData ??
    (parseFloat(metrics.totalHours) > 0 ||
      metrics.totalEvents > 0 ||
      effectiveWeeks.some((w) => w.h > 0));

  const maxH = Math.max(1, ...effectiveWeeks.map((w) => w.h));

  return (
    <View style={styles.container}>
      {/* Card 1 (.card2): Ring de Eficácia + Horas + Link Raio-X */}
      <View style={[styles.card2, { backgroundColor: colors.bg, borderColor: colors.line }]}>
        <View style={styles.ringRow}>
          {/* Anel Circular (.ring) */}
          <View style={[styles.ringOuter, { borderColor: colors.purple, backgroundColor: colors.surf }]}>
            <View style={[styles.ringInner, { backgroundColor: colors.bg }]}>
              <Text style={[styles.ringText, { color: colors.ink }]}>
                {metrics.completionRate}%
              </Text>
            </View>
          </View>

          {/* Dados do Mês */}
          <View style={styles.ringMetaCol}>
            <Text style={[styles.eyebrow, { color: colors.muted }]}>
              {monthName} · eficácia
            </Text>
            <Text style={[styles.subLabel, { color: colors.muted }]}>
              taxa de resolução
            </Text>
            <Text style={[styles.big, { color: colors.ink, marginTop: 6 }]}>
              {metrics.totalHours}
              <Text style={[styles.bigSmall, { color: colors.muted }]}>h em compromissos</Text>
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.lnk, { borderTopColor: colors.line }]}
          onPress={() => {
            hapticFeedback.light();
            onOpenRaioX();
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.lnkText, { color: colors.ink }]}>
            Abrir Raio-X
          </Text>
          <MaterialIcons name="chevron-right" size={16} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Card 2 (.card2): Horas reais por semana */}
      <View style={[styles.card2, { backgroundColor: colors.bg, borderColor: colors.line }]}>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>
          Horas por semana
        </Text>

        {!hasData || effectiveWeeks.length === 0 || effectiveWeeks.every((w) => w.h === 0) ? (
          <View style={styles.emptyWeeksContainer}>
            <MaterialIcons name="bar-chart" size={28} color={colors.muted} />
            <Text style={[styles.emptyWeeksTitle, { color: colors.ink }]}>
              Dados insuficientes no ciclo
            </Text>
            <Text style={[styles.emptyWeeksSub, { color: colors.muted }]}>
              Nenhum evento registrado com carga horária neste mês.
            </Text>
          </View>
        ) : (
          <View style={styles.cols}>
            {effectiveWeeks.map((w, idx) => {
              const barHeight = w.h > 0 ? Math.max(8, (w.h / maxH) * 64) : 4;
              return (
                <View key={idx} style={styles.colItem}>
                  <Text style={[styles.colValue, { color: colors.ink }]}>
                    {w.h > 0 ? `${w.h.toFixed(1)}h` : '0h'}
                  </Text>
                  <View
                    style={[
                      styles.colBar,
                      {
                        height: barHeight,
                        backgroundColor: w.cur ? colors.blue : w.h > 0 ? colors.ink : colors.line,
                      },
                    ]}
                  />
                  <Text style={[styles.colLabel, { color: colors.muted }]}>
                    {w.l}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Card 3 (.card2): Equilíbrio de Vida (.tl + .leg) */}
      <View style={[styles.card2, { backgroundColor: colors.bg, borderColor: colors.line }]}>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>
          Equilíbrio de vida
        </Text>

        {/* Linha Proporcional (.tl) */}
        <View style={styles.lifeBar}>
          <View
            style={[
              styles.lifeSegment,
              { flex: Math.max(1, metrics.workRatio), backgroundColor: colors.ink },
            ]}
          />
          <View
            style={[
              styles.lifeSegment,
              { flex: Math.max(1, metrics.personalRatio), backgroundColor: colors.acc },
            ]}
          />
        </View>

        {/* Legenda (.leg) */}
        <View style={styles.leg}>
          <View style={styles.legItem}>
            <View style={[styles.legDot, { backgroundColor: colors.ink }]} />
            <Text style={[styles.legText, { color: colors.ink }]}>
              Trabalho {metrics.workRatio}%
            </Text>
          </View>
          <View style={styles.legItem}>
            <View style={[styles.legDot, { backgroundColor: colors.acc }]} />
            <Text style={[styles.legText, { color: colors.ink }]}>
              Pessoal {metrics.personalRatio}%
            </Text>
          </View>
        </View>
      </View>

      {/* Card 4 (.vsug): Mensagem do Vito */}
      <View style={[styles.vsug, { backgroundColor: colors.surf, borderColor: colors.line }]}>
        <View style={styles.vsugMascot}>
          <VitoMascot size={32} state="idle" />
        </View>
        <View style={styles.vsugBody}>
          <Text style={[styles.vsugEyebrow, { color: colors.muted }]}>VITO</Text>
          <Text style={[styles.vsugText, { color: colors.ink }]}>
            {diagnosisText ||
              'Ciclo com demandas ativas. Mantenha o alinhamento semanal para priorizar o que realmente move o ponteiro.'}
          </Text>
          {onAlignWeek && (
            <View style={styles.vsugButtons}>
              <TouchableOpacity
                style={[styles.vsugBtnPrimary, { backgroundColor: colors.ink }]}
                onPress={onAlignWeek}
                activeOpacity={0.8}
              >
                <Text style={[styles.vsugBtnPrimaryText, { color: colors.bg }]}>
                  Alinhar semana
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  card2: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  ringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  ringOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringText: {
    fontSize: 20,
    fontFamily: tokens.typography.family.montserratBold,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  ringMetaCol: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  subLabel: {
    fontSize: 13,
    marginTop: 4,
  },
  big: {
    fontSize: 32,
    fontFamily: tokens.typography.family.montserratBold,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  bigSmall: {
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: 0,
    fontFamily: tokens.typography.family.medium,
  },
  lnk: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  lnkText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  cols: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginTop: 16,
    height: 100,
    paddingHorizontal: 4,
  },
  colItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  colValue: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  colBar: {
    width: '100%',
    borderRadius: 6,
  },
  colLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyWeeksContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  emptyWeeksTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyWeeksSub: {
    fontSize: 12,
    textAlign: 'center',
  },
  lifeBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    gap: 2,
    marginTop: 14,
  },
  lifeSegment: {
    height: '100%',
  },
  leg: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  legItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  legText: {
    fontSize: 13,
    fontWeight: '600',
  },
  vsug: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginTop: 2,
  },
  vsugMascot: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsugBody: {
    flex: 1,
  },
  vsugEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  vsugText: {
    fontSize: 14,
    lineHeight: 20,
  },
  vsugButtons: {
    marginTop: 10,
  },
  vsugBtnPrimary: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  vsugBtnPrimaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
