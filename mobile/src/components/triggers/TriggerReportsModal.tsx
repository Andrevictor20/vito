import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { Trigger, TriggerLog, TriggerTestResult, TRIGGER_CATEGORIES } from '../../types';
import { api } from '../../services/api';

interface TriggerReportsModalProps {
  visible: boolean;
  trigger: Trigger | null;
  onClose: () => void;
  onEdit: (trigger: Trigger) => void;
  onRunNow: (id: string) => Promise<TriggerLog>;
  onTestNow?: (id: string) => Promise<TriggerTestResult>;
}

export const TriggerReportsModal: React.FC<TriggerReportsModalProps> = ({
  visible,
  trigger,
  onClose,
  onEdit,
  onRunNow,
  onTestNow,
}) => {
  const { colors, isDark } = useTheme();

  const [logs, setLogs] = useState<TriggerLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [testingNow, setTestingNow] = useState(false);
  const [testResult, setTestResult] = useState<TriggerTestResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchLogs = useCallback(async (isRefresh = false) => {
    if (!trigger) return;
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
      console.error('[TriggerReportsModal] Erro ao buscar logs:', err);
      setErrorMessage(err?.message || 'Falha ao carregar relatórios.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [trigger]);

  useEffect(() => {
    if (visible && trigger) {
      fetchLogs();
    }
  }, [visible, trigger, fetchLogs]);

  if (!trigger) return null;

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

  const handleTestPress = async () => {
    if (!trigger) return;
    setTestingNow(true);
    setErrorMessage(null);
    try {
      const res = onTestNow
        ? await onTestNow(trigger.id)
        : await api.testTrigger(trigger.id);
      setTestResult(res);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao testar disparador.');
    } finally {
      setTestingNow(false);
    }
  };

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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View
          style={[
            styles.container,
            {
              backgroundColor: isDark ? colors.surfaceContainer : '#FFFFFF',
              borderColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleArea}>
              <View style={styles.categoryRow}>
                <MaterialIcons name={categoryMeta.icon as any} size={16} color={catColor} />
                <Text style={[styles.categoryLabel, { color: catColor }]}>
                  {categoryMeta.label}
                </Text>
                {trigger.scheduled_time ? (
                  <View
                    style={[
                      styles.scheduleBadge,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                      },
                    ]}
                  >
                    <MaterialIcons name="schedule" size={13} color={colors.onSurfaceVariant} />
                    <Text style={[styles.scheduleBadgeText, { color: colors.onSurfaceVariant }]}>
                      {trigger.scheduled_time}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.title, { color: colors.onSurface }]}>{trigger.title}</Text>
              <Text
                style={[styles.queryText, { color: colors.onSurfaceVariant }]}
                numberOfLines={2}
              >
                {trigger.query}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Fechar modal de relatórios"
            >
              <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          {/* Action Bar (Testar Agora, Executar & Editar) */}
          <View
            style={[
              styles.actionBar,
              {
                borderBottomColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.06)',
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.testButton,
                { backgroundColor: colors.primary },
                testingNow && { opacity: 0.7 },
              ]}
              onPress={handleTestPress}
              disabled={testingNow || runningNow}
            >
              {testingNow ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="science" size={18} color="#FFFFFF" />
                  <Text style={styles.testButtonText}>Testar Agora</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.runButton,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                },
                runningNow && { opacity: 0.7 },
              ]}
              onPress={handleRunPress}
              disabled={testingNow || runningNow}
            >
              {runningNow ? (
                <ActivityIndicator size="small" color={colors.onSurface} />
              ) : (
                <>
                  <MaterialIcons name="play-arrow" size={16} color={colors.onSurface} />
                  <Text style={[styles.runButtonText, { color: colors.onSurface }]}>Executar</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.editButton,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                },
              ]}
              onPress={() => {
                onClose();
                onEdit(trigger);
              }}
            >
              <MaterialIcons name="edit" size={16} color={colors.onSurface} />
              <Text style={[styles.editButtonText, { color: colors.onSurface }]}>Editar</Text>
            </TouchableOpacity>
          </View>

          {/* Card de Resultado do Teste / Simulação ao Vivo */}
          {testResult && (
            <View
              style={[
                styles.testResultCard,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                  borderColor: testResult.condition_met
                    ? (isDark ? '#F87171' : '#EF4444')
                    : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
                },
              ]}
            >
              <View style={styles.testResultHeader}>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: testResult.condition_met
                        ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2')
                        : (isDark ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7'),
                    },
                  ]}
                >
                  <MaterialIcons
                    name={testResult.condition_met ? 'notifications-active' : 'check-circle'}
                    size={14}
                    color={testResult.condition_met ? '#EF4444' : '#10B981'}
                  />
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: testResult.condition_met ? (isDark ? '#FCA5A5' : '#B91C1C') : (isDark ? '#6EE7B7' : '#047857') },
                    ]}
                  >
                    {testResult.condition_met ? 'CONDIÇÃO ATENDIDA' : 'CONDIÇÃO NÃO ATENDIDA'}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setTestResult(null)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <MaterialIcons name="close" size={16} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              {testResult.current_data ? (
                <View style={styles.testSectionRow}>
                  <MaterialIcons name="travel-explore" size={15} color={colors.primary} />
                  <Text style={[styles.testDataText, { color: colors.onSurface }]}>
                    {testResult.current_data}
                  </Text>
                </View>
              ) : null}

              <Text style={[styles.testSummaryText, { color: colors.onSurfaceVariant }]}>
                {testResult.summary}
              </Text>

              {testResult.simulated_notification ? (
                <View
                  style={[
                    styles.pushPreviewBox,
                    {
                      backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#FFFFFF',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    },
                  ]}
                >
                  <View style={styles.pushPreviewHeader}>
                    <MaterialIcons name="radar" size={13} color={colors.primary} />
                    <Text style={[styles.pushPreviewAppTitle, { color: colors.primary }]}>
                      Vito · Notificação Simulada
                    </Text>
                  </View>
                  <Text style={[styles.pushPreviewBody, { color: colors.onSurface }]}>
                    {testResult.simulated_notification}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {errorMessage && (
            <View style={styles.errorBox}>
              <MaterialIcons name="error-outline" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Feed de Relatórios */}
          <View style={styles.feedWrapper}>
            <Text style={[styles.feedHeaderTitle, { color: colors.onSurfaceVariant }]}>
              Histórico de Relatórios ({logs.length})
            </Text>

            {loading && !refreshing ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>
                  Carregando relatórios...
                </Text>
              </View>
            ) : (
              <FlatList
                data={logs}
                keyExtractor={(item) => item.id}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => fetchLogs(true)}
                    tintColor={colors.primary}
                  />
                }
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.logCard,
                      {
                        backgroundColor: isDark ? colors.surfaceContainerHigh : '#F9FAFB',
                        borderColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.06)',
                      },
                    ]}
                  >
                    <View style={styles.logCardHeader}>
                      <View style={styles.logCardTimeRow}>
                        <MaterialIcons name="event-note" size={14} color={colors.primary} />
                        <Text style={[styles.logTimeText, { color: colors.onSurfaceVariant }]}>
                          {formatTimestamp(item.triggered_at)}
                        </Text>
                      </View>
                      <View style={styles.logStatusBadge}>
                        <View style={[styles.logStatusDot, { backgroundColor: '#10B981' }]} />
                        <Text style={styles.logStatusText}>Concluído</Text>
                      </View>
                    </View>

                    <Text style={[styles.logMessage, { color: colors.onSurface }]}>
                      {item.message}
                    </Text>
                  </View>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <View
                      style={[
                        styles.emptyIconCircle,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        },
                      ]}
                    >
                      <MaterialIcons name="history" size={28} color={colors.onSurfaceVariant} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                      Nenhum relatório gerado ainda
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
                      Clique em "Verificar Agora" acima para realizar a primeira consulta sob
                      demanda.
                    </Text>
                  </View>
                }
                contentContainerStyle={[
                  styles.listContent,
                  logs.length === 0 && styles.listEmptyContent,
                ]}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  container: {
    width: '100%',
    maxWidth: 560,
    height: '84%',
    borderRadius: MD3Shapes.extraLarge,
    borderWidth: 1,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  headerTitleArea: {
    flex: 1,
    paddingRight: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scheduleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: MD3Shapes.full,
    gap: 4,
    marginLeft: 6,
  },
  scheduleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  queryText: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  runButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: MD3Shapes.full,
  },
  runButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: MD3Shapes.full,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 10,
    borderRadius: MD3Shapes.medium,
    marginTop: 8,
    gap: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  feedWrapper: {
    flex: 1,
    marginTop: 12,
  },
  feedHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
  },
  listContent: {
    paddingBottom: 16,
    gap: 10,
  },
  listEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  logCard: {
    borderRadius: MD3Shapes.largeIncreased,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  logCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logCardTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logTimeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  logStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: MD3Shapes.full,
    gap: 4,
  },
  logStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  logStatusText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
  },
  logMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
    maxWidth: 320,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: MD3Shapes.full,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  testResultCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    gap: 10,
  },
  testResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: MD3Shapes.full,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  testSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  testDataText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  testSummaryText: {
    fontSize: 13,
    lineHeight: 18,
  },
  pushPreviewBox: {
    padding: 10,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    gap: 4,
  },
  pushPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pushPreviewAppTitle: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pushPreviewBody: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
});
