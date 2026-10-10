import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useTriggers } from '../hooks/useTriggers';
import { TriggerCard } from '../components/triggers/TriggerCard';
import { CreateTriggerModal } from '../components/triggers/CreateTriggerModal';
import { TRIGGER_CATEGORIES, TriggerCategory } from '../types';

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
    stats,
  } = useTriggers();

  const [createModalVisible, setCreateModalVisible] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* 1. Hero Card: Vigília Ativa e Estatísticas */}
      <View style={styles.heroWrapper}>
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? colors.surfaceContainerLow : '#FFFFFF',
              borderColor: isDark ? colors.outlineVariant : 'rgba(0, 0, 0, 0.06)',
            },
          ]}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroTitleRow}>
              <View
                style={[
                  styles.heroRadarIcon,
                  { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5' },
                ]}
              >
                <MaterialIcons name="radar" size={22} color="#10B981" />
              </View>
              <View>
                <Text style={[styles.heroHeading, { color: colors.onSurface }]}>
                  Vigília de Inteligência
                </Text>
                <Text style={[styles.heroSubheading, { color: colors.onSurfaceVariant }]}>
                  Monitoramento contínuo em background
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.createHeroButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={() => setCreateModalVisible(true)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.createHeroButtonText}>Novo</Text>
            </TouchableOpacity>
          </View>

          {/* Métricas Rápidas */}
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricNumber, { color: '#10B981' }]}>
                {stats.active}
              </Text>
              <Text style={[styles.metricLabel, { color: colors.onSurfaceVariant }]}>
                Ativos
              </Text>
            </View>

            <View
              style={[
                styles.metricDivider,
                { backgroundColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.08)' },
              ]}
            />

            <View style={styles.metricItem}>
              <Text style={[styles.metricNumber, { color: colors.onSurface }]}>
                {stats.total}
              </Text>
              <Text style={[styles.metricLabel, { color: colors.onSurfaceVariant }]}>
                Total
              </Text>
            </View>

            <View
              style={[
                styles.metricDivider,
                { backgroundColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.08)' },
              ]}
            />

            <View style={styles.metricItem}>
              <Text style={[styles.metricNumber, { color: isDark ? '#A1A1AA' : '#71717A' }]}>
                {stats.paused}
              </Text>
              <Text style={[styles.metricLabel, { color: colors.onSurfaceVariant }]}>
                Pausados
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 2. Carrossel Horizontal de Filtros pelas 12 Categorias */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {/* Chip 'Todos' */}
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedCategory === 'all'
                ? [
                    styles.filterChipActive,
                    { backgroundColor: isDark ? colors.surfaceContainerHighest : colors.primary },
                  ]
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
            <MaterialIcons
              name="apps"
              size={16}
              color={selectedCategory === 'all' ? '#FFFFFF' : isDark ? '#A1A1AA' : '#71717A'}
            />
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

          {/* Chips das 12 Categorias */}
          {TRIGGER_CATEGORIES.map((cat) => {
            const count = allTriggers.filter((t) => t.category === cat.id).length;
            const isSelected = selectedCategory === cat.id;
            const catColor = isDark ? cat.colorDark : cat.colorLight;

            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.filterChip,
                  isSelected
                    ? [
                        styles.filterChipActive,
                        { backgroundColor: isDark ? colors.surfaceContainerHighest : colors.primary },
                      ]
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
                  size={16}
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
                  {cat.label} {count > 0 ? `(${count})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. Lista de Disparadores */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>
            Sincronizando disparadores...
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
              onDelete={handleDeleteTrigger}
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
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
                ]}
              >
                <MaterialIcons
                  name="track-changes"
                  size={36}
                  color={isDark ? '#71717A' : '#9CA3AF'}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                {selectedCategory === 'all'
                  ? 'Nenhum disparador ativo'
                  : 'Nenhum disparador nesta categoria'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
                Peça ao Vito para vigiar preços, cotações, notícias, jogos ou editais para você.
              </Text>
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                onPress={() => setCreateModalVisible(true)}
              >
                <MaterialIcons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.emptyButtonText}>Criar Primeiro Disparador</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Modal de Criação */}
      <CreateTriggerModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSubmit={handleCreateTrigger}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  heroCard: {
    borderRadius: MD3Shapes.largeIncreased,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroRadarIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  heroHeading: {
    fontSize: 16,
    fontWeight: '700',
  },
  heroSubheading: {
    fontSize: 12,
  },
  createHeroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 18,
    gap: 4,
  },
  createHeroButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricNumber: {
    fontSize: 18,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
  },
  filterSection: {
    paddingVertical: 8,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
  },
  filterChipActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  filterChipInactive: {
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 90, // Margem para a FloatingTabBar
  },
  listEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    gap: 6,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
