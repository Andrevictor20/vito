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
    icon: 'tune',
    colorLight: colors.blue,
    colorDark: colors.blue,
    bgLight: colors.blueBg,
    bgDark: 'rgba(43, 127, 212, 0.18)',
    placeholder: '',
  };

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
    ? `Última verificação hoje`
    : 'Nenhuma checagem realizada ainda';

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
      `Deseja parar de monitorar e excluir o radar "${trigger.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: doDelete },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.page }]}>
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
            onBack={onBack}
            onRunNow={handleRunPress}
            onRetry={handleRunPress}
            onToggle={onToggle ? () => onToggle(trigger.id) : undefined}
            onOpenTopMenu={() => setTopMenuVisible(true)}
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
            <View style={styles.emptyContainer}>
              <MaterialIcons name="radar" size={40} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.ink }]}>
                Nenhum relatório gerado ainda
              </Text>
              <Text style={[styles.emptySub, { color: colors.muted }]}>
                Toque em "Verificar Agora" acima para realizar a primeira varredura em tempo real.
              </Text>
            </View>
          ) : null
        }
      />

      {/* Modal Superior de Opções do Radar */}
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

      {/* Modal de Opções do Card de Log */}
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
                <Text style={[styles.menuItemText, { color: colors.red || '#d6355a' }]}>Excluir este relatório</Text>
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  menuSheet: {
    width: '85%',
    maxWidth: 300,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 8,
    shadowColor: 'rgba(0,0,0,0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
