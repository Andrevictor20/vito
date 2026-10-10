import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  Platform,
  StatusBar as RNStatusBar,
  Share,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { Event, Todo } from '../../types';
import {
  calculateWeeklySummaries,
  WeeklySummaryItem,
  DailyActivityItem,
} from '../../utils/weeklySummaryCalculator';

export { WeeklySummaryItem };

interface WeeklySummariesViewProps {
  onBack: () => void;
}

export const WeeklySummariesView: React.FC<WeeklySummariesViewProps> = ({ onBack }) => {
  const { colors, isDark } = useTheme();
  const [events, setEvents] = useState<Event[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<WeeklySummaryItem | null>(null);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [fetchedEvents, fetchedTodos] = await Promise.all([
        api.getEvents(),
        api.getTodos(),
      ]);
      setEvents(fetchedEvents || []);
      setTodos(fetchedTodos || []);
    } catch (err) {
      console.error('[WeeklySummariesView] Erro ao carregar eventos e tarefas reais:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const summaries = useMemo(() => {
    return calculateWeeklySummaries(events, todos, 4);
  }, [events, todos]);

  const totals = useMemo(() => {
    const totalHours = Math.round(summaries.reduce((acc, s) => acc + s.hours, 0) * 10) / 10;
    const totalEvents = summaries.reduce((acc, s) => acc + s.eventsCount, 0);
    const totalCompletedTodos = summaries.reduce((acc, s) => acc + s.completedTodosCount, 0);
    return { totalHours, totalEvents, totalCompletedTodos };
  }, [summaries]);

  const handleShare = async (item: WeeklySummaryItem) => {
    try {
      await Share.share({
        title: `Resumo Semanal: ${item.title}`,
        message: `📊 Resumo Vito (${item.period}): "${item.title}"\n${item.narrative}\n\nTempo dedicado: ${item.hours}h em ${item.eventsCount} compromissos.`,
      });
    } catch (err) {
      console.log('[WeeklySummariesView] Erro ao compartilhar:', err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: colors.outlineVariant }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.surfaceContainerHighest }]}
          onPress={onBack}
          activeOpacity={0.7}
          hitSlop={tokens.hitSlop.sm}
          accessibilityLabel="Voltar para Radares"
        >
          <MaterialIcons name="chevron-left" size={24} color={colors.onSurface} />
        </TouchableOpacity>

        <View style={styles.headerTitleColumn}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Resumos</Text>
          <Text style={[styles.headerSubtitle, { color: colors.onSurfaceVariant }]}>
            IA & Otimização de Tempo
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.refreshHeaderBtn, { backgroundColor: colors.surfaceContainerHighest }]}
          onPress={onRefresh}
          hitSlop={tokens.hitSlop.sm}
          accessibilityLabel="Atualizar dados reais"
        >
          <MaterialIcons name="refresh" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>
            Sintetizando seus compromissos e tarefas reais...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* Hero Dashboard Executivo (Superior ao Toki) */}
          <View
            style={[
              styles.heroDashboardCard,
              {
                backgroundColor: isDark ? colors.surfaceContainer : colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <View style={styles.heroDashboardHeader}>
              <View style={styles.heroBadgeRow}>
                <View style={[styles.aiPulseDot, { backgroundColor: colors.accents.emerald }]} />
                <Text style={[styles.heroDashboardLabel, { color: colors.accents.emerald }]}>
                  ANÁLISE DE RITMO REAL
                </Text>
              </View>
              <Text style={[styles.heroPeriodSpan, { color: colors.onSurfaceVariant }]}>
                Últimas 4 semanas
              </Text>
            </View>

            <View style={styles.heroMetricsGrid}>
              <View style={styles.heroMetricItem}>
                <Text style={[styles.heroMetricValue, { color: colors.onSurface }]}>
                  {totals.totalHours}h
                </Text>
                <Text style={[styles.heroMetricSub, { color: colors.onSurfaceVariant }]}>
                  Dedicadas
                </Text>
              </View>

              <View style={[styles.heroMetricDivider, { backgroundColor: colors.outlineVariant }]} />

              <View style={styles.heroMetricItem}>
                <Text style={[styles.heroMetricValue, { color: colors.onSurface }]}>
                  {totals.totalEvents}
                </Text>
                <Text style={[styles.heroMetricSub, { color: colors.onSurfaceVariant }]}>
                  Compromissos
                </Text>
              </View>

              <View style={[styles.heroMetricDivider, { backgroundColor: colors.outlineVariant }]} />

              <View style={styles.heroMetricItem}>
                <Text style={[styles.heroMetricValue, { color: colors.onSurface }]}>
                  {totals.totalCompletedTodos}
                </Text>
                <Text style={[styles.heroMetricSub, { color: colors.onSurfaceVariant }]}>
                  Tarefas Feitas
                </Text>
              </View>
            </View>
          </View>

          {/* Banner Informativo */}
          <View
            style={[
              styles.infoBanner,
              {
                backgroundColor: isDark ? 'rgba(56, 189, 248, 0.08)' : '#F0F9FF',
                borderColor: isDark ? 'rgba(56, 189, 248, 0.2)' : '#BAE6FD',
              },
            ]}
          >
            <MaterialIcons name="auto-awesome" size={20} color={colors.accents.sky} />
            <Text style={[styles.infoBannerText, { color: colors.onSurface }]}>
              O Vito sintetiza seus compromissos e tarefas reais para entender seu ritmo e sugerir formas de aproveitar melhor suas horas.
            </Text>
          </View>

          {/* Lista de Resumos das Semanas */}
          {summaries.map((item) => {
            const maxDailyHours = Math.max(...item.dailyActivity.map((d) => d.hours), 1);

            return (
              <View
                key={item.id}
                style={[
                  styles.summaryCard,
                  {
                    backgroundColor: isDark ? colors.surfaceContainer : colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                {/* Header do Card */}
                <View style={styles.cardHeader}>
                  <Text style={[styles.periodText, { color: colors.accents.amber }]}>
                    {item.period}
                  </Text>
                  {item.isCurrentWeek && (
                    <View
                      style={[
                        styles.currentWeekBadge,
                        { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5' },
                      ]}
                    >
                      <Text style={[styles.currentWeekText, { color: colors.accents.emerald }]}>
                        EM ANDAMENTO
                      </Text>
                    </View>
                  )}
                </View>

                {/* Título de Destaque */}
                <Text style={[styles.summaryTitle, { color: colors.onSurface }]}>
                  {item.title}
                </Text>

                {/* Narrativa Reflexiva */}
                <Text style={[styles.narrativeText, { color: colors.onSurfaceVariant }]}>
                  {item.narrative}
                </Text>

                {/* Gráfico de Barras de Atividade Diária (Seg a Dom) */}
                <View style={styles.chartSection}>
                  <View style={styles.chartHeaderRow}>
                    <Text style={[styles.chartSectionTitle, { color: colors.onSurfaceVariant }]}>
                      DISTRIBUIÇÃO DIÁRIA (HORAS)
                    </Text>
                    <Text style={[styles.chartPeakHint, { color: colors.textMuted }]}>
                      Pico destacado
                    </Text>
                  </View>

                  <View style={styles.barChartContainer}>
                    {item.dailyActivity.map((day: DailyActivityItem, idx: number) => {
                      const heightPercent = Math.min(100, Math.max(12, Math.round((day.hours / maxDailyHours) * 100)));
                      const barColor = day.isPeak
                        ? colors.accents.sky
                        : day.hours > 0
                        ? (isDark ? colors.surfaceContainerHighest : colors.primary)
                        : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)');

                      return (
                        <View key={idx} style={styles.barColumn}>
                          {day.hours > 0 && (
                            <Text style={[styles.barValueText, { color: day.isPeak ? colors.accents.sky : colors.textMuted }]}>
                              {day.hours}
                            </Text>
                          )}
                          <View style={styles.barTrack}>
                            <View
                              style={[
                                styles.barFill,
                                {
                                  height: `${heightPercent}%`,
                                  backgroundColor: barColor,
                                },
                              ]}
                            />
                          </View>
                          <Text
                            style={[
                              styles.dayLabelText,
                              {
                                color: day.isToday
                                  ? colors.accents.sky
                                  : day.isPeak
                                  ? colors.onSurface
                                  : colors.onSurfaceVariant,
                                fontWeight: day.isToday || day.isPeak ? '700' : '500',
                              },
                            ]}
                          >
                            {day.dayLabel}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Barra de Progresso Multissegmentada de Categorias */}
                {item.categories.length > 0 && (
                  <View style={styles.categoryDistributionBlock}>
                    <View style={styles.multiProgressBar}>
                      {item.categories.map((cat, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.progressSegment,
                            {
                              flex: Math.max(cat.percentage, 5),
                              backgroundColor: cat.color,
                            },
                          ]}
                        />
                      ))}
                    </View>

                    <View style={styles.categoriesRow}>
                      {item.categories.map((cat, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.catBadge,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255,255,255,0.06)'
                                : colors.surfaceContainerHigh,
                            },
                          ]}
                        >
                          <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                          <Text style={[styles.catText, { color: colors.onSurface }]}>
                            {cat.name} {cat.percentage}% ({cat.hours}h)
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Rodapé do Card com Métricas e Botão de Ação */}
                <View style={[styles.cardFooter, { borderTopColor: colors.outlineVariant }]}>
                  <View style={styles.footerStatsRow}>
                    <View style={styles.footerStatItem}>
                      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>HORAS</Text>
                      <Text style={[styles.metricValue, { color: colors.onSurface }]}>
                        {item.hours}
                      </Text>
                    </View>

                    <View style={styles.footerStatItem}>
                      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>EVENTOS</Text>
                      <Text style={[styles.metricValue, { color: colors.onSurface }]}>
                        {item.eventsCount}
                      </Text>
                    </View>

                    <View style={styles.footerStatItem}>
                      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>TAREFAS</Text>
                      <Text style={[styles.metricValue, { color: colors.onSurface }]}>
                        {item.completedTodosCount}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.readMoreBtn,
                      {
                        backgroundColor: colors.surfaceContainerHighest,
                        borderColor: colors.outlineVariant,
                      },
                    ]}
                    onPress={() => setSelectedSummary(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.readMoreText, { color: colors.primary }]}>
                      Ver raio-x
                    </Text>
                    <MaterialIcons name="arrow-forward" size={14} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Modal de Detalhe Completo do Resumo */}
      {selectedSummary && (
        <Modal
          visible={true}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setSelectedSummary(null)}
        >
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <SafeAreaView style={[styles.detailModalContainer, { backgroundColor: colors.surface }]}>
            {/* Modal TopBar */}
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={[styles.closeModalBtn, { backgroundColor: colors.surfaceContainerHighest }]}
                onPress={() => setSelectedSummary(null)}
                hitSlop={tokens.hitSlop.sm}
              >
                <MaterialIcons name="close" size={20} color={colors.onSurface} />
              </TouchableOpacity>

              <Text style={[styles.modalHeaderTitle, { color: colors.onSurface }]}>
                Resumo semanal
              </Text>

              <TouchableOpacity
                style={[styles.closeModalBtn, { backgroundColor: colors.surfaceContainerHighest }]}
                onPress={() => handleShare(selectedSummary)}
                hitSlop={tokens.hitSlop.sm}
              >
                <MaterialIcons name="share" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalPeriod, { color: colors.accents.sky }]}>
                {selectedSummary.period}
              </Text>

              <Text style={[styles.modalSummaryTitle, { color: colors.onSurface }]}>
                {selectedSummary.title}
              </Text>

              <Text style={[styles.modalNarrative, { color: colors.onSurfaceVariant }]}>
                {selectedSummary.narrative}
              </Text>

              {/* Grid de Métricas */}
              <View style={styles.modalMetricsRow}>
                <View
                  style={[
                    styles.modalMetricBox,
                    { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
                  ]}
                >
                  <Text style={[styles.modalMetricLabel, { color: colors.textMuted }]}>HORAS</Text>
                  <Text style={[styles.modalMetricBig, { color: colors.onSurface }]}>
                    {selectedSummary.hours}h
                  </Text>
                </View>

                <View
                  style={[
                    styles.modalMetricBox,
                    { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
                  ]}
                >
                  <Text style={[styles.modalMetricLabel, { color: colors.textMuted }]}>
                    EVENTOS
                  </Text>
                  <Text style={[styles.modalMetricBig, { color: colors.onSurface }]}>
                    {selectedSummary.eventsCount}
                  </Text>
                </View>

                <View
                  style={[
                    styles.modalMetricBox,
                    { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
                  ]}
                >
                  <Text style={[styles.modalMetricLabel, { color: colors.textMuted }]}>
                    TAREFAS
                  </Text>
                  <Text style={[styles.modalMetricBig, { color: colors.onSurface }]}>
                    {selectedSummary.completedTodosCount}
                  </Text>
                </View>
              </View>

              {/* Detalhe de Carga por Dia */}
              <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
                CARGA POR DIA DA SEMANA
              </Text>
              <View style={styles.dailyDetailList}>
                {selectedSummary.dailyActivity.map((day, idx) => (
                  <View key={idx} style={styles.dailyDetailRow}>
                    <View style={styles.dailyDetailLeft}>
                      <Text style={[styles.dailyDetailDay, { color: colors.onSurface }]}>
                        {day.dayLabel} ({day.dateStr})
                      </Text>
                      {day.isPeak && (
                        <View style={[styles.peakTag, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                          <Text style={[styles.peakTagText, { color: colors.accents.sky }]}>
                            Pico
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.dailyDetailHours, { color: colors.onSurfaceVariant }]}>
                      {day.hours}h ({day.eventsCount} {day.eventsCount === 1 ? 'evento' : 'eventos'})
                    </Text>
                  </View>
                ))}
              </View>

              {/* Distribuição por Categoria */}
              {selectedSummary.categories.length > 0 && (
                <>
                  <Text style={[styles.sectionHeading, { color: colors.textMuted, marginTop: tokens.spacing.md }]}>
                    DISTRIBUIÇÃO POR CATEGORIA
                  </Text>

                  {selectedSummary.categories.map((cat, idx) => (
                    <View key={idx} style={styles.catDistributionRow}>
                      <View style={styles.catDistributionHeader}>
                        <View style={styles.catDotRow}>
                          <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                          <Text style={[styles.catName, { color: colors.onSurface }]}>{cat.name}</Text>
                        </View>
                        <Text style={[styles.catPercentageText, { color: colors.onSurface }]}>
                          {cat.percentage}% ({cat.hours}h)
                        </Text>
                      </View>
                      <View
                        style={[styles.progressBarTrack, { backgroundColor: colors.surfaceContainerHighest }]}
                      >
                        <View
                          style={[
                            styles.progressBarFill,
                            { width: `${cat.percentage}%`, backgroundColor: cat.color },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </>
              )}

              {/* Principais Compromissos Registrados */}
              {selectedSummary.topEvents.length > 0 && (
                <>
                  <Text style={[styles.sectionHeading, { color: colors.textMuted, marginTop: tokens.spacing.md }]}>
                    COMPROMISSOS REGISTRADOS
                  </Text>
                  {selectedSummary.topEvents.map((ev) => (
                    <View key={ev.id} style={styles.topEventItem}>
                      <MaterialIcons name="event" size={16} color={colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.topEventTitle, { color: colors.onSurface }]}>
                          {ev.title}
                        </Text>
                        {ev.time ? (
                          <Text style={[styles.topEventTime, { color: colors.onSurfaceVariant }]}>
                            {ev.time}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </>
              )}

              {/* Dicas da IA para Otimizar o Tempo */}
              <Text style={[styles.sectionHeading, { color: colors.textMuted, marginTop: tokens.spacing.lg }]}>
                DICAS DO VITO PARA OTIMIZAR SEU TEMPO
              </Text>

              {selectedSummary.tips.map((tip, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.tipCard,
                    {
                      backgroundColor: isDark ? colors.surfaceContainerHigh : colors.surfaceContainerLow,
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                >
                  <View style={[styles.tipIconBox, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7' }]}>
                    <MaterialIcons name="lightbulb" size={18} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: colors.accents.amber, letterSpacing: 0.5 }}>
                      {tip.category.toUpperCase()}
                    </Text>
                    <Text style={[styles.tipText, { color: colors.onSurface }]}>{tip.text}</Text>
                  </View>
                </View>
              ))}

              {/* Nota de Configuração no Rodapé */}
              <View style={styles.footerNotice}>
                <Text style={[styles.footerNoticeText, { color: colors.textMuted }]}>
                  Sintetizado com inteligência com base na sua rotina real no Vito.
                </Text>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleColumn: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 90,
    gap: 14,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  heroDashboardCard: {
    borderRadius: MD3Shapes.extraLarge,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  heroDashboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroDashboardLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroPeriodSpan: {
    fontSize: 12,
    fontWeight: '500',
  },
  heroMetricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 4,
  },
  heroMetricItem: {
    alignItems: 'center',
    flex: 1,
  },
  heroMetricValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroMetricSub: {
    fontSize: 11,
    marginTop: 2,
  },
  heroMetricDivider: {
    width: 1,
    height: 28,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    gap: 10,
  },
  infoBannerText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  summaryCard: {
    borderRadius: MD3Shapes.extraLarge,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  periodText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  currentWeekBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: MD3Shapes.full,
  },
  currentWeekText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  narrativeText: {
    fontSize: 13,
    lineHeight: 19,
  },
  chartSection: {
    marginTop: 6,
    marginBottom: 4,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  chartSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  chartPeakHint: {
    fontSize: 10,
  },
  barChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 72,
    paddingTop: 14,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barValueText: {
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 2,
  },
  barTrack: {
    width: 14,
    height: 42,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    borderRadius: 7,
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  dayLabelText: {
    fontSize: 10,
    marginTop: 4,
  },
  categoryDistributionBlock: {
    marginTop: 4,
    gap: 8,
  },
  multiProgressBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  progressSegment: {
    height: '100%',
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: MD3Shapes.full,
    gap: 5,
  },
  catDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  catText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  footerStatItem: {
    gap: 1,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  readMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
    gap: 4,
  },
  readMoreText: {
    fontSize: 12,
    fontWeight: '700',
  },
  detailModalContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? Math.max((RNStatusBar.currentHeight || 0) + 6, 44) : 0,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeModalBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  modalPeriod: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalSummaryTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  modalNarrative: {
    fontSize: 14,
    lineHeight: 22,
  },
  modalMetricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalMetricBox: {
    flex: 1,
    padding: 12,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  modalMetricBig: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalMetricLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  dailyDetailList: {
    gap: 8,
  },
  dailyDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dailyDetailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dailyDetailDay: {
    fontSize: 13,
    fontWeight: '600',
  },
  peakTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: MD3Shapes.full,
  },
  peakTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  dailyDetailHours: {
    fontSize: 12,
  },
  catDistributionRow: {
    marginBottom: 8,
  },
  catDistributionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  catDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catName: {
    fontSize: 12,
    fontWeight: '600',
  },
  catPercentageText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  topEventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  topEventTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  topEventTime: {
    fontSize: 11,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    marginBottom: 8,
  },
  tipIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  footerNotice: {
    marginTop: 20,
    paddingTop: 10,
    alignItems: 'center',
  },
  footerNoticeText: {
    fontSize: 11,
    textAlign: 'center',
  },
});
