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
  Share,
  BackHandler,
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
import { isAllDayEvent } from '../utils/calendarDateUtils';
import { BottomSheetModal } from '../components/ui/BottomSheetModal';

interface ExecutiveSummariesHubViewProps {
  onBack: () => void;
  onOpenChatWithPrompt?: (prompt: string) => void;
}

type SummaryHorizon = 'daily' | 'weekly' | 'monthly';

/**
 * Marcador visual de feriado/all-day — APENAS rotulagem.
 * Não altera nenhuma soma: a exclusão de 0h segue no calculator + memos abaixo.
 */
function isHolidayLikeEvent(e: Event): boolean {
  if (isAllDayEvent(e)) return true;
  const cat = (e.category || '').toLowerCase();
  if (cat === 'holiday' || cat === 'feriado') return true;
  try {
    const s = new Date(e.start_at).getTime();
    const end = new Date(e.end_at).getTime();
    if (end > s && (end - s) / (1000 * 60 * 60) >= 23) return true;
  } catch {}
  return false;
}

/** Índices Seg(0)..Dom(6) com feriado/all-day na semana — só para o rótulo "Feriado". */
function getHolidayDayIndices(week: WeeklySummaryItem, allEvents: Event[]): Set<number> {
  const set = new Set<number>();
  allEvents.forEach((e) => {
    if (!isHolidayLikeEvent(e)) return;
    try {
      const d = new Date(e.start_at);
      if (d >= week.weekStart && d <= week.weekEnd) {
        const jsDay = d.getDay();
        set.add(jsDay === 0 ? 6 : jsDay - 1);
      }
    } catch {}
  });
  return set;
}

