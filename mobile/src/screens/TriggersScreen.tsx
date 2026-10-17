import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Keyboard,
  BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useTriggers } from '../hooks/useTriggers';
import { TriggerCard } from '../components/triggers/TriggerCard';
import { TriggerReportsView } from '../components/triggers/TriggerReportsView';
import { RadarFilterButton } from '../components/triggers/RadarFilterButton';
import { EditTriggerModal } from '../components/triggers/EditTriggerModal';
import { CreateTriggerModal } from '../components/triggers/CreateTriggerModal';
import { TRIGGER_CATEGORIES, Trigger } from '../types';
import { countTriggersByCategory } from '../utils/radarFilter';
import { api } from '../services/api';

export const TriggersScreen: React.FC<{ onSubViewChange?: (inSubView: boolean) => void; createRequestId?: number }> = ({ onSubViewChange, createRequestId }) => {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const {
    triggers,
    allTriggers,
    loading,
    refreshing,
    onRefresh,
    selectedCategory,
    setSelectedCategory,
    handleCreateTrigger,
    handleToggleTrigger,
    handleDeleteTrigger,
    handleUpdateTrigger,
    handleRunTrigger,
  } = useTriggers(user?.id);

  // Modais e navegação
  const [reportTrigger, setReportTrigger] = useState<Trigger | null>(null);
  const [editTrigger, setEditTrigger] = useState<Trigger | null>(null);
  // CTA do Header (+ Novo): abre o modal de criação.
  const [createVisible, setCreateVisible] = useState<boolean>(false);
  const firstCreateRender = useRef(false);

  // Sub-view ativa (relatório): o Header global oculta o título.
  useEffect(() => {
    onSubViewChange?.(!!reportTrigger);
  }, [reportTrigger, onSubViewChange]);

  // CTA do Header (+ Novo): abre o modal de criação (decisão a).
  useEffect(() => {
    if (!firstCreateRender.current) {
      firstCreateRender.current = true;
      return;
    }
    if ((createRequestId ?? 0) > 0) {
      setCreateVisible(true);
    }
  }, [createRequestId]);

  // Intercepta gesto de voltar no Android para retornar à tela anterior sem fechar o app
  useEffect(() => {
    const onBackPress = () => {
      if (createVisible) {
        setCreateVisible(false);
        return true;
      }
      if (reportTrigger) {
        setReportTrigger(null);
        return true;
      }
      if (editTrigger) {
        setEditTrigger(null);
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [createVisible, reportTrigger, editTrigger]);

  // Entrada em Linguagem Natural
  const [naturalPrompt, setNaturalPrompt] = useState('');
  const [isSubmittingPrompt, setIsSubmittingPrompt] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);

  // Contagens vivas por categoria (funil).
  const categoryCounts = useMemo(
    () => countTriggersByCategory(allTriggers),
    [allTriggers]
  );
  const selectedCategoryLabel =
    selectedCategory === 'all'
      ? null
      : TRIGGER_CATEGORIES.find((c) => c.id === selectedCategory)?.label ?? selectedCategory;

  // Divisão em Ativos e Pausados para evitar rolagem infinita
  const activeTriggers = useMemo(
    () => triggers.filter((t) => t.status === 'active'),
    [triggers]
  );
  const pausedTriggers = useMemo(
    () => triggers.filter((t) => t.status !== 'active'),
    [triggers]
  );
  const [showPaused, setShowPaused] = useState(false);

  const handleCreateFromNaturalPrompt = async () => {
    const trimmed = naturalPrompt.trim();
    if (!trimmed) return;

    setIsSubmittingPrompt(true);
    setPromptError(null);
    Keyboard.dismiss();

    try {
      const parsed = await api.parseTriggerPrompt(trimmed);
      const parsedCondition = parsed.condition_type;
      await handleCreateTrigger({
        title: parsed.suggested_title || trimmed,
        category: parsed.category,
        query: trimmed,
        condition_type:
          parsedCondition === 'price_above' ||
          parsedCondition === 'price_below' ||
          parsedCondition === 'event_upcoming' ||
          parsedCondition === 'change_detected'
            ? parsedCondition
            : 'daily_brief',
        frequency: 'daily_morning',
      });
      setNaturalPrompt('');
    } catch (err: any) {
      console.error('[TriggersScreen] Erro ao criar disparador:', err);
      setPromptError(err?.message || 'Falha ao interpretar pedido. Tente novamente.');
    } finally {
      setIsSubmittingPrompt(false);
    }
  };

  if (reportTrigger) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <TriggerReportsView
          trigger={reportTrigger}
          onBack={() => setReportTrigger(null)}
          onEdit={(t) => {
            setEditTrigger(t);
          }}
          onRunNow={handleRunTrigger}
          onToggle={async (id) => {
            await handleToggleTrigger(id);
            setReportTrigger((prev) =>
              prev && prev.id === id
                ? {
                    ...prev,
                    status: prev.status === 'active' ? 'paused' : 'active',
                  }
                : prev
            );
          }}
          onDeleteRadar={async (id) => {
            await handleDeleteTrigger(id);
            setReportTrigger(null);
          }}
        />

        {/* Modal de Edição sobre a página dedicada de relatórios */}
        <EditTriggerModal
          visible={editTrigger !== null}
          trigger={editTrigger}
          onClose={() => setEditTrigger(null)}
          onDelete={async (id) => {
            await handleDeleteTrigger(id);
            setReportTrigger(null);
          }}
          onSave={async (id, updates) => {
            const updated = await handleUpdateTrigger(id, updates);
            if (reportTrigger && reportTrigger.id === id) {
              setReportTrigger(updated);
            }
          }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* 1. Criação por Linguagem Natural + funil (padrão Agenda) */}
      <View style={styles.inputSection}>
        <View style={styles.inputRow}>
          <View
            style={[
              styles.inputCard,
              {
                backgroundColor: isDark ? colors.surfaceContainerLow : '#FFFFFF',
                borderColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.08)',
              },
            ]}
          >
            <MaterialIcons name="auto-awesome" size={20} color={colors.primary} />
            <TextInput
              style={[styles.naturalInput, { color: colors.onSurface }]}
              value={naturalPrompt}
              onChangeText={setNaturalPrompt}
              placeholder="No que quer ficar de olho?"
              placeholderTextColor={colors.onSurfaceVariant}
              onSubmitEditing={handleCreateFromNaturalPrompt}
              returnKeyType="send"
              editable={!isSubmittingPrompt}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: colors.primary },
                (!naturalPrompt.trim() || isSubmittingPrompt) && { opacity: 0.5 },
              ]}
              onPress={handleCreateFromNaturalPrompt}
              disabled={!naturalPrompt.trim() || isSubmittingPrompt}
            >
              {isSubmittingPrompt ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <MaterialIcons name="arrow-forward" size={16} color={colors.onPrimary} />
              )}
            </TouchableOpacity>
          </View>
          <RadarFilterButton
            selected={selectedCategory}
            onChange={setSelectedCategory}
            counts={categoryCounts}
            total={allTriggers.length}
            resultCount={triggers.length}
          />
        </View>
        {!!promptError && <Text style={styles.inputErrorText}>{promptError}</Text>}
        {!!selectedCategoryLabel && (
          <View style={styles.activeFilterRow}>
            <Text style={[styles.activeFilterText, { color: colors.textMuted }]}>
              {selectedCategoryLabel} · {triggers.length} {triggers.length === 1 ? 'radar' : 'radares'}
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedCategory('all')}
              hitSlop={tokens.hitSlop.sm}
              accessibilityLabel="Limpar filtro de categoria"
              accessibilityRole="button"
            >
              <Text style={[styles.activeFilterClear, { color: colors.primary }]}>Limpar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 4. Lista Minimalista de Disparadores */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>
            Atualizando seus radares...
          </Text>
        </View>
      ) : (
        <FlatList
          data={activeTriggers}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.id}
          ListHeaderComponent={null}
          renderItem={({ item }) => (
            <TriggerCard
              trigger={item}
              onToggle={handleToggleTrigger}
              onPress={(t) => setReportTrigger(t)}
            />
          )}
          ListFooterComponent={
            pausedTriggers.length > 0 ? (
              <View style={styles.pausedSectionWrapper}>
                <TouchableOpacity
                  style={[
                    styles.pausedSectionToggle,
                    {
                      backgroundColor: isDark ? colors.surfaceContainerLow : '#F4F4F5',
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                  onPress={() => setShowPaused(!showPaused)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Alternar visualização de radares pausados"
                >
                  <View style={styles.pausedToggleLeft}>
                    <MaterialIcons
                      name="pause-circle-outline"
                      size={16}
                      color={colors.onSurfaceVariant}
                    />
                    <Text style={[styles.pausedToggleText, { color: colors.onSurfaceVariant }]}>
                      Pausados ({pausedTriggers.length})
                    </Text>
                  </View>
                  <MaterialIcons
                    name={showPaused ? 'expand-less' : 'expand-more'}
                    size={20}
                    color={colors.onSurfaceVariant}
                  />
                </TouchableOpacity>

                {showPaused && (
                  <View style={styles.pausedListWrapper}>
                    {pausedTriggers.map((item) => (
                      <TriggerCard
                        key={item.id}
                        trigger={item}
                        onToggle={handleToggleTrigger}
                        onPress={(t) => setReportTrigger(t)}
                      />
                    ))}
                  </View>
                )}
              </View>
            ) : null
          }
          contentContainerStyle={[
            styles.listContent,
            triggers.length === 0 && styles.listEmptyContent,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            pausedTriggers.length === 0 ? (
              <View style={styles.emptyState}>
                <View
                  style={[
                    styles.emptyIconCircle,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    },
                  ]}
                >
                  <MaterialIcons
                    name="radar"
                    size={32}
                    color={isDark ? '#71717A' : '#9CA3AF'}
                  />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                  {selectedCategory === 'all'
                    ? 'Nenhum radar ativo por enquanto'
                    : 'Nenhum radar nesta categoria'}
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
                  Digite acima o que você quer acompanhar ou peça pro Vito no chat.
                </Text>
              </View>
            ) : (
              <View style={styles.noActiveNote}>
                <Text style={[styles.noActiveNoteText, { color: colors.onSurfaceVariant }]}>
                  Nenhum radar ativo no momento. Veja os pausados abaixo.
                </Text>
              </View>
            )
          }
        />
      )}

      {/* Modal de Edição */}
      <EditTriggerModal
        visible={editTrigger !== null}
        trigger={editTrigger}
        onClose={() => setEditTrigger(null)}
        onDelete={handleDeleteTrigger}
        onSave={async (id, updates) => {
          await handleUpdateTrigger(id, updates);
        }}
      />

      {/* Modal de Criação (+ Novo no Header) */}
      <CreateTriggerModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onSubmit={async (input) => {
          await handleCreateTrigger(input);
          setCreateVisible(false);
        }}
      />

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inputSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 6,
  },
  activeFilterText: {
    fontSize: 12,
    fontWeight: '500',
  },
  activeFilterClear: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: MD3Shapes.largeIncreased,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
  },
  naturalInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputErrorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  pausedSectionWrapper: {
    marginTop: 12,
    marginBottom: 8,
  },
  pausedSectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
  },
  pausedToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pausedToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pausedListWrapper: {
    marginTop: 8,
  },
  noActiveNote: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noActiveNoteText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  listEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 8,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
});
