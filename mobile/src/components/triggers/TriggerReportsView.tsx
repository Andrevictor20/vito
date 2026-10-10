import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { Trigger, TriggerLog, TRIGGER_CATEGORIES } from '../../types';
import { api } from '../../services/api';

interface TriggerReportsViewProps {
  trigger: Trigger;
  onBack: () => void;
  onEdit: (trigger: Trigger) => void;
  onRunNow: (id: string) => Promise<TriggerLog>;
  onToggle?: (id: string) => Promise<void>;
}

interface ParsedReportPayload {
  status?: string;
  condition_met?: boolean;
  data?: string;
  simulated_notification?: string;
  tested_at?: string;
}

export const TriggerReportsView: React.FC<TriggerReportsViewProps> = ({
  trigger,
  onBack,
  onEdit,
  onRunNow,
  onToggle,
}) => {
  const { colors, isDark } = useTheme();

  const [logs, setLogs] = useState<TriggerLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchLogs = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMessage(null);
    try {
      const data = await api.getTriggerLogs(trigger.id);
      setLogs(data);
    } catch (err: any) {
      console.error('[TriggerReportsView] Erro ao carregar logs:', err);
      setErrorMessage(err?.message || 'Falha ao buscar histórico de relatórios.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [trigger.id]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const categoryMeta = TRIGGER_CATEGORIES.find((c) => c.id === trigger.category) || {
    id: trigger.category,
    label: 'Geral',
    icon: 'track-changes',
    colorLight: '#4B5563',
    colorDark: '#9CA3AF',
    bgLight: '#F3F4F6',
    bgDark: '#1F2937',
    placeholder: '',
  };

  const catColor = isDark ? categoryMeta.colorDark : categoryMeta.colorLight;

  const handleRunPress = async () => {
    setRunningNow(true);
    setErrorMessage(null);
    try {
      const newLog = await onRunNow(trigger.id);
      setLogs((prev) => [newLog, ...prev]);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao executar verificação imediata.');
    } finally {
      setRunningNow(false);
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const today = new Date();
      const isToday =
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();

      const timePart = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      if (isToday) {
        return `Hoje às ${timePart}`;
      }
      return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${timePart}`;
    } catch {
      return dateStr;
    }
  };

  const parsePayload = (payloadStr?: string): ParsedReportPayload | null => {
    if (!payloadStr) return null;
    try {
      return JSON.parse(payloadStr);
    } catch {
      return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Top Bar da Página Dedicada */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: isDark ? colors.surfaceContainerLow : '#FFFFFF',
            borderBottomColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.06)',
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="arrow-back" size={22} color={colors.onSurface} />
          <Text style={[styles.backButtonText, { color: colors.onSurface }]}>Vigílias</Text>
        </TouchableOpacity>

        <View style={styles.topBarActions}>
          {onToggle && (
            <TouchableOpacity
              style={[
                styles.statusPill,
                {
                  backgroundColor:
                    trigger.status === 'active'
                      ? isDark
                        ? 'rgba(16, 185, 129, 0.15)'
                        : '#DCFCE7'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(0, 0, 0, 0.05)',
                },
              ]}
              onPress={() => onToggle(trigger.id)}
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      trigger.status === 'active' ? colors.success : colors.textMuted,
                  },
                ]}
              />
              <Text
                style={[
                  styles.statusPillText,
                  {
                    color:
                      trigger.status === 'active'
                        ? isDark
                          ? '#6EE7B7'
                          : '#047857'
                        : colors.textMuted,
                  },
                ]}
              >
                {trigger.status === 'active' ? 'Ativo' : 'Pausado'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.editIconButton,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
              },
            ]}
            onPress={() => onEdit(trigger)}
          >
            <MaterialIcons name="edit" size={18} color={colors.onSurface} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchLogs(true)}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerSection}>
            {/* Hero Card Dedicado do Disparador */}
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: isDark ? colors.surfaceContainer : '#FFFFFF',
                  borderColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.06)',
                },
              ]}
            >
              <View style={styles.categoryBadgeRow}>
                <View
                  style={[
                    styles.categoryTag,
                    {
                      backgroundColor: isDark ? categoryMeta.bgDark : categoryMeta.bgLight,
                    },
                  ]}
                >
                  <MaterialIcons name={categoryMeta.icon as any} size={14} color={catColor} />
                  <Text style={[styles.categoryTagText, { color: catColor }]}>
                    {categoryMeta.label}
                  </Text>
                </View>

                {trigger.scheduled_time ? (
                  <View
                    style={[
                      styles.metaPill,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.06)'
                          : 'rgba(0, 0, 0, 0.04)',
                      },
                    ]}
                  >
                    <MaterialIcons name="schedule" size={13} color={colors.onSurfaceVariant} />
                    <Text style={[styles.metaPillText, { color: colors.onSurfaceVariant }]}>
                      {trigger.scheduled_time}
                    </Text>
                  </View>
                ) : null}

                <View
                  style={[
                    styles.metaPill,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(0, 0, 0, 0.04)',
                    },
                  ]}
                >
                  <MaterialIcons name="repeat" size={13} color={colors.onSurfaceVariant} />
                  <Text style={[styles.metaPillText, { color: colors.onSurfaceVariant }]}>
                    {trigger.frequency === 'hourly'
                      ? 'De hora em hora'
                      : trigger.frequency === 'daily_morning'
                      ? 'Diário (Manhã)'
                      : trigger.frequency === 'daily_evening'
                      ? 'Diário (Noite)'
                      : 'Alerta frequente'}
                  </Text>
                </View>
              </View>

              <Text style={[styles.heroTitle, { color: colors.onSurface }]}>{trigger.title}</Text>
              <Text style={[styles.heroQuery, { color: colors.onSurfaceVariant }]}>
                {trigger.query}
              </Text>

              {/* Botão Único de Verificação Imediata */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[
                    styles.runPrimaryButton,
                    { backgroundColor: colors.primary },
                    runningNow && { opacity: 0.75 },
                  ]}
                  onPress={handleRunPress}
                  disabled={runningNow}
                >
                  {runningNow ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.runPrimaryButtonText}>Pesquisando e avaliando...</Text>
                    </>
                  ) : (
                    <>
                      <MaterialIcons name="play-arrow" size={20} color="#FFFFFF" />
                      <Text style={styles.runPrimaryButtonText}>Verificar Agora</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {errorMessage && (
                <View style={styles.errorBox}>
                  <MaterialIcons name="error-outline" size={16} color="#EF4444" />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}
            </View>

            {/* Cabeçalho da Lista de Histórico */}
            <View style={styles.historySectionHeader}>
              <View style={styles.historyTitleRow}>
                <MaterialIcons name="history" size={18} color={colors.onSurfaceVariant} />
                <Text style={[styles.historyTitle, { color: colors.onSurface }]}>
                  Histórico de Relatórios
                </Text>
                <View
                  style={[
                    styles.countBadge,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.05)',
                    },
                  ]}
                >
                  <Text style={[styles.countBadgeText, { color: colors.onSurfaceVariant }]}>
                    {logs.length}
                  </Text>
                </View>
              </View>

              {loading && !refreshing && (
                <ActivityIndicator size="small" color={colors.primary} />
              )}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const parsed = parsePayload(item.payload);
          const hasCondition = parsed && typeof parsed.condition_met === 'boolean';
          const conditionMet = parsed?.condition_met;

          return (
            <View
              style={[
                styles.reportCard,
                {
                  backgroundColor: isDark ? colors.surfaceContainer : '#FFFFFF',
                  borderColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.06)',
                },
              ]}
            >
              {/* Header do Card de Relatório */}
              <View style={styles.reportCardHeader}>
                <View style={styles.reportTimeRow}>
                  <MaterialIcons name="access-time" size={14} color={colors.onSurfaceVariant} />
                  <Text style={[styles.reportDateText, { color: colors.onSurfaceVariant }]}>
                    {formatTimestamp(item.triggered_at)}
                  </Text>
                </View>

                {hasCondition ? (
                  <View
                    style={[
                      styles.conditionBadge,
                      {
                        backgroundColor: conditionMet
                          ? isDark
                            ? 'rgba(239, 68, 68, 0.2)'
                            : '#FEE2E2'
                          : isDark
                          ? 'rgba(16, 185, 129, 0.2)'
                          : '#DCFCE7',
                      },
                    ]}
                  >
                    <MaterialIcons
                      name={conditionMet ? 'notifications-active' : 'check-circle'}
                      size={13}
                      color={conditionMet ? '#EF4444' : '#10B981'}
                    />
                    <Text
                      style={[
                        styles.conditionBadgeText,
                        {
                          color: conditionMet
                            ? isDark
                              ? '#FCA5A5'
                              : '#B91C1C'
                            : isDark
                            ? '#6EE7B7'
                            : '#047857',
                        },
                      ]}
                    >
                      {conditionMet ? 'CONDIÇÃO ATENDIDA' : 'CONDIÇÃO NÃO ATENDIDA'}
                    </Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.conditionBadge,
                      {
                        backgroundColor: isDark
                          ? 'rgba(59, 130, 246, 0.15)'
                          : '#EFF6FF',
                      },
                    ]}
                  >
                    <MaterialIcons name="check" size={13} color="#3B82F6" />
                    <Text style={[styles.conditionBadgeText, { color: '#3B82F6' }]}>
                      VERIFICADO
                    </Text>
                  </View>
                )}
              </View>

              {/* Dados Factual da Web se disponível */}
              {parsed?.data ? (
                <View
                  style={[
                    styles.webDataBox,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.03)'
                        : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(0, 0, 0, 0.05)',
                    },
                  ]}
                >
                  <MaterialIcons name="travel-explore" size={15} color={colors.primary} />
                  <Text style={[styles.webDataText, { color: colors.onSurface }]}>
                    {parsed.data}
                  </Text>
                </View>
              ) : null}

              {/* Mensagem / Resumo Executivo da IA */}
              <Text style={[styles.reportMessage, { color: colors.onSurface }]}>
                {item.message}
              </Text>

              {/* Prévia da Notificação se houver */}
              {parsed?.simulated_notification ? (
                <View
                  style={[
                    styles.notificationPreviewBox,
                    {
                      backgroundColor: isDark
                        ? 'rgba(0, 0, 0, 0.25)'
                        : '#F8FAFC',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.06)',
                    },
                  ]}
                >
                  <View style={styles.notifHeader}>
                    <MaterialIcons name="radar" size={13} color={colors.primary} />
                    <Text style={[styles.notifAppTitle, { color: colors.primary }]}>
                      Vito · Notificação
                    </Text>
                  </View>
                  <Text style={[styles.notifBody, { color: colors.onSurfaceVariant }]}>
                    {parsed.simulated_notification}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View
              style={[
                styles.emptyStateCard,
                {
                  backgroundColor: isDark ? colors.surfaceContainerLow : '#FFFFFF',
                  borderColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.06)',
                },
              ]}
            >
              <View
                style={[
                  styles.emptyIconCircle,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(0, 0, 0, 0.03)',
                  },
                ]}
              >
                <MaterialIcons name="radar" size={28} color={colors.onSurfaceVariant} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                Nenhum relatório persistido ainda
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
                Toque em "Verificar Agora" acima para realizar a primeira consulta com a IA e
                gravar o primeiro relatório neste disparador.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: MD3Shapes.full,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  editIconButton: {
    width: 34,
    height: 34,
    borderRadius: MD3Shapes.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  headerSection: {
    gap: 16,
    marginBottom: 4,
  },
  heroCard: {
    padding: 18,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    gap: 12,
  },
  categoryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: MD3Shapes.full,
  },
  categoryTagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: MD3Shapes.full,
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  heroQuery: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionRow: {
    marginTop: 4,
  },
  runPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: MD3Shapes.full,
  },
  runPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 10,
    borderRadius: MD3Shapes.medium,
    gap: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  historySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 6,
  },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: MD3Shapes.full,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  reportCard: {
    padding: 16,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    gap: 10,
  },
  reportCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  reportDateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  conditionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: MD3Shapes.full,
  },
  conditionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  webDataBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
  },
  webDataText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    flex: 1,
  },
  reportMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  notificationPreviewBox: {
    padding: 10,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    gap: 4,
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  notifAppTitle: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notifBody: {
    fontSize: 12,
    lineHeight: 16,
  },
  emptyStateCard: {
    padding: 30,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 300,
  },
});
