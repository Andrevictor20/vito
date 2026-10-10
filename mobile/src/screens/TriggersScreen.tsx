import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Keyboard,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useTriggers } from '../hooks/useTriggers';
import { TriggerCard } from '../components/triggers/TriggerCard';
import { TriggerReportsView } from '../components/triggers/TriggerReportsView';
import { WeeklySummariesView } from '../components/triggers/WeeklySummariesView';
import { EditTriggerModal } from '../components/triggers/EditTriggerModal';
import { TRIGGER_CATEGORIES, Trigger, TriggerCategory } from '../types';
import { api } from '../services/api';

export const TriggersScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
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
    stats,
  } = useTriggers();

  // Modais e navegação
  const [reportTrigger, setReportTrigger] = useState<Trigger | null>(null);
  const [editTrigger, setEditTrigger] = useState<Trigger | null>(null);
  const [showWeeklySummaries, setShowWeeklySummaries] = useState<boolean>(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState<boolean>(false);

  // Entrada em Linguagem Natural
  const [naturalPrompt, setNaturalPrompt] = useState('');
  const [isSubmittingPrompt, setIsSubmittingPrompt] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);

  // Categorias ativas com pelo menos 1 disparador
  const activeCategories = useMemo(() => {
    const presentCats = new Set(allTriggers.map((t) => t.category));
    return TRIGGER_CATEGORIES.filter((c) => presentCats.has(c.id));
  }, [allTriggers]);

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
      await handleCreateTrigger({
        title: parsed.suggested_title || trimmed,
        category: parsed.category,
        query: trimmed,
        condition_type: (parsed.condition_type as any) || 'daily_brief',
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

  if (showWeeklySummaries) {
    return <WeeklySummariesView onBack={() => setShowWeeklySummaries(false)} />;
  }

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
        />

        {/* Modal de Edição sobre a página dedicada de relatórios */}
        <EditTriggerModal
          visible={editTrigger !== null}
          trigger={editTrigger}
          onClose={() => setEditTrigger(null)}
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
      {/* 1. Header Minimalista */}
      <View style={styles.minimalHeader}>
        <View style={styles.titleArea}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>
            Radares do Vito
          </Text>
          <View
            style={[
              styles.activeBadge,
              { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5' },
            ]}
          >
            <View style={[styles.activeDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.activeBadgeText, { color: '#10B981' }]}>
              {stats.active} {stats.active === 1 ? 'ativo' : 'ativos'}
            </Text>
          </View>
        </View>
        <Text style={[styles.headerSubtitle, { color: colors.onSurfaceVariant }]}>
          O Vito fica de olho na internet por você e avisa na hora certa.
        </Text>
      </View>

      {/* 2. Barra de Criação por Linguagem Natural */}
      <View style={styles.inputSection}>
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
            placeholder="No que quer ficar de olho? Ex: Dólar, voos, eleições..."
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
        {promptError && <Text style={styles.inputErrorText}>{promptError}</Text>}
      </View>

      {/* 3. Seletor de Categoria Inteligente (Sem Rolagem Infinita) */}
      {activeCategories.length > 0 && (
        <View style={styles.filterBar}>
          <TouchableOpacity
            style={[
              styles.categoryPickerBtn,
              {
                backgroundColor: selectedCategory !== 'all'
                  ? (isDark ? colors.surfaceContainerHighest : colors.primary)
                  : (isDark ? colors.surfaceContainerLow : '#F4F4F5'),
                borderColor: colors.outlineVariant,
              },
            ]}
            onPress={() => setShowCategoryPicker(true)}
            activeOpacity={0.7}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel="Filtrar por categoria"
          >
            <MaterialIcons
              name="filter-list"
              size={16}
              color={selectedCategory !== 'all' ? (isDark ? colors.onSurface : colors.onPrimary) : colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.categoryPickerText,
                {
                  color: selectedCategory !== 'all' ? (isDark ? colors.onSurface : colors.onPrimary) : colors.onSurface,
                  fontWeight: selectedCategory !== 'all' ? '700' : '500',
                },
              ]}
            >
              {selectedCategory === 'all'
                ? `Todas as categorias (${allTriggers.length})`
                : `${activeCategories.find((c) => c.id === selectedCategory)?.label || selectedCategory} (${allTriggers.filter((t) => t.category === selectedCategory).length})`}
            </Text>
            <MaterialIcons
              name="arrow-drop-down"
              size={18}
              color={selectedCategory !== 'all' ? (isDark ? colors.onSurface : colors.onPrimary) : colors.onSurfaceVariant}
            />
          </TouchableOpacity>

          {selectedCategory !== 'all' && (
            <TouchableOpacity
              style={[styles.clearFilterBtn, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant }]}
              onPress={() => setSelectedCategory('all')}
              hitSlop={tokens.hitSlop.sm}
            >
              <Text style={[styles.clearFilterText, { color: colors.primary }]}>Limpar</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

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
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            selectedCategory === 'all' ? (
              <View
                style={[
                  styles.systemRadarCard,
                  {
                    backgroundColor: isDark ? colors.surfaceContainer : colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.systemRadarHeader}>
                  <View style={styles.systemRadarBadgeRow}>
                    <View style={[styles.systemCategoryBadge, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#E0F2FE' }]}>
                      <MaterialIcons name="auto-awesome" size={13} color={colors.accents.sky} />
                      <Text style={[styles.systemCategoryText, { color: colors.accents.sky }]}>
                        RADAR DO VITO
                      </Text>
                    </View>
                    <View style={[styles.systemTimePill, { backgroundColor: colors.surfaceContainerHighest }]}>
                      <MaterialIcons name="schedule" size={12} color={colors.onSurfaceVariant} />
                      <Text style={[styles.systemTimeText, { color: colors.onSurfaceVariant }]}>
                        Semanal aos domingos
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.systemStatusDot, { backgroundColor: '#10B981' }]} />
                </View>

                <Text style={[styles.systemRadarTitle, { color: colors.onSurface }]}>
                  Resumo Semanal & Otimização de Tempo
                </Text>
                <Text style={[styles.systemRadarDesc, { color: colors.onSurfaceVariant }]}>
                  O Vito analisa seu ritmo semanal e sugere estratégias práticas para otimizar suas horas.
                </Text>

                <TouchableOpacity
                  style={[styles.systemRadarActionBtn, { borderTopColor: colors.outlineVariant }]}
                  onPress={() => setShowWeeklySummaries(true)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="insights" size={16} color={colors.primary} />
                  <Text style={[styles.systemRadarActionText, { color: colors.primary }]}>
                    Ver resumos e dicas da IA
                  </Text>
                  <MaterialIcons name="chevron-right" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TriggerCard
              trigger={item}
              onToggle={handleToggleTrigger}
              onEdit={(t) => setEditTrigger(t)}
              onDelete={handleDeleteTrigger}
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
                        onEdit={(t) => setEditTrigger(t)}
                        onDelete={handleDeleteTrigger}
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
        onSave={async (id, updates) => {
          await handleUpdateTrigger(id, updates);
        }}
      />

      {/* Modal do Seletor de Categorias Inteligente */}
      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowCategoryPicker(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.categoryPickerModal,
                  {
                    backgroundColor: isDark ? colors.surfaceContainer : colors.surface,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.categoryModalHeader}>
                  <Text style={[styles.categoryModalTitle, { color: colors.onSurface }]}>
                    Filtrar por Categoria
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowCategoryPicker(false)}
                    hitSlop={tokens.hitSlop.sm}
                    style={styles.categoryModalCloseBtn}
                    accessibilityLabel="Fechar seletor"
                  >
                    <MaterialIcons name="close" size={20} color={colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>

                {/* Opção: Todas as categorias */}
                <TouchableOpacity
                  style={[
                    styles.categoryOptionItem,
                    selectedCategory === 'all' && [
                      styles.categoryOptionItemActive,
                      { backgroundColor: isDark ? colors.surfaceContainerHigh : colors.primaryContainer },
                    ],
                  ]}
                  onPress={() => {
                    setSelectedCategory('all');
                    setShowCategoryPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.categoryOptionLeft}>
                    <View
                      style={[
                        styles.categoryOptionIconWrap,
                        { backgroundColor: isDark ? colors.surfaceContainerHighest : '#E4E4E7' },
                      ]}
                    >
                      <MaterialIcons name="apps" size={18} color={colors.onSurface} />
                    </View>
                    <Text
                      style={[
                        styles.categoryOptionLabel,
                        {
                          color: colors.onSurface,
                          fontWeight: selectedCategory === 'all' ? '700' : '500',
                        },
                      ]}
                    >
                      Todas as categorias
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.categoryOptionBadge,
                      { backgroundColor: isDark ? colors.surfaceContainerHighest : '#F4F4F5' },
                    ]}
                  >
                    <Text style={[styles.categoryOptionBadgeText, { color: colors.onSurfaceVariant }]}>
                      {allTriggers.length}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Lista das Categorias Ativas */}
                {activeCategories.map((c) => {
                  const count = allTriggers.filter((t) => t.category === c.id).length;
                  const isSelected = selectedCategory === c.id;
                  const catColor = isDark ? c.colorDark : c.colorLight;
                  const catBg = isDark ? c.bgDark : c.bgLight;

                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.categoryOptionItem,
                        isSelected && [
                          styles.categoryOptionItemActive,
                          { backgroundColor: isDark ? colors.surfaceContainerHigh : colors.primaryContainer },
                        ],
                      ]}
                      onPress={() => {
                        setSelectedCategory(c.id);
                        setShowCategoryPicker(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.categoryOptionLeft}>
                        <View style={[styles.categoryOptionIconWrap, { backgroundColor: catBg }]}>
                          <MaterialIcons name={c.icon as any} size={18} color={catColor} />
                        </View>
                        <Text
                          style={[
                            styles.categoryOptionLabel,
                            {
                              color: colors.onSurface,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {c.label}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.categoryOptionBadge,
                          { backgroundColor: isDark ? colors.surfaceContainerHighest : '#F4F4F5' },
                        ]}
                      >
                        <Text style={[styles.categoryOptionBadgeText, { color: colors.onSurfaceVariant }]}>
                          {count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </TouchableWithoutFeedback>
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
  minimalHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  titleArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: MD3Shapes.full,
    gap: 5,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
  },
  inputSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputCard: {
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
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  categoryPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
    gap: 6,
  },
  categoryPickerText: {
    fontSize: 13,
  },
  clearFilterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  systemRadarCard: {
    borderRadius: MD3Shapes.largeIncreased,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  systemRadarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  systemRadarBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  systemCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: MD3Shapes.full,
  },
  systemCategoryText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  systemTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: MD3Shapes.full,
  },
  systemTimeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  systemStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  systemRadarTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  systemRadarDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  systemRadarActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  systemRadarActionText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginLeft: 6,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  categoryPickerModal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: MD3Shapes.extraLarge,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  categoryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  categoryModalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  categoryModalCloseBtn: {
    padding: 4,
  },
  categoryOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: MD3Shapes.medium,
    marginBottom: 6,
  },
  categoryOptionItemActive: {
    borderRadius: MD3Shapes.medium,
  },
  categoryOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryOptionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryOptionLabel: {
    fontSize: 14,
  },
  categoryOptionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: MD3Shapes.full,
  },
  categoryOptionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
