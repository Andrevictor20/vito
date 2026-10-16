import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  Linking,
  Modal,
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
import { M3Switch } from '../ui/M3Switch';
import {
  extractReportParagraphs,
  detectPaymentAndMarketFeatures,
  buildRadarChatPrompt,
  ParsedReportData,
} from '../../utils/radarReportUtils';

interface TriggerReportsViewProps {
  trigger: Trigger;
  onBack: () => void;
  onEdit: (trigger: Trigger) => void;
  onRunNow: (id: string) => Promise<TriggerLog>;
  onToggle?: (id: string) => Promise<void>;
  onDeleteRadar?: (id: string) => Promise<void> | void;
}

type ParsedReportPayload = ParsedReportData;

export const TriggerReportsView: React.FC<TriggerReportsViewProps> = ({
  trigger,
  onBack,
  onEdit,
  onRunNow,
  onToggle,
  onDeleteRadar,
}) => {
  const { colors } = useTheme();
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
    icon: 'track-changes',
    colorLight: '#4B5563',
    colorDark: '#9CA3AF',
    bgLight: '#F3F4F6',
    bgDark: '#1F2937',
    placeholder: '',
  };

  const frequencyLabel =
    trigger.frequency === 'hourly'
      ? 'De hora em hora'
      : trigger.frequency === 'daily_morning'
      ? `Diário às ${trigger.scheduled_time || '08:30'}`
      : trigger.frequency === 'daily_evening'
      ? `Diário às ${trigger.scheduled_time || '18:00'}`
      : trigger.frequency === 'immediate'
      ? 'Em tempo real'
      : `Diário às ${trigger.scheduled_time || '08:30'}`;

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

  const handleRetry = () => {
    if (logs.length === 0 && !runningNow) {
      fetchLogs();
    } else {
      handleRunPress();
    }
  };

  const handleDeleteTriggerSelf = () => {
    if (!onDeleteRadar) return;

    const doDelete = async () => {
      try {
        await onDeleteRadar(trigger.id);
        onBack();
      } catch (err: any) {
        console.warn('[TriggerReportsView] Erro ao excluir radar:', err);
        onBack();
      }
    };

    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm(`Deseja excluir o radar "${trigger.title}" e todo o histórico?`)
          : true;
      if (confirmed) {
        doDelete();
      }
      return;
    }

    Alert.alert(
      'Excluir Radar',
      `Deseja parar de monitorar e excluir o radar "${trigger.title}" e todo o histórico?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: doDelete },
      ]
    );
  };

  const handleDeleteLog = (logId: string) => {
    const doDelete = async () => {
      setLogs((prev) => prev.filter((l) => l.id !== logId));
      setActiveCardId(null);
      try {
        await api.deleteTriggerLog(trigger.id, logId);
      } catch (err: any) {
        console.warn('[TriggerReportsView] Erro ao excluir relatório no servidor:', err);
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm && window.confirm('Deseja excluir este relatório?')) {
        doDelete();
      }
    } else {
      Alert.alert('Excluir Relatório', 'Deseja remover este relatório do histórico?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleClearLogs = () => {
    const doClear = async () => {
      setLogs([]);
      setTopMenuVisible(false);
      try {
        await api.clearTriggerLogs(trigger.id);
      } catch (err: any) {
        console.warn('[TriggerReportsView] Erro ao limpar histórico no servidor:', err);
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm && window.confirm('Deseja excluir todos os relatórios anteriores deste radar?')) {
        doClear();
      }
    } else {
      Alert.alert(
        'Limpar Histórico',
        'Deseja excluir todos os relatórios anteriores deste radar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Limpar Todos', style: 'destructive', onPress: doClear },
        ]
      );
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

  const formatRelativePt = (dateStr?: string): string => {
    if (!dateStr) return 'sem verificações ainda';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const diffMs = Date.now() - date.getTime();
      if (diffMs < 0) return formatTimestamp(dateStr);
      const minutes = Math.floor(diffMs / 60000);
      if (minutes < 1) return 'agora mesmo';
      if (minutes < 60) return `há ${minutes} min`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `há ${hours} h`;
      const days = Math.floor(hours / 24);
      if (days === 1) return 'há 1 dia';
      if (days < 7) return `há ${days} dias`;
      return formatTimestamp(dateStr);
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

  // Badge honesto: coleta que falhou nunca exibe VERIFICADO.
  // Cobre last_error != null (backend), payload.status failed e padrões de erro na mensagem.
  const isCollectionFailure = (message?: string): boolean => {
    if (!message) return false;
    return /oscila|falha|erro|tempor[aá]ria|indispon|timeout|expir/i.test(message);
  };

  const hasCollectionError = (item: TriggerLog, parsed: ParsedReportPayload | null): boolean => {
    const raw = item as unknown as Record<string, unknown>;
    const trig = trigger as unknown as Record<string, unknown>;
    if (raw?.last_error != null && String(raw.last_error).trim() !== '') return true;
    if (trig?.last_error != null && String(trig.last_error).trim() !== '') return true;
    const p = parsed as unknown as Record<string, unknown> | null;
    if (p?.last_error != null && String(p.last_error).trim() !== '') return true;
    if (parsed?.status === 'failed') return true;
    if (trigger.last_run_status === 'failed') return true;
    if (isCollectionFailure(item.message)) return true;
    if (parsed?.data && isCollectionFailure(parsed.data)) return true;
    return false;
  };


  // Primeiro fato do relatório (para resumo rápido).
  const firstNewsText = (text?: string): string => {
    const items = splitNewsItems(text);
    return (items[0] || text || '').slice(0, 220);
  };

  // Quebra o bloco corrido de notícias em mini-cards (separador " — ").
  const splitNewsItems = (text?: string): string[] => {
    if (!text) return [];
    return text
      .split(/\s+[—–-]\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  };

  const extractUrl = (text: string): string | null => {
    const m = text.match(/https?:\/\/[^\s)]+/);
    return m ? m[0].replace(/[.,;!?]+$/, '') : null;
  };

  const extractConfidence = (parsed: ParsedReportPayload | null): number | null => {
    if (!parsed) return null;
    if (typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)) {
      return Math.round(parsed.confidence);
    }
    const raw = (parsed as unknown as Record<string, unknown>).confidence;
    if (typeof raw === 'string' && /^\d{1,3}$/.test(raw.trim())) {
      return Math.round(Number(raw));
    }
    return null;
  };

  const latestLog = logs.length > 0 ? logs[0] : null;
  const latestParsed = useMemo(
    () => (latestLog ? parsePayload(latestLog.payload) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [latestLog?.id, latestLog?.payload]
  );
  const heroHasError = latestLog
    ? hasCollectionError(latestLog, latestParsed)
    : trigger.last_run_status === 'failed' ||
      ((trigger as unknown as Record<string, unknown>).last_error != null &&
        String((trigger as unknown as Record<string, unknown>).last_error).trim() !== '');
  const lastCheckSource =
    latestLog?.triggered_at || trigger.last_checked_at || trigger.updated_at || undefined;
  const lastCheckLabel = lastCheckSource
    ? `Última verificação ${formatRelativePt(lastCheckSource)}`
    : 'Nenhuma verificação ainda';

  const activeLog = activeCardId ? logs.find((l) => l.id === activeCardId) || null : null;
  const activeParsed = activeLog ? parsePayload(activeLog.payload) : null;
  const activeUrl = activeLog ? extractUrl(activeParsed?.data || activeLog.message || '') : null;

  const runCardAction = (kind: 'chat' | 'task' | 'schedule') => {
    if (!activeLog) return;
    const paras = extractReportParagraphs(activeLog.message, activeParsed);
    const content = paras.length > 0 ? paras.join('\n\n') : (activeLog.message || activeParsed?.data || '');
    const prompt = buildRadarChatPrompt(trigger.title, kind, content);

    setActiveCardId(null);
    chatPromptBus.notify(prompt);
    navigateToTab('chat');
  };

  const isActive = trigger.status === 'active';

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Topo em linha única: [← Voltar + título/meta] ...... [Switch + ⋯] */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: colors.surfaceContainerLow,
            borderBottomColor: colors.outlineVariant,
          },
        ]}
      >
        <View style={styles.topLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <MaterialIcons name="arrow-back" size={22} color={colors.onSurface} />
          </TouchableOpacity>

          <View style={styles.titleBlock}>
            <Text
              style={[styles.topTitle, { color: colors.onSurface }]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {trigger.title}
            </Text>
            <Text
              style={[styles.topMeta, { color: colors.onSurfaceVariant }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {`${categoryMeta.label} • ${frequencyLabel}`}
            </Text>
          </View>
        </View>

        <View style={styles.topRight}>
          {onToggle && (
            <View style={styles.switchHitArea}>
              <M3Switch value={isActive} onValueChange={() => { void onToggle(trigger.id); }} />
            </View>
          )}
          <TouchableOpacity
            style={[styles.moreButton, { borderColor: colors.outlineVariant }]}
            onPress={() => setTopMenuVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Opções do radar"
          >
            <MaterialIcons name="more-vert" size={22} color={colors.onSurface} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchLogs(true)}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerSection}>
            {/* Hero compacto */}
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: colors.surfaceContainer,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <View style={styles.statusRow}>
                <Text style={[styles.statusText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                  {lastCheckLabel}
                </Text>
                {heroHasError ? (
                  <View
                    style={[styles.statusBadge, { backgroundColor: colors.errorContainer }]}
                    accessibilityLabel="Falha na coleta"
                  >
                    <MaterialIcons name="warning-amber" size={13} color={colors.onErrorContainer} />
                    <Text style={[styles.statusBadgeText, { color: colors.onErrorContainer }]}>
                      Falha na coleta
                    </Text>
                  </View>
                ) : (
                  <View
                    style={[styles.statusBadge, { backgroundColor: colors.successContainer }]}
                    accessibilityLabel="Monitorando"
                  >
                    <MaterialIcons name="check" size={13} color={colors.onSuccessContainer} />
                    <Text style={[styles.statusBadgeText, { color: colors.onSuccessContainer }]}>
                      MONITORANDO
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.pillsRow}>
                <View style={[styles.pill, { backgroundColor: colors.surfaceContainerHighest }]}>
                  <MaterialIcons name={categoryMeta.icon as 'track-changes'} size={13} color={colors.onSurfaceVariant} />
                  <Text style={[styles.pillText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                    {categoryMeta.label}
                  </Text>
                </View>
                <View style={[styles.pill, { backgroundColor: colors.surfaceContainerHighest }]}>
                  <MaterialIcons name="schedule" size={13} color={colors.onSurfaceVariant} />
                  <Text style={[styles.pillText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                    {trigger.scheduled_time || frequencyLabel}
                  </Text>
                </View>
              </View>

              <Text
                style={[styles.heroQuery, { color: colors.onSurfaceVariant }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {trigger.query}
              </Text>

              <TouchableOpacity
                style={[styles.runPrimaryButton, { backgroundColor: colors.primary }, runningNow && { opacity: 0.75 }]}
                onPress={handleRunPress}
                disabled={runningNow}
                accessibilityRole="button"
                accessibilityLabel={runningNow ? 'Pesquisando notícias' : 'Verificar agora'}
              >
                {runningNow ? (
                  <>
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                    <Text style={[styles.runPrimaryButtonText, { color: colors.onPrimary }]}>
                      Pesquisando…
                    </Text>
                  </>
                ) : (
                  <>
                    <MaterialIcons name="play-arrow" size={20} color={colors.onPrimary} />
                    <Text style={[styles.runPrimaryButtonText, { color: colors.onPrimary }]}>
                      Verificar Agora
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {errorMessage && (
                <View style={[styles.errorBox, { backgroundColor: colors.errorContainer }]}>
                  <MaterialIcons name="error-outline" size={16} color={colors.error} />
                  <Text style={[styles.errorText, { color: colors.onErrorContainer }]} numberOfLines={3}>
                    {errorMessage}
                  </Text>
                  <TouchableOpacity
                    style={styles.errorRetryBtn}
                    onPress={handleRetry}
                    accessibilityRole="button"
                    accessibilityLabel="Tentar novamente"
                  >
                    <Text style={[styles.errorRetryText, { color: colors.error }]}>
                      Repetir
                    </Text>
                  </TouchableOpacity>
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
                <View style={[styles.countBadge, { backgroundColor: colors.surfaceContainerHighest }]}>
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
          const failed = hasCollectionError(item, parsed);
          const url = extractUrl(parsed?.data || item.message || '');
          const confidence = extractConfidence(parsed);
          const relative = formatRelativePt(item.triggered_at);
          const paragraphs = extractReportParagraphs(item.message, parsed);
          const why = (parsed?.why_relevant || '').trim();
          const { hasPix, hasInstallments, hasReal } = detectPaymentAndMarketFeatures(
            item.message,
            parsed?.data,
            paragraphs
          );

          return (
            <View
              style={[
                styles.reportCard,
                {
                  backgroundColor: colors.surfaceContainer,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <Text style={[styles.cardMetaText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                    {relative}
                    {confidence != null ? ` • ${confidence}% relevância` : ''}
                  </Text>
                  {failed ? (
                    <Text style={[styles.cardFailText, { color: colors.error }]} numberOfLines={1}>
                      {' • ⚠️ Falha na coleta'}
                    </Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={styles.cardMoreBtn}
                  onPress={() => setActiveCardId(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Opções do relatório de ${relative}`}
                >
                  <MaterialIcons name="more-vert" size={20} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              {/* Badges de Lojas / Pagamentos Brasil */}
              {(hasReal || hasPix || hasInstallments) && (
                <View style={styles.badgesRow}>
                  {hasPix && (
                    <View style={[styles.offerBadge, { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' }]}>
                      <MaterialIcons name="flash-on" size={13} color="#2E7D32" />
                      <Text style={[styles.offerBadgeText, { color: '#1B5E20' }]}>Pix c/ Desconto</Text>
                    </View>
                  )}
                  {hasInstallments && (
                    <View style={[styles.offerBadge, { backgroundColor: '#E3F2FD', borderColor: '#90CAF9' }]}>
                      <MaterialIcons name="credit-card" size={13} color="#1565C0" />
                      <Text style={[styles.offerBadgeText, { color: '#0D47A1' }]}>Parcelado</Text>
                    </View>
                  )}
                  {hasReal && (
                    <View style={[styles.offerBadge, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant }]}>
                      <MaterialIcons name="shopping-bag" size={13} color={colors.onSurfaceVariant} />
                      <Text style={[styles.offerBadgeText, { color: colors.onSurfaceVariant }]}>Lojas do Brasil (R$)</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Relatório Completo (2 a 3 Parágrafos) */}
              <View style={styles.paragraphsContainer}>
                {paragraphs.length > 0 ? (
                  paragraphs.map((p, pIdx) => (
                    <Text
                      key={`p-${item.id}-${pIdx}`}
                      style={[styles.paragraphText, { color: colors.onSurface }]}
                      selectable
                    >
                      {p}
                    </Text>
                  ))
                ) : (
                  <Text style={[styles.paragraphText, { color: colors.onSurface }]} selectable>
                    {item.message || 'Sem detalhes disponíveis.'}
                  </Text>
                )}
              </View>

              {why ? (
                <View style={[styles.whyContainer, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
                  <MaterialIcons name="lightbulb-outline" size={15} color={colors.primary} />
                  <Text style={[styles.whyText, { color: colors.onSurfaceVariant }]}>
                    {why}
                  </Text>
                </View>
              ) : null}

              {/* Rodapé: Acesso à Fonte e Ação Imediata de Conversa */}
              <View style={styles.cardFooterRow}>
                {url ? (
                  <TouchableOpacity
                    style={[styles.linkBtn, { borderColor: colors.outlineVariant }]}
                    onPress={() => Linking.openURL(url).catch(() => {})}
                    accessibilityRole="link"
                    accessibilityLabel="Abrir fonte original"
                  >
                    <MaterialIcons name="open-in-new" size={14} color={colors.primary} />
                    <Text style={[styles.linkBtnText, { color: colors.primary }]}>Abrir fonte</Text>
                  </TouchableOpacity>
                ) : <View />}

                <TouchableOpacity
                  style={[styles.chatActionBtn, { backgroundColor: colors.primaryContainer }]}
                  onPress={() => {
                    const paras = extractReportParagraphs(item.message, parsed);
                    const content = paras.length > 0 ? paras.join('\n\n') : (item.message || parsed?.data || '');
                    const prompt = buildRadarChatPrompt(trigger.title, 'chat', content);
                    chatPromptBus.notify(prompt);
                    navigateToTab('chat');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Conversar com Vito sobre este relatório"
                >
                  <MaterialIcons name="chat-bubble-outline" size={15} color={colors.onPrimaryContainer} />
                  <Text style={[styles.chatActionBtnText, { color: colors.onPrimaryContainer }]}>
                    Conversar com Vito
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View
              style={[
                styles.emptyStateCard,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceContainerHighest }]}>
                <MaterialIcons name="radar" size={28} color={colors.onSurfaceVariant} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                Nenhum relatório persistido ainda
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
                Toque em "Verificar Agora" acima para realizar a primeira consulta com a IA e
                gravar o primeiro relatório neste radar.
              </Text>
            </View>
          ) : null
        }
      />

      {/* Menu ⋯ do radar (BottomSheet): Editar / Limpar histórico / Excluir */}
      <Modal
        visible={topMenuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTopMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setTopMenuVisible(false)}>
          <View style={styles.sheetOverlay} />
        </TouchableWithoutFeedback>
        <View style={[styles.sheet, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.outlineVariant }]} />
          <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>Opções do radar</Text>
          <TouchableOpacity
            style={styles.sheetRow}
            onPress={() => {
              setTopMenuVisible(false);
              onEdit(trigger);
            }}
            accessibilityRole="button"
            accessibilityLabel="Editar radar"
          >
            <MaterialIcons name="edit" size={20} color={colors.onSurface} />
            <Text style={[styles.sheetRowText, { color: colors.onSurface }]}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sheetRow}
            onPress={handleClearLogs}
            accessibilityRole="button"
            accessibilityLabel="Limpar histórico"
          >
            <MaterialIcons name="delete-sweep" size={20} color={colors.onSurface} />
            <Text style={[styles.sheetRowText, { color: colors.onSurface }]}>Limpar histórico</Text>
          </TouchableOpacity>
          {onDeleteRadar && (
            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => {
                setTopMenuVisible(false);
                handleDeleteTriggerSelf();
              }}
              accessibilityRole="button"
              accessibilityLabel="Excluir radar"
            >
              <MaterialIcons name="delete-outline" size={20} color={colors.error} />
              <Text style={[styles.sheetRowText, { color: colors.error }]}>Excluir</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.sheetRow}
            onPress={() => setTopMenuVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Fechar menu"
          >
            <MaterialIcons name="close" size={20} color={colors.onSurfaceVariant} />
            <Text style={[styles.sheetRowText, { color: colors.onSurfaceVariant }]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Menu ⋯ por card: Conversar / Criar tarefa / Agendar / Abrir / Excluir */}
      <Modal
        visible={activeCardId != null}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveCardId(null)}
      >
        <TouchableWithoutFeedback onPress={() => setActiveCardId(null)}>
          <View style={styles.sheetOverlay} />
        </TouchableWithoutFeedback>
        <View style={[styles.sheet, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.outlineVariant }]} />
          <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>Ações do relatório</Text>
          <TouchableOpacity
            style={styles.sheetRow}
            onPress={() => runCardAction('chat')}
            accessibilityRole="button"
            accessibilityLabel="Conversar sobre este alerta"
          >
            <MaterialIcons name="chat" size={20} color={colors.primary} />
            <Text style={[styles.sheetRowText, { color: colors.onSurface }]}>Conversar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sheetRow}
            onPress={() => runCardAction('task')}
            accessibilityRole="button"
            accessibilityLabel="Criar tarefa a partir deste alerta"
          >
            <MaterialIcons name="add-task" size={20} color={colors.primary} />
            <Text style={[styles.sheetRowText, { color: colors.onSurface }]}>Criar tarefa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sheetRow}
            onPress={() => runCardAction('schedule')}
            accessibilityRole="button"
            accessibilityLabel="Agendar a partir deste alerta"
          >
            <MaterialIcons name="event" size={20} color={colors.primary} />
            <Text style={[styles.sheetRowText, { color: colors.onSurface }]}>Agendar</Text>
          </TouchableOpacity>
          {activeUrl ? (
            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => {
                setActiveCardId(null);
                Linking.openURL(activeUrl).catch(() => {});
              }}
              accessibilityRole="link"
              accessibilityLabel="Abrir link da notícia"
            >
              <MaterialIcons name="open-in-new" size={20} color={colors.primary} />
              <Text style={[styles.sheetRowText, { color: colors.onSurface }]}>Abrir link</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.sheetRow}
            onPress={() => {
              if (activeCardId) handleDeleteLog(activeCardId);
            }}
            accessibilityRole="button"
            accessibilityLabel="Excluir relatório"
          >
            <MaterialIcons name="delete-outline" size={20} color={colors.error} />
            <Text style={[styles.sheetRowText, { color: colors.error }]}>Excluir relatório</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sheetRow}
            onPress={() => setActiveCardId(null)}
            accessibilityRole="button"
            accessibilityLabel="Fechar menu"
          >
            <MaterialIcons name="close" size={20} color={colors.onSurfaceVariant} />
            <Text style={[styles.sheetRowText, { color: colors.onSurfaceVariant }]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
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
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 64,
  },
  topLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: tokens.spacing.sm,
  },
  backButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -12,
  },
  titleBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
    lineHeight: 21,
  },
  topMeta: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  switchHitArea: {
    minHeight: 48,
    justifyContent: 'center',
  },
  moreButton: {
    width: 48,
    height: 48,
    borderRadius: tokens.radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  headerSection: {
    gap: tokens.spacing.lg,
    marginBottom: tokens.spacing.xs,
  },
  heroCard: {
    padding: tokens.spacing.lg,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    gap: tokens.spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.radii.full,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.radii.full,
    maxWidth: '100%',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroQuery: {
    fontSize: 13,
    lineHeight: 19,
  },
  runPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
    minHeight: 48,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radii.full,
  },
  runPrimaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    gap: tokens.spacing.sm,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  errorRetryBtn: {
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.md,
  },
  errorRetryText: {
    fontSize: 13,
    fontWeight: '800',
  },
  historySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.xs,
    marginTop: tokens.spacing.sm,
    minHeight: 32,
  },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
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
    borderRadius: tokens.radii.full,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  reportCard: {
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    gap: tokens.spacing.xs,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
  },
  cardMetaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardFailText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardMoreBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  offerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radii.full,
    borderWidth: 1,
  },
  offerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  paragraphsContainer: {
    gap: 8,
    marginVertical: 4,
  },
  paragraphText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
  },
  whyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: 8,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 4,
  },
  whyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150,150,150,0.2)',
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
  },
  linkBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chatActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: tokens.radii.full,
  },
  chatActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyStateCard: {
    padding: 30,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.md,
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.xs,
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
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: tokens.radii.lg,
    borderTopRightRadius: tokens.radii.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.xl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: tokens.spacing.sm,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: tokens.spacing.sm,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    minHeight: 48,
    paddingVertical: tokens.spacing.sm,
  },
  sheetRowText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
