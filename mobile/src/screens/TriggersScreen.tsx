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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useTriggers } from '../hooks/useTriggers';
import { TriggerCard } from '../components/triggers/TriggerCard';
import { TriggerReportsView } from '../components/triggers/TriggerReportsView';
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

  // Entrada em Linguagem Natural
  const [naturalPrompt, setNaturalPrompt] = useState('');
  const [isSubmittingPrompt, setIsSubmittingPrompt] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);

  // Categorias ativas com pelo menos 1 disparador
  const activeCategories = useMemo(() => {
    const presentCats = new Set(allTriggers.map((t) => t.category));
    return TRIGGER_CATEGORIES.filter((c) => presentCats.has(c.id));
  }, [allTriggers]);

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
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
        {promptError && <Text style={styles.inputErrorText}>{promptError}</Text>}
      </View>

      {/* 3. Filtros Contextuais (Apenas categorias com itens) */}
      {activeCategories.length > 0 && (
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedCategory === 'all'
                  ? [styles.filterChipActive, { backgroundColor: colors.primary }]
                  : [
                      styles.filterChipInactive,
                      {
                        backgroundColor: isDark ? colors.surfaceContainerLowest : '#F4F4F5',
                        borderColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.06)',
                      },
                    ],
              ]}
              onPress={() => setSelectedCategory('all')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color: selectedCategory === 'all' ? '#FFFFFF' : colors.onSurface,
                    fontWeight: selectedCategory === 'all' ? '700' : '500',
                  },
                ]}
              >
                Todos ({allTriggers.length})
              </Text>
            </TouchableOpacity>

            {activeCategories.map((cat) => {
              const count = allTriggers.filter((t) => t.category === cat.id).length;
              const isSelected = selectedCategory === cat.id;
              const catColor = isDark ? cat.colorDark : cat.colorLight;

              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.filterChip,
                    isSelected
                      ? [styles.filterChipActive, { backgroundColor: colors.primary }]
                      : [
                          styles.filterChipInactive,
                          {
                            backgroundColor: isDark ? colors.surfaceContainerLowest : '#F4F4F5',
                            borderColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.06)',
                          },
                        ],
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <MaterialIcons
                    name={cat.icon as any}
                    size={15}
                    color={isSelected ? '#FFFFFF' : catColor}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color: isSelected ? '#FFFFFF' : colors.onSurface,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {cat.label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
          data={triggers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TriggerCard
              trigger={item}
              onToggle={handleToggleTrigger}
              onEdit={(t) => setEditTrigger(t)}
              onDelete={handleDeleteTrigger}
              onPress={(t) => setReportTrigger(t)}
            />
          )}
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
  filterSection: {
    paddingVertical: 6,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: MD3Shapes.full,
    gap: 6,
  },
  filterChipActive: {
    elevation: 2,
  },
  filterChipInactive: {
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
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
    paddingBottom: 90,
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
