import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes, tabularNumbers } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../theme/motion';
import { api } from '../services/api';
import { PendingItem, PendingStatus } from '../types';

interface PendingItemsViewProps {
  onBack: () => void;
  onOpenEventCreate?: (title: string, date?: string) => void;
}

const CATEGORIES = [
  { id: 'todas', label: 'Todas' },
  { id: 'trabalho', label: 'Trabalho' },
  { id: 'financas', label: 'Finanças' },
  { id: 'estudos', label: 'Estudos' },
  { id: 'saude', label: 'Saúde' },
  { id: 'pessoal', label: 'Pessoal' },
  { id: 'geral', label: 'Geral' },
];

export const PendingItemsView: React.FC<PendingItemsViewProps> = ({
  onBack,
  onOpenEventCreate,
}) => {
  const { colors, isDark } = useTheme();

  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<PendingStatus>('inbox');
  const [selectedCategory, setSelectedCategory] = useState('todas');

  // Input rápido de criação
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('geral');
  const [isCreating, setIsCreating] = useState(false);

  // Modal de Agendamento Rápido
  const [scheduleModalItem, setScheduleModalItem] = useState<PendingItem | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getPendingItems();
      setItems(data || []);
    } catch (err) {
      console.warn('[PendingItemsView] Erro ao carregar pendências:', err);
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

  // Contagens por aba
  const counts = useMemo(() => {
    return {
      inbox: items.filter((i) => i.status === 'inbox').length,
      scheduled: items.filter((i) => i.status === 'scheduled').length,
      done: items.filter((i) => i.status === 'done').length,
    };
  }, [items]);

  // Filtragem
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (item.status !== activeTab) return false;
      if (selectedCategory !== 'todas' && item.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [items, activeTab, selectedCategory]);

  const handleTabChange = (tab: PendingStatus) => {
    hapticFeedback.selection();
    setActiveTab(tab);
  };

  const handleCreate = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed || isCreating) return;

    setIsCreating(true);
    hapticFeedback.medium();
    try {
      const created = await api.createPendingItem({
        title: trimmed,
        category: newCategory,
      });
      setItems((prev) => [created, ...prev]);
      setNewTitle('');
      hapticFeedback.success();
    } catch (err) {
      console.warn('[PendingItemsView] Falha ao criar pendência:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleComplete = async (item: PendingItem) => {
    hapticFeedback.medium();
    try {
      if (item.status === 'done') {
        // Reabre para inbox
        const updated = await api.updatePendingItem(item.id, { status: 'inbox' });
        setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      } else {
        const completed = await api.completePendingItem(item.id);
        setItems((prev) => prev.map((i) => (i.id === item.id ? completed : i)));
        hapticFeedback.success();
      }
    } catch (err) {
      console.warn('[PendingItemsView] Falha ao alternar conclusão:', err);
    }
  };

  const handleDelete = async (id: string) => {
    hapticFeedback.light();
    try {
      await api.deletePendingItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.warn('[PendingItemsView] Falha ao excluir item:', err);
    }
  };

  const handleQuickSchedule = async (item: PendingItem, dateStr: string) => {
    hapticFeedback.medium();
    try {
      const scheduled = await api.schedulePendingItem(item.id, dateStr);
      setItems((prev) => prev.map((i) => (i.id === item.id ? scheduled : i)));
      setScheduleModalItem(null);
      hapticFeedback.success();
      if (onOpenEventCreate) {
        onOpenEventCreate(item.title, dateStr);
      }
    } catch (err) {
      console.warn('[PendingItemsView] Falha ao agendar pendência:', err);
    }
  };

  const getTodayISO = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  };

  const getTomorrowISO = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* TopBar Executiva */}
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
          <Text style={[styles.topBarTitle, { color: colors.onSurface }]}>
            Incubadora de Pendências
          </Text>
          <Text style={[styles.topBarSubtitle, { color: colors.textMuted }]}>
            {counts.inbox} {counts.inbox === 1 ? 'item para incubar' : 'itens para incubar'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => {
            hapticFeedback.selection();
            loadData();
          }}
          hitSlop={tokens.hitSlop.md}
        >
          <MaterialIcons name="refresh" size={20} color={colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Input de Criação Rápida */}
        <View
          style={[
            styles.createCard,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <View style={styles.createInputRow}>
            <TextInput
              style={[styles.input, { color: colors.onSurface }]}
              placeholder="O que você precisa incubar para depois?"
              placeholderTextColor={colors.textMuted}
              value={newTitle}
              onChangeText={setNewTitle}
              onSubmitEditing={handleCreate}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[
                styles.createBtn,
                {
                  backgroundColor: newTitle.trim() ? colors.primary : colors.surfaceContainerHighest,
                  opacity: isCreating ? 0.6 : 1,
                },
              ]}
              onPress={handleCreate}
              disabled={!newTitle.trim() || isCreating}
            >
              {isCreating ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <MaterialIcons
                  name="add"
                  size={20}
                  color={newTitle.trim() ? colors.onPrimary : colors.onSurfaceVariant}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Seletor Segmentado de Abas */}
        <View style={styles.segmentContainer}>
          <View
            style={[
              styles.segmentPill,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            {(['inbox', 'scheduled', 'done'] as PendingStatus[]).map((tab) => {
              const isActive = activeTab === tab;
              const count = counts[tab];
              const labels: Record<PendingStatus, string> = {
                inbox: 'Inbox',
                scheduled: 'Agendadas',
                done: 'Concluídas',
              };

              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.segmentTab,
                    isActive && [
                      styles.segmentTabActive,
                      { backgroundColor: isDark ? colors.surfaceContainerHighest : colors.primary },
                    ],
                  ]}
                  onPress={() => handleTabChange(tab)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.segmentLabel,
                      {
                        color: isActive
                          ? isDark
                            ? colors.onSurface
                            : colors.onPrimary
                          : colors.onSurfaceVariant,
                      },
                    ]}
                  >
                    {labels[tab]}
                  </Text>
                  <Text
                    style={[
                      styles.segmentBadge,
                      tabularNumbers,
                      {
                        color: isActive
                          ? isDark
                            ? colors.onSurface
                            : colors.onPrimary
                          : colors.textMuted,
                      },
                    ]}
                  >
                    {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Chips de Categoria */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryChips}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? colors.surfaceContainerHighest
                        : colors.primary
                      : colors.surfaceContainerLow,
                    borderColor: isSelected ? 'transparent' : colors.outlineVariant,
                  },
                ]}
                onPress={() => {
                  hapticFeedback.selection();
                  setSelectedCategory(cat.id);
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected
                        ? isDark
                          ? colors.onSurface
                          : colors.onPrimary
                        : colors.onSurfaceVariant,
                      fontWeight: isSelected ? '600' : '400',
                    },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Lista de Itens */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="all-inbox" size={40} color={colors.outline} />
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
              {activeTab === 'inbox'
                ? 'Nenhuma pendência na caixa de entrada'
                : activeTab === 'scheduled'
                ? 'Nenhuma pendência agendada'
                : 'Nenhuma pendência concluída'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              {activeTab === 'inbox'
                ? 'Use o campo acima para guardar itens que não possuem data imediata.'
                : 'Itens com datas definidas ou finalizados aparecerão aqui.'}
            </Text>
          </View>
        ) : (
          <View style={styles.itemsList}>
            {filteredItems.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.itemCard,
                  {
                    backgroundColor: colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                {/* Botão de Checkbox */}
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    {
                      borderColor: item.status === 'done' ? colors.success : colors.outline,
                      backgroundColor: item.status === 'done' ? colors.success : 'transparent',
                    },
                  ]}
                  onPress={() => handleToggleComplete(item)}
                  hitSlop={tokens.hitSlop.sm}
                >
                  {item.status === 'done' && (
                    <MaterialIcons name="check" size={14} color="#FFFFFF" />
                  )}
                </TouchableOpacity>

                {/* Conteúdo Central */}
                <View style={styles.itemContent}>
                  <Text
                    style={[
                      styles.itemTitle,
                      {
                        color: item.status === 'done' ? colors.textMuted : colors.onSurface,
                        textDecorationLine: item.status === 'done' ? 'line-through' : 'none',
                      },
                    ]}
                  >
                    {item.title}
                  </Text>
                  {item.description ? (
                    <Text style={[styles.itemDescription, { color: colors.textMuted }]}>
                      {item.description}
                    </Text>
                  ) : null}

                  <View style={styles.itemMetaRow}>
                    <View
                      style={[
                        styles.categoryBadge,
                        { backgroundColor: colors.surfaceContainerHighest },
                      ]}
                    >
                      <Text style={[styles.categoryBadgeText, { color: colors.onSurfaceVariant }]}>
                        {item.category}
                      </Text>
                    </View>

                    {item.scheduled_date ? (
                      <View style={styles.scheduledBadge}>
                        <MaterialIcons name="event" size={12} color={colors.primary} />
                        <Text style={[styles.scheduledBadgeText, tabularNumbers, { color: colors.primary }]}>
                          {item.scheduled_date}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Ações da Direita */}
                <View style={styles.itemActions}>
                  {item.status !== 'done' && (
                    <TouchableOpacity
                      style={[styles.scheduleBtn, { backgroundColor: colors.surfaceContainerHighest }]}
                      onPress={() => {
                        hapticFeedback.selection();
                        setScheduleModalItem(item);
                      }}
                      hitSlop={tokens.hitSlop.sm}
                    >
                      <MaterialIcons name="calendar-today" size={16} color={colors.onSurface} />
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item.id)}
                    hitSlop={tokens.hitSlop.sm}
                  >
                    <MaterialIcons name="close" size={18} color={colors.outline} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal de Agendamento Rápido */}
      {scheduleModalItem && (
        <Modal transparent animationType="fade" visible={!!scheduleModalItem}>
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                Agendar Pendência
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                "{scheduleModalItem.title}"
              </Text>

              <View style={styles.modalOptions}>
                <TouchableOpacity
                  style={[styles.modalOptionBtn, { backgroundColor: colors.surfaceContainerLow }]}
                  onPress={() => handleQuickSchedule(scheduleModalItem, getTodayISO())}
                >
                  <MaterialIcons name="today" size={18} color={colors.primary} />
                  <Text style={[styles.modalOptionText, { color: colors.onSurface }]}>Hoje</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalOptionBtn, { backgroundColor: colors.surfaceContainerLow }]}
                  onPress={() => handleQuickSchedule(scheduleModalItem, getTomorrowISO())}
                >
                  <MaterialIcons name="event" size={18} color={colors.primary} />
                  <Text style={[styles.modalOptionText, { color: colors.onSurface }]}>Amanhã</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.outlineVariant }]}
                onPress={() => setScheduleModalItem(null)}
              >
                <Text style={[styles.modalCancelText, { color: colors.onSurfaceVariant }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 0,
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
  refreshButton: {
    padding: tokens.spacing.xs,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: tokens.spacing.md,
    paddingBottom: 90,
  },
  createCard: {
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    padding: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  createInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
  },
  createBtn: {
    width: 34,
    height: 34,
    borderRadius: MD3Shapes.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentContainer: {
    marginBottom: tokens.spacing.md,
  },
  segmentPill: {
    flexDirection: 'row',
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
    padding: 3,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: MD3Shapes.full,
    gap: 6,
  },
  segmentTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  segmentBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  categoryChips: {
    paddingBottom: tokens.spacing.sm,
    gap: 8,
  },
  chip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 6,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  itemsList: {
    gap: 10,
    marginTop: 4,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: tokens.spacing.md,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  itemContent: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  itemDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: MD3Shapes.extraSmall,
  },
  categoryBadgeText: {
    fontSize: 11,
    textTransform: 'capitalize',
  },
  scheduledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scheduledBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scheduleBtn: {
    width: 32,
    height: 32,
    borderRadius: MD3Shapes.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    padding: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    padding: tokens.spacing.lg,
    gap: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 13,
  },
  modalOptions: {
    gap: 10,
  },
  modalOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing.md,
    borderRadius: MD3Shapes.medium,
    gap: 12,
  },
  modalOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalCancelBtn: {
    padding: tokens.spacing.md,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
  },
});