function formatRaioXSubtitle(week: WeeklySummaryItem, hasHoliday: boolean): string {
  const s = week.weekStart.getDate();
  const e = week.weekEnd.getDate();
  const hoursLabel = String(week.hours).replace('.', ',');
  return `${s} a ${e} · ${hoursLabel}h reais${hasHoliday ? ' (Feriado isolado)' : ''}`;
}

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
  // Exclui all_day / FERIADO / 24h da soma de horas: isAllDay + categoria feriado + duração >= 23h.
  const todayMetrics = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayEvents = events.filter((e) => e.start_at.startsWith(todayStr));
    const todayTodos = todos.filter((t) => !t.due_date || t.due_date.startsWith(todayStr));
    const completedTodos = todayTodos.filter((t) => t.status === 'completed');

    let totalMinutes = 0;
    todayEvents.forEach((e) => {
      // Feriados e dias inteiros valem 0h de carga (não é trabalho).
      if (isAllDayEvent(e)) return;
      const s = new Date(e.start_at).getTime();
      const end = new Date(e.end_at).getTime();
      // Exclui eventos de 24h / >= 23h mesmo se o classificador falhar.
      if (end > s && (end - s) / (1000 * 60 * 60) >= 23) return;
      const cat = (e.category || '').toLowerCase();
      if (cat === 'holiday' || cat === 'feriado') return;
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
      // Feriados e dias inteiros valem 0h de carga.
      if (isAllDayEvent(e)) return;
      const s = new Date(e.start_at).getTime();
      const end = new Date(e.end_at).getTime();
      // Exclui all_day / FERIADO / 24h (>= 23h) da soma de horas.
      if (end > s && (end - s) / (1000 * 60 * 60) >= 23) return;
      const catCheck = (e.category || '').toLowerCase();
      if (catCheck === 'holiday' || catCheck === 'feriado') return;
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
      const pendentes = openTodos === 1 ? '1 tarefa pendente' : `${openTodos} tarefas pendentes`;
      return `Dia sem compromissos fixos agendados. Você possui ${pendentes} — oportunidade excelente para blocos de foco contínuo e resolução profunda de prioridades.`;
    }
    if (committed >= 5) {
      return `Dia de alta intensidade executiva com ${committed}h em compromissos. Recomendo proteger os ${free}h livres para intervalos de recuperação cognitiva e manter o foco nas entregas essenciais.`;
    }
    const compromissos = eventsCount === 1 ? '1 compromisso' : `${eventsCount} compromissos`;
    const prioritarias = openTodos === 1 ? '1 tarefa prioritária' : `${openTodos} tarefas prioritárias`;
    return `Ritmo equilibrado hoje: ${compromissos} (${committed}h) e ${free}h livres para execução. Sugiro direcionar energia para concluir as ${prioritarias} antes do fim do dia.`;
  }, [todayMetrics]);

  // Rotulagem do Raio-X selecionado (não altera cálculos — só legenda/subtítulo).
  const selectedWeekHolidays = useMemo(() => {
    if (!selectedWeekModal) return new Set<number>();
    return getHolidayDayIndices(selectedWeekModal, events);
  }, [selectedWeekModal, events]);

  const selectedWeekSubtitle = useMemo(() => {
    if (!selectedWeekModal) return '';
    return formatRaioXSubtitle(selectedWeekModal, selectedWeekHolidays.size > 0);
  }, [selectedWeekModal, selectedWeekHolidays]);

  const monthlyModalSubtitle = useMemo(() => {
    const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long' });
    return `${monthName} · ${monthlyMetrics.totalHours}h reais`;
  }, [monthlyMetrics.totalHours]);

  const monthlyTips = useMemo(
    () => [
      {
        category: 'Foco trimestral',
        text: 'Defina 3 grandes metas trimestrais e concentre as tarefas da primeira semana nelas.',
      },
      {
        category: 'Proteção de agenda',
        text: 'Reserve ao menos 2 manhãs sem reuniões externas para trabalho focado e estratégico.',
      },
      {
        category: 'Revisão semanal',
        text: 'Revise o Raio-X toda sexta e reagende o que não teve avanço para a semana seguinte.',
      },
    ],
    []
  );

  const handleShare = async () => {
    hapticFeedback.medium();
    try {
      const message = `Síntese Executiva do Vito:\n• Compromissos hoje: ${todayMetrics.eventsCount} (${todayMetrics.committedHours}h)\n• Tarefas concluídas: ${todayMetrics.completedTodos}/${todayMetrics.totalTodos}\n• Taxa de conclusão mensal: ${monthlyMetrics.completionRate}%`;
      await Share.share({ message });
    } catch {}
  };

  const openWeekInChat = () => {
    const p = selectedWeekModal?.period;
    setSelectedWeekModal(null);
    if (onOpenChatWithPrompt && p) {
      onOpenChatWithPrompt(`Vito, vamos analisar minha semana de ${p} e ajustar o planejamento.`);
    }
  };

  const openMonthInChat = () => {
    setShowMonthlyModal(false);
    if (onOpenChatWithPrompt) {
      onOpenChatWithPrompt('Vito, vamos fazer um plano executivo para o próximo mês.');
    }
  };

  const hasFreeWindow = (parseFloat(todayMetrics.freeHours) || 0) > 0;

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
                daily: 'Diário',
                weekly: 'Semanal',
                monthly: 'Mensal',
              };
              const icons: Record<SummaryHorizon, 'wb-sunny' | 'bar-chart' | 'calendar-month'> = {
                daily: 'wb-sunny',
                weekly: 'bar-chart',
                monthly: 'calendar-month',
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
                  <View style={styles.horizonTabInner}>
                    <MaterialIcons
                      name={icons[h]}
                      size={14}
                      color={isActive ? (isDark ? colors.onSurface : colors.onPrimary) : colors.onSurfaceVariant}
                    />
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
                  </View>
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
             BENTO DIÁRIO SIMPLIFICADO
             ========================================== */
          <View style={styles.bentoGrid}>
            {/* Hero: 2 números */}
            <View
              style={[
                styles.bentoCard,
                styles.bentoCardSpan2,
                {
                  backgroundColor: colors.surfaceContainer,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <View style={styles.bentoHeader}>
                <Text style={[styles.bentoTag, { color: colors.primary }]}>CARGA DO DIA</Text>
                <MaterialIcons name="schedule" size={16} color={colors.textMuted} />
              </View>

              <View style={styles.heroNumbersRow}>
                <View style={styles.heroNumberBlock}>
                  <Text style={[styles.heroBigNumber, tabularNumbers, { color: colors.onSurface }]}>
                    {todayMetrics.committedHours}h
                  </Text>
                  <Text style={[styles.heroLabel, { color: colors.textMuted }]}>
                    Comprometidas
                  </Text>
                </View>

                <View style={styles.heroDivider} />

                <View style={styles.heroNumberBlock}>
                  <Text style={[styles.heroBigNumber, tabularNumbers, { color: colors.primary }]}>
                    {todayMetrics.freeHours}h
                  </Text>
                  <Text style={[styles.heroLabel, { color: colors.textMuted }]}>
                    Blocos livres
                  </Text>
                  {hasFreeWindow && (
                    <View
                      style={[
                        styles.focusBadge,
                        { backgroundColor: colors.surfaceContainerHighest },
                      ]}
                    >
                      <MaterialIcons name="center-focus-strong" size={12} color={colors.primary} />
                      <Text style={[styles.focusBadgeText, { color: colors.primary }]}>
                        JANELA FOCO LIVRE
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Card: Agenda */}
            <View
              style={[
                styles.bentoCard,
                {
                  backgroundColor: colors.surfaceContainer,
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

            {/* Card: Tarefas */}
            <View
              style={[
                styles.bentoCard,
                {
                  backgroundColor: colors.surfaceContainer,
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

            {/* Card: Síntese executiva (leitura — CTA vive no Raio-X) */}
            <View
              style={[
                styles.bentoCard,
                styles.bentoCardSpan2,
                {
                  backgroundColor: colors.surfaceContainer,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <View style={styles.bentoHeader}>
                <View style={styles.synthesisHeaderBadge}>
                  <MaterialIcons name="auto-awesome" size={15} color={colors.primary} />
                  <Text style={[styles.bentoTag, { color: colors.primary }]}>SÍNTESE EXECUTIVA</Text>
                </View>
              </View>

              <Text style={[styles.synthesisBodyText, { color: colors.onSurface }]}>
                {dailySynthesisText}
              </Text>
            </View>
          </View>
        ) : horizon === 'weekly' ? (
          /* ==========================================
             SEMANAL SIMPLIFICADO — CICLO ATUAL + RAIO-X
             ========================================== */
          <View style={styles.weeklyList}>
            {weeklySummaries.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.weeklyCard,
                  {
                    backgroundColor: colors.surfaceContainer,
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
                    {item.isCurrentWeek ? `Ciclo Atual · ${item.period}` : item.period}
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
                    Toque para abrir o Raio-X
                  </Text>
                  <MaterialIcons name="chevron-right" size={16} color={colors.primary} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          /* ==========================================
             MENSAL SIMPLIFICADO — EFICÁCIA + DIAGNÓSTICO
             ========================================== */
          <View style={styles.bentoGrid}>
            <TouchableOpacity
              style={[
                styles.bentoCard,
                styles.bentoCardSpan2,
                {
                  backgroundColor: colors.surfaceContainer,
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
                <View style={styles.heroNumberBlock}>
                  <Text style={[styles.heroBigNumber, tabularNumbers, { color: colors.onSurface }]}>
                    {monthlyMetrics.completionRate}%
                  </Text>
                  <Text style={[styles.heroLabel, { color: colors.textMuted }]}>
                    Taxa de resolução
                  </Text>
                </View>

                <View style={styles.heroDivider} />

                <View style={styles.heroNumberBlock}>
                  <Text style={[styles.heroBigNumber, tabularNumbers, { color: colors.primary }]}>
                    {monthlyMetrics.totalHours}h
                  </Text>
                  <Text style={[styles.heroLabel, { color: colors.textMuted }]}>
                    Em compromissos
                  </Text>
                </View>
              </View>

              <View style={[styles.cardClickHintRow, { borderTopColor: colors.outlineVariant }]}>
                <Text style={[styles.cardClickHintText, { color: colors.primary }]}>
                  Toque para abrir o Raio-X
                </Text>
                <MaterialIcons name="chevron-right" size={16} color={colors.primary} />
              </View>
            </TouchableOpacity>

            <View
              style={[
                styles.bentoCard,
                styles.bentoCardSpan2,
                {
                  backgroundColor: colors.surfaceContainer,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <View style={styles.bentoHeader}>
                <View style={styles.synthesisHeaderBadge}>
                  <MaterialIcons name="auto-awesome" size={15} color={colors.primary} />
                  <Text style={[styles.bentoTag, { color: colors.primary }]}>DIAGNÓSTICO</Text>
                </View>
              </View>
              <Text style={[styles.synthesisBodyText, { color: colors.onSurface }]}>
                {monthlyMetrics.completionRate >= 70
                  ? `Desempenho consistente com ${monthlyMetrics.completionRate}% de tarefas concluídas e ${monthlyMetrics.totalHours}h dedicadas. Equilíbrio em ${monthlyMetrics.workRatio}% trabalho e ${monthlyMetrics.personalRatio}% pessoal.`
                  : `Atenção aos gargalos: conclusão de ${monthlyMetrics.completionRate}% no mês. Recomenda-se reagendar tarefas secundárias e focar nos 3 objetivos de maior impacto.`}
              </Text>
            </View>

            <View
              style={[
                styles.bentoCard,
                styles.bentoCardSpan2,
                {
                  backgroundColor: colors.surfaceContainer,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <View style={styles.bentoHeader}>
                <Text style={[styles.bentoTag, { color: colors.primary }]}>
                  TRABALHO / PESSOAL
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
                <View style={styles.balanceLegendItem}>
                  <MaterialIcons name="work-outline" size={13} color={colors.onSurface} />
                  <Text style={[styles.balanceLegendText, tabularNumbers, { color: colors.onSurface }]}>
                    Trabalho: {monthlyMetrics.workRatio}%
                  </Text>
                </View>
                <View style={styles.balanceLegendItem}>
                  <MaterialIcons name="spa" size={13} color={colors.textMuted} />
                  <Text style={[styles.balanceLegendText, tabularNumbers, { color: colors.textMuted }]}>
                    Pessoal: {monthlyMetrics.personalRatio}%
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ==========================================
          RAIO-X SEMANAL EM BOTTOM SHEET
          ========================================== */}
      <BottomSheetModal
        visible={Boolean(selectedWeekModal)}
        onClose={() => setSelectedWeekModal(null)}
        title={selectedWeekModal ? `Raio-X · ${selectedWeekModal.period}` : 'Raio-X'}
        subtitle={selectedWeekSubtitle}
      >
        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={styles.modalScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.truthBadge, { backgroundColor: colors.surfaceContainerHighest }]}>
            <MaterialIcons name="verified" size={13} color={colors.primary} />
            <Text style={[styles.truthBadgeText, { color: colors.primary }]}>
              SEM DISTORÇÃO 24H
            </Text>
          </View>

          <View
            style={[
              styles.modalNarrativeBox,
              {
                backgroundColor: colors.surfaceContainer,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <View style={styles.synthesisHeaderBadge}>
              <MaterialIcons name="auto-awesome" size={15} color={colors.primary} />
              <Text style={[styles.bentoTag, { color: colors.primary }]}>
                DIAGNÓSTICO DA SEMANA
              </Text>
            </View>
            <Text style={[styles.modalNarrativeText, { color: colors.onSurface }]}>
              {selectedWeekModal?.narrative}
            </Text>
          </View>

          <Text style={[styles.modalSectionHeading, { color: colors.onSurface }]}>
            Distribuição Seg–Dom
          </Text>
          <View style={styles.dailyBarsRow}>
            {(selectedWeekModal?.dailyActivity || []).map((day, idx) => {
              const isHoliday = selectedWeekHolidays.has(idx);
              return (
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
                    {day.dayLabel}
                  </Text>
                  {isHoliday && (
                    <Text style={[styles.holidayLabel, { color: colors.primary }]}>Feriado</Text>
                  )}
                </View>
              );
            })}
          </View>

          {(selectedWeekModal?.tips || []).length > 0 && (
            <>
              <Text style={[styles.modalSectionHeading, { color: colors.onSurface, marginTop: 16 }]}>
                Recomendações do Vito
              </Text>
              <View style={styles.tipsList}>
                {selectedWeekModal?.tips.map((tip, i) => (
                  <View
                    key={i}
                    style={[
                      styles.tipCard,
                      {
                        backgroundColor: colors.surfaceContainer,
                        borderColor: colors.outlineVariant,
                      },
                    ]}
                  >
                    <Text style={[styles.tipNumber, tabularNumbers, { color: colors.primary }]}>
                      {String(i + 1).padStart(2, '0')}
                    </Text>
                    <View style={styles.tipBody}>
                      <Text style={[styles.tipTitle, { color: colors.onSurface }]}>
                        {tip.category}
                      </Text>
                      <Text
                        style={[styles.tipText, { color: colors.onSurfaceVariant }]}
                        numberOfLines={2}
                      >
                        {tip.text}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.modalChatButton, { backgroundColor: colors.primary }]}
            onPress={openWeekInChat}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Discutir no chat"
          >
            <MaterialIcons name="chat" size={18} color={colors.onPrimary} />
            <Text style={[styles.modalChatButtonText, { color: colors.onPrimary }]}>
              Discutir no chat
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </BottomSheetModal>

      {/* ==========================================
          RAIO-X MENSAL EM BOTTOM SHEET
          ========================================== */}
      <BottomSheetModal
        visible={showMonthlyModal}
        onClose={() => setShowMonthlyModal(false)}
        title="Raio-X mensal"
        subtitle={monthlyModalSubtitle}
      >
        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={styles.modalScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.truthBadge, { backgroundColor: colors.surfaceContainerHighest }]}>
            <MaterialIcons name="verified" size={13} color={colors.primary} />
            <Text style={[styles.truthBadgeText, { color: colors.primary }]}>
              SEM DISTORÇÃO 24H
            </Text>
          </View>

          <View
            style={[
              styles.modalNarrativeBox,
              {
                backgroundColor: colors.surfaceContainer,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <View style={styles.synthesisHeaderBadge}>
              <MaterialIcons name="auto-awesome" size={15} color={colors.primary} />
              <Text style={[styles.bentoTag, { color: colors.primary }]}>
                DIAGNÓSTICO DO MÊS
              </Text>
            </View>
            <Text style={[styles.modalNarrativeText, { color: colors.onSurface }]}>
              Neste ciclo você registrou {monthlyMetrics.totalHours} horas reais em compromissos, com taxa de resolução em {monthlyMetrics.completionRate}%. Foco dividido em {monthlyMetrics.workRatio}% trabalho e {monthlyMetrics.personalRatio}% pessoal.
            </Text>
          </View>

          <Text style={[styles.modalSectionHeading, { color: colors.onSurface, marginTop: 16 }]}>
            Recomendações do Vito
          </Text>
          <View style={styles.tipsList}>
            {monthlyTips.map((tip, i) => (
              <View
                key={tip.category}
                style={[
                  styles.tipCard,
                  {
                    backgroundColor: colors.surfaceContainer,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <Text style={[styles.tipNumber, tabularNumbers, { color: colors.primary }]}>
                  {String(i + 1).padStart(2, '0')}
                </Text>
                <View style={styles.tipBody}>
                  <Text style={[styles.tipTitle, { color: colors.onSurface }]}>
                    {tip.category}
                  </Text>
                  <Text
                    style={[styles.tipText, { color: colors.onSurfaceVariant }]}
                    numberOfLines={2}
                  >
                    {tip.text}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.modalChatButton, { backgroundColor: colors.primary }]}
            onPress={openMonthInChat}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Discutir no chat"
          >
            <MaterialIcons name="chat" size={18} color={colors.onPrimary} />
            <Text style={[styles.modalChatButtonText, { color: colors.onPrimary }]}>
              Discutir no chat
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </BottomSheetModal>
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
  horizonTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    borderRadius: tokens.radii.lg,
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
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  heroNumberBlock: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  heroBigNumber: {
    fontSize: 28,
    fontWeight: '700',
  },
  heroLabel: {
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  heroDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(128,128,128,0.2)',
    marginTop: 8,
  },
  focusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: MD3Shapes.full,
    marginTop: 6,
  },
  focusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  weeklyList: {
    gap: 10,
  },
  weeklyCard: {
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    padding: tokens.spacing.md,
    gap: 8,
  },
  weeklyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  weeklyRange: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
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
  balanceLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  balanceLegendText: {
    fontSize: 12,
    fontWeight: '500',
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
  truthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: MD3Shapes.full,
    marginBottom: 10,
  },
  truthBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modalScroll: {
    marginTop: 2,
  },
  modalScrollContent: {
    paddingBottom: 16,
    gap: 2,
  },
  modalNarrativeBox: {
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.lg,
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
    flex: 1,
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
  holidayLabel: {
    fontSize: 9,
    fontWeight: '700',
  },
  tipsList: {
    gap: 8,
    marginBottom: 14,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
    borderRadius: MD3Shapes.small,
    borderWidth: 1,
  },
  tipNumber: {
    fontSize: 13,
    fontWeight: '700',
  },
  tipBody: {
    flex: 1,
    gap: 2,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  tipText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  modalChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: tokens.radii.lg,
  },
  modalChatButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
