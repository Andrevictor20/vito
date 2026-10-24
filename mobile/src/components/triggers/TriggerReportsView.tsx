import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  RefreshControl,
  Alert,
  Platform,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { Trigger, TriggerLog, TRIGGER_CATEGORIES } from '../../types';
import { api } from '../../services/api';
import { chatPromptBus } from '../../services/dataSync';
import { navigateToTab } from '../../navigation/navigationRef';
import {
  ParsedReportData,
  buildRadarChatPrompt,
  extractRadarBullets,
} from '../../utils/radarReportUtils';
import { computeSubViewBottomPadding } from '../../utils/keyboardHeight';
import { VitoSwitch } from '../ui/VitoSwitch';
import { TriggerReportsHeader } from './TriggerReportsHeader';
import { TriggerReportCard } from './TriggerReportCard';

interface TriggerReportsViewProps {
  trigger: Trigger;
  onBack: () => void;
  onEdit: (trigger: Trigger) => void;
  onRunNow: (id: string) => Promise<TriggerLog>;
  onToggle?: (id: string) => Promise<void>;
  onDeleteRadar?: (id: string) => Promise<void> | void;
}

export const TriggerReportsView: React.FC<TriggerReportsViewProps> = ({
  trigger,
  onBack,
  onRunNow,
  onToggle,
  onDeleteRadar,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [logs, setLogs] = useState<TriggerLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [topMenuVisible, setTopMenuVisible] = useState(false);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const isActive = trigger.status === 'active';

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

  const categoryMeta = useMemo(() => {
    return TRIGGER_CATEGORIES.find((c) => c.id === trigger.category) || {
      id: trigger.category,
      label: 'Geral',
      icon: 'tune' as const,
      colorLight: colors.blue,
      colorDark: colors.blue,
      bgLight: colors.blueBg,
      bgDark: 'rgba(43, 127, 212, 0.18)',
      placeholder: '',
    };
  }, [trigger.category, colors]);

  const categoryColor = isDark ? categoryMeta.colorDark : categoryMeta.colorLight;
  const categoryBg = isDark ? categoryMeta.bgDark : categoryMeta.bgLight;

  const frequencyLabel = useMemo(() => {
    if (trigger.scheduled_time) {
      return `Diário às ${trigger.scheduled_time}`;
    }
    switch (trigger.frequency) {
      case 'hourly':
        return 'De hora em hora';
      case 'daily_evening':
        return 'Diário às 18:00';
      case 'immediate':
        return 'Em tempo real';
      case 'daily_morning':
      default:
        return 'Diário às 08:30';
    }
  }, [trigger.frequency, trigger.scheduled_time]);

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

  const parsePayload = (payloadStr?: string): ParsedReportData | null => {
    if (!payloadStr) return null;
    try {
      return JSON.parse(payloadStr);
    } catch {
      return null;
    }
  };

  const latestLog = logs.length > 0 ? logs[0] : null;
  const lastCheckSource = latestLog?.triggered_at || trigger.last_checked_at;
  const lastCheckLabel = lastCheckSource
    ? 'Última checagem hoje'
    : 'Nenhuma checagem recente';

  const handleAction = (
    kind: 'chat' | 'task' | 'schedule',
    log: TriggerLog,
    parsed: ParsedReportData | null
  ) => {
    const bullets = extractRadarBullets(log.message, parsed);
    const content = bullets.length > 0 ? bullets.join('\n') : (log.message || '');
    const prompt = buildRadarChatPrompt(trigger.title, kind, content);

    setActiveCardId(null);
    chatPromptBus.notify(prompt);
    navigateToTab('chat');
  };

  const handleDeleteLog = (logId: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== logId));
    setActiveCardId(null);
    api.deleteTriggerLog(trigger.id, logId).catch(() => {});
  };

  const handleClearLogs = async () => {
    setLogs([]);
    setTopMenuVisible(false);
    await api.clearTriggerLogs(trigger.id).catch(() => {});
  };

  const handleDeleteTriggerSelf = () => {
    setTopMenuVisible(false);
    if (!onDeleteRadar) return;

    const doDelete = async () => {
      try {
        await onDeleteRadar(trigger.id);
        onBack();
      } catch {
        onBack();
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Deseja excluir a vigília "${trigger.title}"?`)) {
        doDelete();
      }
      return;
    }

    Alert.alert(
      'Excluir Vigília',
      `Deseja parar de monitorar e excluir a vigília "${trigger.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: doDelete },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.page }]}>
      {/* 1. Top Bar Pinned com Botões Circulares e Safe-Area */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: colors.bg,
            borderBottomColor: colors.line,
            paddingTop: Math.max(insets.top, 12),
          },
        ]}
      >
        <View style={styles.topBarContent}>
          <TouchableOpacity
            style={[styles.circleButton, { backgroundColor: colors.surf, borderColor: colors.line }]}
            onPress={onBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <MaterialIcons name="arrow-back" size={20} color={colors.ink} />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text
              style={[
                styles.topTitle,
                { color: colors.ink, fontFamily: tokens.typography.family.semibold },
              ]}
              numberOfLines={1}
            >
              {trigger.title}
            </Text>
            <View style={styles.metaRow}>
              <View style={[styles.categoryBadge, { backgroundColor: categoryBg }]}>
                <Text style={[styles.categoryBadgeText, { color: categoryColor }]}>
                  {categoryMeta.label}
                </Text>
              </View>
              <Text style={[styles.frequencyText, { color: colors.muted }]} numberOfLines={1}>
                {frequencyLabel}
              </Text>
            </View>
          </View>

          <View style={styles.topRightActions}>
            {onToggle && (
              <VitoSwitch value={isActive} onValueChange={() => onToggle(trigger.id)} />
            )}
            <TouchableOpacity
              style={[styles.circleButton, { backgroundColor: colors.surf, borderColor: colors.line }]}
              onPress={() => setTopMenuVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Opções da vigília"
            >
              <MaterialIcons name="more-vert" size={20} color={colors.ink} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 2. FlatList com Header e Cards Fluidos */}
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: computeSubViewBottomPadding(insets.bottom, 120) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchLogs(true)}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <TriggerReportsHeader
            trigger={trigger}
            categoryMeta={categoryMeta}
            categoryColor={categoryColor}
            categoryBg={categoryBg}
            frequencyLabel={frequencyLabel}
            lastCheckLabel={lastCheckLabel}
            runningNow={runningNow}
            errorMessage={errorMessage}
            logsCount={logs.length}
            loading={loading}
            refreshing={refreshing}
            onRunNow={handleRunPress}
            onRetry={handleRunPress}
          />
        }
        renderItem={({ item }) => {
          const parsed = parsePayload(item.payload);
          return (
            <TriggerReportCard
              log={item}
              parsed={parsed}
              categoryColor={categoryColor}
              categoryBg={categoryBg}
              onOpenMenu={(id) => setActiveCardId(id)}
              onAction={handleAction}
            />
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.bg, borderColor: colors.line }]}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.surf }]}>
                <MaterialIcons name="radar" size={32} color={colors.muted} />
              </View>
              <Text
                style={[
                  styles.emptyTitle,
                  { color: colors.ink, fontFamily: tokens.typography.family.semibold },
                ]}
              >
                Nenhum relatório gerado ainda
              </Text>
              <Text style={[styles.emptySub, { color: colors.muted }]}>
                Toque em "Verificar Agora" acima para realizar a primeira varredura em tempo real.
              </Text>
            </View>
          ) : null
        }
      />

      {/* 3. Modal de Opções Gerais da Vigília */}
      <Modal visible={topMenuVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setTopMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.menuSheet, { backgroundColor: colors.bg, borderColor: colors.line }]}>
              <TouchableOpacity style={styles.menuItem} onPress={handleClearLogs}>
                <MaterialIcons name="delete-sweep" size={20} color={colors.ink} />
                <Text style={[styles.menuItemText, { color: colors.ink }]}>Limpar histórico</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={handleDeleteTriggerSelf}>
                <MaterialIcons name="delete-outline" size={20} color={colors.red || '#d6355a'} />
                <Text style={[styles.menuItemText, { color: colors.red || '#d6355a' }]}>Excluir vigília</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 4. Modal de Opções do Relatório Específico */}
      <Modal visible={activeCardId !== null} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setActiveCardId(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.menuSheet, { backgroundColor: colors.bg, borderColor: colors.line }]}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  if (activeCardId) handleDeleteLog(activeCardId);
                }}
              >
                <MaterialIcons name="delete-outline" size={20} color={colors.red || '#d6355a'} />
                <Text style={[styles.menuItemText, { color: colors.red || '#d6355a' }]}>
                  Excluir este relatório
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 16,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  frequencyText: {
    fontSize: 11.5,
    flexShrink: 1,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 8,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 15.5,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  menuSheet: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 10,
    shadowColor: 'rgba(0,0,0,0.18)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  menuItemText: {
    fontSize: 14.5,
    fontWeight: '600',
  },
});
