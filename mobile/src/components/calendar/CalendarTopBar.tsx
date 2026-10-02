import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';

export type CalendarViewMode = 'month' | 'week' | 'todos';

interface CalendarTopBarProps {
  activeViewMode: CalendarViewMode;
  onChangeViewMode: (mode: CalendarViewMode) => void;
  searchVisible: boolean;
  onToggleSearch: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterVisible: boolean;
  onToggleFilter: () => void;
  activeCategory: string;
  onSelectCategory: (cat: string) => void;
}

const CATEGORIES = [
  { id: 'all', label: 'Todos' },
  { id: 'leadership', label: 'Liderança', color: tokens.colors.primary },
  { id: 'focus', label: 'Foco Estratégico', color: tokens.colors.tertiary },
  { id: 'personal', label: 'Pessoal', color: tokens.colors.secondary },
];

export const CalendarTopBar: React.FC<CalendarTopBarProps> = ({
  activeViewMode,
  onChangeViewMode,
  searchVisible,
  onToggleSearch,
  searchQuery,
  onSearchChange,
  filterVisible,
  onToggleFilter,
  activeCategory,
  onSelectCategory,
}) => {
  return (
    <View style={styles.container}>
      {/* 1. Alternador Segmentado & Botões de Ação */}
      <View style={styles.controlRow}>
        <View style={styles.segmentCapsule}>
          {(['month', 'week', 'todos'] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.segmentBtn, activeViewMode === mode && styles.segmentBtnActive]}
              onPress={() => onChangeViewMode(mode)}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, activeViewMode === mode && styles.segmentTextActive]}>
                {mode === 'month' ? 'Mês' : mode === 'week' ? 'Semana' : 'Tarefas'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.circleBtn, searchVisible && styles.circleBtnActive]}
            onPress={onToggleSearch}
            accessibilityLabel="Pesquisar compromissos"
          >
            <MaterialIcons
              name="search"
              size={18}
              color={searchVisible ? tokens.colors.primary : tokens.colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.circleBtn, filterVisible && styles.circleBtnActive]}
            onPress={onToggleFilter}
            accessibilityLabel="Filtrar categorias"
          >
            <MaterialIcons
              name="tune"
              size={18}
              color={filterVisible ? tokens.colors.primary : tokens.colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Barra de Busca Expansível */}
      {searchVisible && (
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={16} color={tokens.colors.outline} />
          <TextInput
            style={styles.searchInput}
            placeholder="Pesquisar compromissos ou tarefas..."
            placeholderTextColor={tokens.colors.textMuted}
            value={searchQuery}
            onChangeText={onSearchChange}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => onSearchChange('')} hitSlop={tokens.hitSlop.sm}>
              <MaterialIcons name="close" size={16} color={tokens.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 3. Filtros de Categoria Expansíveis */}
      {filterVisible && (
        <View style={styles.filterRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.filterPill,
                activeCategory === cat.id && styles.filterPillActive,
              ]}
              onPress={() => onSelectCategory(cat.id)}
            >
              {cat.color && (
                <View style={[styles.filterDot, { backgroundColor: cat.color }]} />
              )}
              <Text
                style={[
                  styles.filterText,
                  activeCategory === cat.id && styles.filterTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: tokens.spacing.xs,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.xs + 2,
  },
  // Segmented Buttons M3
  segmentCapsule: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surfaceContainer,
    borderRadius: MD3Shapes.full,
    padding: 3,
    gap: 2,
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
  },
  segmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: MD3Shapes.full,
  },
  segmentBtnActive: {
    backgroundColor: tokens.colors.secondaryContainer,
  },
  segmentText: {
    fontSize: tokens.typography.size.labelSmall,
    color: tokens.colors.onSurfaceVariant,
    fontWeight: tokens.typography.weight.medium,
  },
  segmentTextActive: {
    color: tokens.colors.onSecondaryContainer,
    fontWeight: tokens.typography.weight.bold,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  circleBtn: {
    width: 34,
    height: 34,
    borderRadius: MD3Shapes.full,
    backgroundColor: tokens.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
  },
  circleBtnActive: {
    backgroundColor: tokens.colors.secondaryContainer,
    borderColor: tokens.colors.secondary,
  },
  // Search Bar M3
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceContainerHigh,
    borderRadius: MD3Shapes.extraLarge,
    paddingHorizontal: tokens.spacing.sm + 2,
    paddingVertical: 6,
    marginBottom: tokens.spacing.xs + 2,
    gap: 6,
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
  },
  searchInput: {
    flex: 1,
    color: tokens.colors.onSurface,
    fontSize: tokens.typography.size.bodySmall,
    padding: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: tokens.spacing.xs + 2,
  },
  // M3 Filter Chip (8dp radius)
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: tokens.colors.surfaceContainerLow,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: MD3Shapes.small,
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
  },
  filterPillActive: {
    backgroundColor: tokens.colors.secondaryContainer,
    borderColor: tokens.colors.secondary,
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: MD3Shapes.full,
  },
  filterText: {
    color: tokens.colors.onSurfaceVariant,
    fontSize: 11,
  },
  filterTextActive: {
    color: tokens.colors.onSecondaryContainer,
    fontWeight: tokens.typography.weight.semibold,
  },
});
