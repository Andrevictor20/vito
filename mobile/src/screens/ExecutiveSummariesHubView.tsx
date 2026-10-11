import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Platform,
  StatusBar as RNStatusBar,
  Share,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes, tabularNumbers } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../theme/motion';
import { api } from '../services/api';
import { Event, Todo } from '../types';
import {
  calculateWeeklySummaries,
  WeeklySummaryItem,
} from '../utils/weeklySummaryCalculator';

interface ExecutiveSummariesHubViewProps {
  onBack: () => void;
  onOpenChatWithPrompt?: (prompt: string) => void;
}

type SummaryHorizon = 'daily' | 'weekly' | 'monthly';

export const ExecutiveSummariesHubView: React.FC<ExecutiveSummariesHubViewProps> = ({
  onBack,
  onOpenChatWithPrompt,
}) => {
  const { colors, isDark } = useTheme();

  const [horizon, setHorizon] = useState<SummaryHorizon>('daily');
  const [events, setEvents] = useState<Event[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [fetchedEvents, fetchedTodos] = await Promise.all([
        api.getEvents(),
        api.getTodos(),
      ]);
      setEvents(fetchedEvents || []);
      setTodos(fetchedTodos || []);
    } catch (err) {
      console.warn('[ExecutiveSummariesHubView] Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  // Cálculos do Resumo Semanal (4 semanas)
  const weeklySummaries = useMemo(() => {
    return calculateWeeklySummaries(events, todos, 4);
  }, [events, todos]);

  // Cálculos do Horizonte Diário
  const todayMetrics = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayEvents = events.filter((e) => e.start_at.startsWith(todayStr));
    const todayTodos = todos.filter((t) => !t.due_date || t.due_date.startsWith(todayStr));
    const completedTodos = todayTodos.filter((t) => t.status === 'completed');

    let totalMinutes = 0;
    todayEvents.forEach((e) => {
      const s = new Date(e.start_at).getTime();
      const end = new Date(e.end_at).getTime();
      if (end > s) {
        totalMinutes += Math.round((end - s) / (1000 * 60));
      }
    });

    const hours = (totalMinutes / 60).toFixed(1);
    const freeHours = Math.max(0, 12 - Number(hours)).toFixed(1); // janela produtiva padrão de 12h

    return {
      eventsCount: todayEvents.length,
      todayEvents,
      committedHours: hours,
      freeHours,
      totalTodos: todayTodos.length,
      completedTodos: completedTodos.length,
    };
  }, [events, todos]);

  // Cálculos do Horizonte Mensal
  const monthlyMetrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthEvents = events.filter((e) => {
      const d = new Date(e.start_at);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const monthTodos = todos.filter((t) => {
      const d = new Date(t.due_date || t.created_at || now);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const completedCount = monthTodos.filter((t) => t.status === 'completed').length;
    const taskCompletionRate =
      monthTodos.length > 0 ? Math.round((completedCount / monthTodos.length) * 100) : 100;

    let totalMonthMinutes = 0;
    let workMinutes = 0;
    let personalMinutes = 0;

    monthEvents.forEach((e) => {
      const s = new Date(e.start_at).getTime();
      const end = new Date(e.end_at).getTime();
      const dur = end > s ? Math.round((end - s) / (1000 * 60)) : 60;
      totalMonthMinutes += dur;

      const cat = (e.category || '').toLowerCase();
      if (cat.includes('trab') || cat.includes('work') || cat.includes('reuni')) {
        workMinutes += dur;
      } else {
        personalMinutes += dur;
      }
    });

    const workRatio =
      totalMonthMinutes > 0 ? Math.round((workMinutes / totalMonthMinutes) * 100) : 50;
    const personalRatio = 100 - workRatio;

    return {
      totalHours: (totalMonthMinutes / 60).toFixed(0),
      totalEvents: monthEvents.length,
      totalTodos: monthTodos.length,
      completionRate: taskCompletionRate,
      workRatio,
      personalRatio,
    };
  }, [events, todos]);

  const handleShare = async () => {
    hapticFeedback.medium();
    try {
      const message = `📊 Síntese Executiva do Vito:\n• Compromissos hoje: ${todayMetrics.eventsCount} (${todayMetrics.committedHours}h)\n• Tarefas concluídas: ${todayMetrics.completedTodos}/${todayMetrics.totalTodos}\n• Taxa de conclusão mensal: ${monthlyMetrics.completionRate}%`;
      await Share.share({ message });
    } catch {}
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* TopBar */}
      <View style={[styles.topBar, { borderBottomColor: colors.outlineVariant }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            hapticFeedback.selection();
            onBack();
          }}
          hitSlop={tokens.hitSlop.md}
        >
          <MaterialIcons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>

        <View style={styles.topBarTitleContainer}>
          <Text style={[styles.topBarTitle, { color: colors.onSurface }]}>Central de Resumos</Text>
          <Text style={[styles.topBarSubtitle, { color: colors.textMuted }]}>
            Visão Executiva da sua Vida
          </Text>
        </View>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} hitSlop={tokens.hitSlop.md}>
          <MaterialIcons name="share" size={20} color={colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Seletor de Horizonte (Diário / Semanal / Mensal) */}
        <View style={styles.horizonSelectorContainer}>
          <View
            style={[
              styles.horizonPill,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            {(['daily', 'weekly', 'monthly'] as SummaryHorizon[]).map((h) => {
              const isActive = horizon === h;
              const labels: Record<SummaryHorizon, string> = {
                daily: '☀️ Diário',
                weekly: '📊 Semanal',
                monthly: '🗓️ Mensal',
              };

              return (
                <TouchableOpacity
                  key={h}
                  style={[
                    styles.horizonTab,
                    isActive && [
                      styles.horizonTabActive,
                      { backgroundColor: isDark ? colors.surfaceContainerHighest : colors.primary },
                    ],
                  ]}
                  onPress={() => {
                    hapticFeedback.selection();
                    setHorizon(h);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.horizonLabel,
                      {
                        color: isActive
                          ? isDark
                            ? colors.onSurface
                            : colors.onPrimary
                          : colors.onSurfaceVariant,
                        fontWeight: isActive ? '600' : '500',
                      },
                    ]}
                  >
                    {labels[h]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : horizon === 'daily' ? (
          /* ==========================================
             BENTO GRID DIÁRIO
             ========================================== */
          <View style={styles.bentoGrid}>
            {/* Card Hero: Carga de Hoje */}
            <View
              style={[
                styles.bentoCard,
                styles.bentoCardSpan2,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <View style={styles.bentoHeader}>
                <Text style={[styles.bentoTag, { color: colors.primary }]}>CARGA DO DIA</Text>
                <MaterialIcons name="schedule" size={16} color={colors.textMuted} />
              </View>

              <View style={styles.heroNumbersRow}>
                <View>
                  <Text style={[styles.heroBigNumber, tabularNumbers, { color: colors.onSurface }]}>
                    {todayMetrics.committedHours}h
                  </Text>
                  <Text style={[styles.heroLabel, { color: colors.textMuted }]}>
                    Comprometidas hoje
                  </Text>
                </View>

                <View style={styles.heroDivider} />

                <View>
                  <Text style={[styles.heroBigNumber, tabularNumbers, { color: colors.primary }]}>
                    {todayMetrics.freeHours}h
                  </Text>
                  <Text style={[styles.heroLabel, { color: colors.textMuted }]}>
                    Blocos livres estimados
                  </Text>
                </View>
              </View>
            </View>

            {/* Card 2: Compromissos Hoje */}
            <View
              style={[
                styles.bentoCard,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <View style={styles.bentoHeader}>
                <Text style={[styles.bentoTag, { color: colors.primary }]}>AGENDA</Text>
                <MaterialIcons name="event" size={16} color={colors.textMuted} />
              </View>
              <Text style={[styles.cardValue, tabularNumbers, { color: colors.onSurface }]}>
                {todayMetrics.eventsCount}
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
                {todayMetrics.eventsCount === 1 ? 'Compromisso hoje' : 'Compromissos hoje'}
              </Text>
            </View>

            {/* Card 3: Checklist Hoje */}
            <View
              style={[
                styles.bentoCard,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <View style={styles.bentoHeader}>
                <Text style={[styles.bentoTag, { color: colors.primary }]}>TAREFAS</Text>
                <MaterialIcons name="check-circle-outline" size={16} color={colors.textMuted} />
              </View>
              <Text style={[styles.cardValue, tabularNumbers, { color: colors.onSurface }]}>
                {todayMetrics.completedTodos}/{todayMetrics.totalTodos}
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
                Finalizadas no dia
              </Text>
            </View>

            {/* Card Ação: Pedir Análise ao Vito */}
            <TouchableOpacity
              style={[
                styles.bentoCard,
                styles.bentoCardSpan2,
                styles.aiActionCard,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                },
              ]}
              onPress={() => {
                hapticFeedback.medium();
                if (onOpenChatWithPrompt) {
                  onOpenChatWithPrompt('Vito, faça uma síntese executiva do meu dia de hoje e me diga onde focar.');
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.aiActionLeft}>
                <View
                  style={[
                    styles.aiIconBadge,
                    { backgroundColor: isDark ? colors.surfaceContainerHighest : colors.primary },
                  ]}
                >
                  <MaterialIcons name="auto-awesome" size={18} color={isDark ? colors.onSurface : colors.onPrimary} />
                </View>
                <View style={styles.aiActionText}>
                  <Text style={[styles.aiActionTitle, { color: colors.onSurface }]}>
                    Síntese Executiva com a IA
                  </Text>
                  <Text style={[styles.aiActionSubtitle, { color: colors.textMuted }]}>
                    Toque para receber uma análise sob medida dos seus horários no chat.
                  </Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ) : horizon === 'weekly' ? (
          /* ==========================================
             HORIZONTE SEMANAL (4 SEMANAS)
             ========================================== */
          <View style={styles.weeklyList}>
            {weeklySummaries.map((item, idx) => (
              <View
                key={item.id}
                style={[
                  styles.weeklyCard,
                  {
                    backgroundColor: colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.weeklyCardHeader}>
                  <Text style={[styles.weeklyRange, { color: colors.onSurface }]}>
                    {item.period}
                  </Text>
                  {item.isCurrentWeek && (
                    <View
                      style={[
                        styles.currentBadge,
                        { backgroundColor: colors.surfaceContainerHighest },
                      ]}
                    >
                      <Text style={[styles.currentBadgeText, { color: colors.primary }]}>
                        EM ANDAMENTO
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.weeklyTheme, { color: colors.textMuted }]}>
                  {item.title}
                </Text>

                <View style={styles.weeklyStatsRow}>
                  <View style={styles.weeklyStat}>
                    <Text style={[styles.weeklyStatVal, tabularNumbers, { color: colors.onSurface }]}>
                      {item.hours}h
                    </Text>
                    <Text style={[styles.weeklyStatLbl, { color: colors.textMuted }]}>Horas</Text>
                  </View>

                  <View style={styles.weeklyStat}>
                    <Text style={[styles.weeklyStatVal, tabularNumbers, { color: colors.onSurface }]}>
                      {item.eventsCount}
                    </Text>
                    <Text style={[styles.weeklyStatLbl, { color: colors.textMuted }]}>Eventos</Text>
                  </View>

                  <View style={styles.weeklyStat}>
                    <Text style={[styles.weeklyStatVal, tabularNumbers, { color: colors.onSurface }]}>
                      {item.completedTodosCount}
                    </Text>
                    <Text style={[styles.weeklyStatLbl, { color: colors.textMuted }]}>Tarefas</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          /* ==========================================
             BENTO GRID MENSAL
             ========================================== */
          <View style={styles.bentoGrid}>
            {/* Card Hero: Taxa de Conclusão */}
            <View
              style={[
                styles.bentoCard,
                styles.bentoCardSpan2,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <View style={styles.bentoHeader}>
                <Text style={[styles.bentoTag, { color: colors.primary }]}>EFICÁCIA MENSAL</Text>
                <MaterialIcons name="trending-up" size={16} color={colors.textMuted} />
              </View>

              <View style={styles.heroNumbersRow}>
                <View>
                  <Text style={[styles.heroBigNumber, tabularNumbers, { color: colors.onSurface }]}>
                    {monthlyMetrics.completionRate}%
                  </Text>
                  <Text style={[styles.heroLabel, { color: colors.textMuted }]}>
                    Taxa de resolução de tarefas
                  </Text>
                </View>

                <View style={styles.heroDivider} />

                <View>
                  <Text style={[styles.heroBigNumber, tabularNumbers, { color: colors.primary }]}>
                    {monthlyMetrics.totalHours}h
                  </Text>
                  <Text style={[styles.heroLabel, { color: colors.textMuted }]}>
                    Investidas em compromissos
                  </Text>
                </View>
              </View>
            </View>

            {/* Card Equilíbrio */}
            <View
              style={[
                styles.bentoCard,
                styles.bentoCardSpan2,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <View style={styles.bentoHeader}>
                <Text style={[styles.bentoTag, { color: colors.primary }]}>
                  EQUILÍBRIO TRABALHO VS PESSOAL
                </Text>
                <MaterialIcons name="pie-chart-outline" size={16} color={colors.textMuted} />
              </View>

              <View style={styles.balanceBarContainer}>
                <View
                  style={[
                    styles.balanceBarSegment,
                    {
                      flex: monthlyMetrics.workRatio,
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.balanceBarSegment,
                    {
                      flex: monthlyMetrics.personalRatio,
                      backgroundColor: colors.outline,
                    },
                  ]}
                />
              </View>

              <View style={styles.balanceLegendRow}>
                <Text style={[styles.balanceLegendText, tabularNumbers, { color: colors.onSurface }]}>
                  💼 Trabalho: {monthlyMetrics.workRatio}%
                </Text>
                <Text style={[styles.balanceLegendText, tabularNumbers, { color: colors.textMuted }]}>
                  🌿 Pessoal: {monthlyMetrics.personalRatio}%
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 0,
  },
  topBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: tokens.spacing.xs,
    marginRight: tokens.spacing.sm,
  },
  topBarTitleContainer: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  topBarSubtitle: {
    fontSize: 12,
  },
  shareBtn: {
    padding: tokens.spacing.xs,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: tokens.spacing.md,
    paddingBottom: 90,
  },
  horizonSelectorContainer: {
    marginBottom: tokens.spacing.md,
  },
  horizonPill: {
    flexDirection: 'row',
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
    padding: 3,
  },
  horizonTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: MD3Shapes.full,
  },
  horizonTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  horizonLabel: {
    fontSize: 13,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bentoCard: {
    width: '48.5%',
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    padding: tokens.spacing.md,
    gap: 6,
  },
  bentoCardSpan2: {
    width: '100%',
  },
  bentoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bentoTag: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  cardSubtitle: {
    fontSize: 12,
  },
  heroNumbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  heroBigNumber: {
    fontSize: 28,
    fontWeight: '700',
  },
  heroLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  heroDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(128,128,128,0.2)',
  },
  aiActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  aiIconBadge: {
    width: 36,
    height: 36,
    borderRadius: MD3Shapes.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiActionText: {
    flex: 1,
    gap: 2,
  },
  aiActionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  aiActionSubtitle: {
    fontSize: 12,
  },
  weeklyList: {
    gap: 10,
  },
  weeklyCard: {
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    padding: tokens.spacing.md,
    gap: 8,
  },
  weeklyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weeklyRange: {
    fontSize: 15,
    fontWeight: '600',
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: MD3Shapes.extraSmall,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  weeklyTheme: {
    fontSize: 13,
  },
  weeklyStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  weeklyStat: {
    alignItems: 'center',
  },
  weeklyStatVal: {
    fontSize: 16,
    fontWeight: '600',
  },
  weeklyStatLbl: {
    fontSize: 11,
    marginTop: 2,
  },
  balanceBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
    marginVertical: 8,
  },
  balanceBarSegment: {
    height: '100%',
  },
  balanceLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceLegendText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
