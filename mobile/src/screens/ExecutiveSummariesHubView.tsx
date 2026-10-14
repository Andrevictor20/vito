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
  BackHandler,
  Modal,
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
  const [selectedWeekModal, setSelectedWeekModal] = useState<WeeklySummaryItem | null>(null);
  const [showMonthlyModal, setShowMonthlyModal] = useState(false);

  // Intercepta gesto de voltar do hardware/Android para retornar à tela anterior
  useEffect(() => {
    const onBackPress = () => {
      if (selectedWeekModal) {
        setSelectedWeekModal(null);
        return true;
      }
      if (showMonthlyModal) {
        setShowMonthlyModal(false);
        return true;
      }
      onBack();
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [onBack, selectedWeekModal, showMonthlyModal]);

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

  const dailySynthesisText = useMemo(() => {
    const committed = parseFloat(todayMetrics.committedHours) || 0;
    const free = parseFloat(todayMetrics.freeHours) || 0;
    const eventsCount = todayMetrics.eventsCount;
    const totalTodos = todayMetrics.totalTodos;
    const completedTodos = todayMetrics.completedTodos;
    const openTodos = totalTodos - completedTodos;

    if (eventsCount === 0 && totalTodos === 0) {
      return 'Sua agenda e lista de tarefas estão totalmente livres hoje. Momento propício para descanso, planejamento estratégico ou adiantar projetos de longo prazo.';
    }
    if (eventsCount === 0) {
      return `Dia sem compromissos fixos agendados. Você possui ${openTodos} tarefa(s) pendente(s) — oportunidade excelente para blocos de foco contínuo e resolução profunda de prioridades.`;
    }
    if (committed >= 5) {
      return `Dia de alta intensidade executiva com ${committed}h em compromissos. Recomendo proteger os ${free}h livres para intervalos de recuperação cognitiva e manter o foco nas entregas essenciais.`;
    }
    return `Ritmo equilibrado hoje: ${eventsCount} compromisso(s) (${committed}h) e ${free}h livres para execução. Sugiro direcionar energia para concluir as ${openTodos} tarefa(s) prioritárias antes do fim do dia.`;
  }, [todayMetrics]);

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
        keyboardShouldPersistTaps="handled"
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

            {/* Card Síntese Executiva do Vito (Exibição Direta e Proativa) */}
            <View
              style={[
                styles.bentoCard,
                styles.bentoCardSpan2,
                styles.aiDirectSynthesisCard,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <View style={styles.bentoHeader}>
                <View style={styles.synthesisHeaderBadge}>
                  <MaterialIcons name="auto-awesome" size={15} color={colors.primary} />
                  <Text style={[styles.bentoTag, { color: colors.primary }]}>SÍNTESE EXECUTIVA DO VITO</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    hapticFeedback.selection();
                    if (onOpenChatWithPrompt) {
                      onOpenChatWithPrompt('Vito, aprofunde a análise executiva do meu dia de hoje e sugira melhorias na rotina.');
                    }
                  }}
                  hitSlop={tokens.hitSlop.sm}
                  accessibilityLabel="Abrir análise no chat"
                >
                  <MaterialIcons name="chat" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.synthesisBodyText, { color: colors.onSurface }]}>
                {dailySynthesisText}
              </Text>

              <View style={[styles.synthesisFooterNote, { borderTopColor: colors.outlineVariant }]}>
                <MaterialIcons name="lightbulb-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.synthesisFooterText, { color: colors.textMuted }]}>
                  Análise gerada em tempo real sobre sua carga e pendências.
                </Text>
              </View>
            </View>
          </View>
        ) : horizon === 'weekly' ? (
          /* ==========================================
             HORIZONTE SEMANAL (4 SEMANAS COM RAIO-X)
             ========================================== */
          <View style={styles.weeklyList}>
            {weeklySummaries.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.weeklyCard,
                  {
                    backgroundColor: colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                  },
                ]}
                onPress={() => {
                  hapticFeedback.selection();
                  setSelectedWeekModal(item);
                }}
                activeOpacity={0.75}
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

                {/* Insight Narrativo da IA */}
                <View style={[styles.cardAiSnippet, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
                  <View style={styles.snippetHeaderRow}>
                    <MaterialIcons name="auto-awesome" size={13} color={colors.primary} />
                    <Text style={[styles.snippetTag, { color: colors.primary }]}>ANÁLISE DE IA</Text>
                  </View>
                  <Text style={[styles.snippetText, { color: colors.onSurface }]} numberOfLines={2}>
                    {item.narrative}
                  </Text>
                </View>

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

                <View style={[styles.cardClickHintRow, { borderTopColor: colors.outlineVariant }]}>
                  <Text style={[styles.cardClickHintText, { color: colors.primary }]}>
                    Toque para abrir Raio-X detalhado
                  </Text>
                  <MaterialIcons name="chevron-right" size={16} color={colors.primary} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          /* ==========================================
             BENTO GRID MENSAL COM RAIO-X
             ========================================== */
          <View style={styles.bentoGrid}>
            {/* Card Hero: Taxa de Conclusão */}
            <TouchableOpacity
              style={[
                styles.bentoCard,
                styles.bentoCardSpan2,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                },
              ]}
              onPress={() => {
                hapticFeedback.selection();
                setShowMonthlyModal(true);
              }}
              activeOpacity={0.8}
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

              <View style={[styles.cardClickHintRow, { borderTopColor: colors.outlineVariant }]}>
                <Text style={[styles.cardClickHintText, { color: colors.primary }]}>
                  Toque para ver Raio-X mensal completo
                </Text>
                <MaterialIcons name="chevron-right" size={16} color={colors.primary} />
              </View>
            </TouchableOpacity>

            {/* Card Análise Mensal da IA */}
            <View
              style={[
                styles.bentoCard,
                styles.bentoCardSpan2,
                styles.aiDirectSynthesisCard,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <View style={styles.bentoHeader}>
                <View style={styles.synthesisHeaderBadge}>
                  <MaterialIcons name="auto-awesome" size={15} color={colors.primary} />
                  <Text style={[styles.bentoTag, { color: colors.primary }]}>DIAGNÓSTICO MENSAL DA IA</Text>
                </View>
              </View>
              <Text style={[styles.synthesisBodyText, { color: colors.onSurface }]}>
                {monthlyMetrics.completionRate >= 70
                  ? `Desempenho executivo consistente neste mês com ${monthlyMetrics.completionRate}% de tarefas concluídas e ${monthlyMetrics.totalHours}h dedicadas. O equilíbrio está em ${monthlyMetrics.workRatio}% trabalho e ${monthlyMetrics.personalRatio}% pessoal.`
                  : `Atenção aos gargalos: taxa de conclusão de ${monthlyMetrics.completionRate}% neste mês. Recomenda-se reagendar tarefas secundárias e focar nos 3 objetivos principais de maior impacto.`}
              </Text>
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

      {/* ==========================================
          MODAL RAIO-X SEMANAL
          ========================================== */}
      <Modal
        visible={Boolean(selectedWeekModal)}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedWeekModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalContentCard,
              { backgroundColor: colors.surface, borderColor: colors.outlineVariant },
            ]}
          >
            <View style={[styles.modalHeaderRow, { borderBottomColor: colors.outlineVariant }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                  {selectedWeekModal?.period}
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                  {selectedWeekModal?.title}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedWeekModal(null)}
                hitSlop={tokens.hitSlop.md}
              >
                <MaterialIcons name="close" size={22} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              {/* Diagnóstico da IA */}
              <View
                style={[
                  styles.modalNarrativeBox,
                  {
                    backgroundColor: colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.synthesisHeaderBadge}>
                  <MaterialIcons name="auto-awesome" size={15} color={colors.primary} />
                  <Text style={[styles.bentoTag, { color: colors.primary }]}>
                    DIAGNÓSTICO EXECUTIVO DA SEMANA
                  </Text>
                </View>
                <Text style={[styles.modalNarrativeText, { color: colors.onSurface }]}>
                  {selectedWeekModal?.narrative}
                </Text>
              </View>

              {/* Distribuição por Dia e Pico */}
              <Text style={[styles.modalSectionHeading, { color: colors.onSurface }]}>
                Distribuição por Dia da Semana
              </Text>
              <View style={styles.dailyBarsRow}>
                {(selectedWeekModal?.dailyActivity || []).map((day) => (
                  <View key={day.dateStr} style={styles.dailyBarCol}>
                    <Text
                      style={[
                        styles.dailyBarVal,
                        tabularNumbers,
                        { color: day.isPeak ? colors.primary : colors.textMuted },
                      ]}
                    >
                      {day.hours}h
                    </Text>
                    <View
                      style={[
                        styles.dailyBarPill,
                        {
                          height: Math.max(14, Math.min(65, day.hours * 8)),
                          backgroundColor: day.isPeak
                            ? colors.primary
                            : colors.surfaceContainerHighest,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.dailyBarDay,
                        {
                          color: day.isPeak ? colors.primary : colors.onSurfaceVariant,
                          fontWeight: day.isPeak ? '700' : '500',
                        },
                      ]}
                    >
                      {day.dayShort}
                    </Text>
                    {day.isPeak && (
                      <Text style={[styles.peakBadge, { color: colors.primary }]}>Pico</Text>
                    )}
                  </View>
                ))}
              </View>

              {/* Categorias */}
              {(selectedWeekModal?.categories || []).length > 0 && (
                <>
                  <Text style={[styles.modalSectionHeading, { color: colors.onSurface, marginTop: 16 }]}>
                    Divisão por Categoria
                  </Text>
                  <View style={styles.categoriesList}>
                    {selectedWeekModal?.categories.map((cat) => (
                      <View key={cat.name} style={styles.categoryRow}>
                        <View style={styles.catLeft}>
                          <View style={[styles.catDot, { backgroundColor: cat.color || colors.primary }]} />
                          <Text style={[styles.catName, { color: colors.onSurface }]}>{cat.name}</Text>
                        </View>
                        <Text style={[styles.catPercent, tabularNumbers, { color: colors.textMuted }]}>
                          {cat.hours}h ({cat.percentage}%)
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* Dicas da IA */}
              {(selectedWeekModal?.tips || []).length > 0 && (
                <>
                  <Text style={[styles.modalSectionHeading, { color: colors.onSurface, marginTop: 16 }]}>
                    Recomendações Práticas do Vito
                  </Text>
                  <View style={styles.tipsList}>
                    {selectedWeekModal?.tips.map((tip, i) => (
                      <View
                        key={i}
                        style={[
                          styles.tipCard,
                          {
                            backgroundColor: colors.surfaceContainerLow,
                            borderColor: colors.outlineVariant,
                          },
                        ]}
                      >
                        <MaterialIcons name="lightbulb-outline" size={16} color={colors.primary} />
                        <Text style={[styles.tipText, { color: colors.onSurface }]}>
                          {tip.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.outlineVariant }]}>
              <TouchableOpacity
                style={[styles.modalChatButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  const p = selectedWeekModal?.period;
                  setSelectedWeekModal(null);
                  if (onOpenChatWithPrompt && p) {
                    onOpenChatWithPrompt(`Vito, vamos analisar minha semana de ${p} e ajustar o planejamento.`);
                  }
                }}
                activeOpacity={0.8}
              >
                <MaterialIcons name="chat" size={18} color={colors.onPrimary} />
                <Text style={[styles.modalChatButtonText, { color: colors.onPrimary }]}>
                  Discutir esta semana no chat com o Vito
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ==========================================
          MODAL RAIO-X MENSAL
          ========================================== */}
      <Modal
        visible={showMonthlyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMonthlyModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalContentCard,
              { backgroundColor: colors.surface, borderColor: colors.outlineVariant },
            ]}
          >
            <View style={[styles.modalHeaderRow, { borderBottomColor: colors.outlineVariant }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                  Raio-X Executivo Mensal
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                  Visão Holística de Produtividade & Equilíbrio
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowMonthlyModal(false)}
                hitSlop={tokens.hitSlop.md}
              >
                <MaterialIcons name="close" size={22} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              <View
                style={[
                  styles.modalNarrativeBox,
                  {
                    backgroundColor: colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.synthesisHeaderBadge}>
                  <MaterialIcons name="auto-awesome" size={15} color={colors.primary} />
                  <Text style={[styles.bentoTag, { color: colors.primary }]}>
                    SÍNTESE MENSAL DO ASSISTENTE
                  </Text>
                </View>
                <Text style={[styles.modalNarrativeText, { color: colors.onSurface }]}>
                  Neste ciclo você registrou {monthlyMetrics.totalHours} horas dedicadas a compromissos, mantendo taxa de resolução de tarefas em {monthlyMetrics.completionRate}%. A proporção de foco foi {monthlyMetrics.workRatio}% voltada ao trabalho e {monthlyMetrics.personalRatio}% a assuntos pessoais e descanso.
                </Text>
              </View>

              <Text style={[styles.modalSectionHeading, { color: colors.onSurface, marginTop: 16 }]}>
                Recomendações Estratégicas para o Próximo Mês
              </Text>
              <View style={styles.tipsList}>
                <View
                  style={[
                    styles.tipCard,
                    {
                      backgroundColor: colors.surfaceContainerLow,
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                >
                  <MaterialIcons name="flag" size={16} color={colors.primary} />
                  <Text style={[styles.tipText, { color: colors.onSurface }]}>
                    Defina 3 grandes metas trimestrais e concentre as tarefas da primeira semana nelas.
                  </Text>
                </View>
                <View
                  style={[
                    styles.tipCard,
                    {
                      backgroundColor: colors.surfaceContainerLow,
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                >
                  <MaterialIcons name="timer" size={16} color={colors.primary} />
                  <Text style={[styles.tipText, { color: colors.onSurface }]}>
                    Reserve ao menos 2 manhãs sem reuniões externas para trabalho focado e projetos estratégicos.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.outlineVariant }]}>
              <TouchableOpacity
                style={[styles.modalChatButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowMonthlyModal(false);
                  if (onOpenChatWithPrompt) {
                    onOpenChatWithPrompt('Vito, vamos fazer um plano executivo para o próximo mês.');
                  }
                }}
                activeOpacity={0.8}
              >
                <MaterialIcons name="chat" size={18} color={colors.onPrimary} />
                <Text style={[styles.modalChatButtonText, { color: colors.onPrimary }]}>
                  Montar plano mensal com o Vito
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: 0,
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
  aiDirectSynthesisCard: {
    padding: tokens.spacing.md,
    gap: 8,
  },
  synthesisHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  synthesisBodyText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  synthesisFooterNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  synthesisFooterText: {
    fontSize: 11,
    flex: 1,
  },
  cardAiSnippet: {
    padding: 8,
    borderRadius: MD3Shapes.small,
    marginVertical: 4,
    gap: 4,
  },
  snippetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  snippetTag: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  snippetText: {
    fontSize: 12,
    lineHeight: 16,
  },
  cardClickHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 2,
  },
  cardClickHintText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContentCard: {
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  modalScroll: {
    marginTop: 10,
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  modalNarrativeBox: {
    padding: tokens.spacing.md,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
  },
  modalNarrativeText: {
    fontSize: 14,
    lineHeight: 21,
  },
  modalSectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  dailyBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  dailyBarCol: {
    alignItems: 'center',
    gap: 4,
  },
  dailyBarVal: {
    fontSize: 10,
  },
  dailyBarPill: {
    width: 22,
    borderRadius: 6,
  },
  dailyBarDay: {
    fontSize: 11,
    marginTop: 2,
  },
  peakBadge: {
    fontSize: 9,
    fontWeight: '700',
  },
  categoriesList: {
    gap: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  catName: {
    fontSize: 13,
    fontWeight: '500',
  },
  catPercent: {
    fontSize: 12,
  },
  tipsList: {
    gap: 8,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
    borderRadius: MD3Shapes.small,
    borderWidth: 1,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  modalFooter: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  modalChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: MD3Shapes.medium,
  },
  modalChatButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
