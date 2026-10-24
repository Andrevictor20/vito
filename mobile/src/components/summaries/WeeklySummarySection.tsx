import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import { WeeklySummaryItem } from '../../utils/weeklySummaryCalculator';

interface WeeklySummarySectionProps {
  summaries: WeeklySummaryItem[];
  onSelectWeek: (item: WeeklySummaryItem) => void;
}

export const WeeklySummarySection: React.FC<WeeklySummarySectionProps> = ({
  summaries,
  onSelectWeek,
}) => {
  const { colors } = useTheme();
  // Semana expandida por padrão é a mais recente (semana atual)
  const [expandedId, setExpandedId] = useState<string | null>(
    summaries[0]?.id || null
  );

  const toggleExpand = (id: string) => {
    hapticFeedback.selection();
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Cálculo de delta vs semana anterior
  const deltaHours = React.useMemo(() => {
    if (summaries.length < 2) return null;
    const curH = summaries[0]?.hours || 0;
    const prevH = summaries[1]?.hours || 0;
    const diff = curH - prevH;
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(1)}h vs semana anterior`;
  }, [summaries]);

  // Altura máxima para as barras
  const maxBarH = 72;
  const maxHoursInList = Math.max(1, ...summaries.map((s) => s.hours || 0));

  // Ordenação cronológica para o gráfico de barras (da esquerda para direita)
  const chronological = React.useMemo(() => {
    return [...summaries].reverse();
  }, [summaries]);

  return (
    <View style={styles.container}>
      {/* Card 1 (.card2): Gráfico de Barras de Horas por Semana */}
      <View style={[styles.card2, { backgroundColor: colors.bg, borderColor: colors.line }]}>
        <View style={styles.eyebrowRow}>
          <MaterialIcons name="calendar-month" size={15} color={colors.blue} />
          <Text style={[styles.eyebrow, { color: colors.muted }]}>
            Horas em compromissos por semana
          </Text>
        </View>

        {/* Gráfico de Colunas (.cols) */}
        <View style={styles.cols}>
          {chronological.map((w) => {
            const h = w.hours || 0;
            const barHeight = Math.max(8, (h / maxHoursInList) * maxBarH);
            const isCur = w.isCurrentWeek;

            return (
              <View key={w.id} style={styles.colItem}>
                <Text style={[styles.colValue, { color: colors.ink }]}>
                  {h.toFixed(1)}h
                </Text>
                <View
                  style={[
                    styles.colBar,
                    {
                      height: barHeight,
                      backgroundColor: isCur ? colors.blue : colors.line,
                    },
                  ]}
                />
                <Text style={[styles.colLabel, { color: colors.muted }]} numberOfLines={1}>
                  {w.period.split(' ')[0] || w.period}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Pill delta */}
        {deltaHours && (
          <View style={styles.deltaWrapper}>
            <View style={[styles.pillst, { backgroundColor: colors.surf, borderColor: colors.line }]}>
              <Text style={[styles.pillstText, { color: colors.ink }]}>{deltaHours}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Ciclos Semanais Expansíveis (.cyc) */}
      <View style={styles.cyclesList}>
        {summaries.map((item) => {
          const isOpen = expandedId === item.id;

          return (
            <View
              key={item.id}
              style={[
                styles.cyc,
                { backgroundColor: colors.bg, borderColor: colors.line },
              ]}
            >
              <TouchableOpacity
                style={styles.cycHeader}
                onPress={() => toggleExpand(item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.cycTitleCol}>
                  <View style={styles.cycTitleRow}>
                    <Text style={[styles.cycTitle, { color: colors.ink }]}>
                      {item.period}
                    </Text>
                    {item.isCurrentWeek && (
                      <View style={[styles.pillst, { backgroundColor: colors.greenBg, borderColor: colors.greenBg }]}>
                        <Text style={[styles.pillstText, { color: colors.acc }]}>
                          Em andamento
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.cycMeta, { color: colors.muted }]}>
                    {item.hours.toFixed(1)}h · {item.eventsCount} eventos · {item.completedTodosCount}/{item.totalTodosCount || 0} tarefas
                  </Text>
                </View>

                <MaterialIcons
                  name="chevron-right"
                  size={20}
                  color={colors.muted}
                  style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
                />
              </TouchableOpacity>

              {isOpen && (
                <View style={styles.cycBody}>
                  <Text style={[styles.cycNarrative, { color: colors.ink }]}>
                    {item.narrative}
                  </Text>

                  <TouchableOpacity
                    style={[styles.lnk, { borderTopColor: colors.line }]}
                    onPress={() => {
                      hapticFeedback.light();
                      onSelectWeek(item);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.lnkText, { color: colors.ink }]}>
                      Abrir Raio-X
                    </Text>
                    <MaterialIcons name="chevron-right" size={16} color={colors.muted} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
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
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  cols: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginTop: 18,
    height: 110,
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
  deltaWrapper: {
    marginTop: 14,
    alignItems: 'flex-start',
  },
  pillst: {
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
  },
  pillstText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  cyclesList: {
    gap: 10,
  },
  cyc: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cycHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  cycTitleCol: {
    flex: 1,
  },
  cycTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cycTitle: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  cycMeta: {
    fontSize: 12.5,
    marginTop: 4,
  },
  cycBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  cycNarrative: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  lnk: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  lnkText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
});
