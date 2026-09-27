import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';

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
  segmentCapsule: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surfaceContainerHigh,
    borderRadius: tokens.radii.full,
    padding: 3,
    gap: 2,
  },
  segmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: tokens.radii.full,
  },
  segmentBtnActive: {
    backgroundColor: tokens.colors.primaryContainer,
  },
  segmentText: {
    fontSize: tokens.typography.size.xs,
    color: tokens.colors.textSecondary,
    fontWeight: tokens.typography.weight.medium,
  },
  segmentTextActive: {
    color: '#ffffff',
    fontWeight: tokens.typography.weight.semibold,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  circleBtn: {
    width: 32,
    height: 32,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  circleBtnActive: {
    backgroundColor: tokens.colors.primaryLight,
    borderColor: tokens.colors.primary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceContainer,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
    marginBottom: tokens.spacing.xs + 2,
    gap: 6,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  searchInput: {
    flex: 1,
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.size.xs + 1,
    padding: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: tokens.spacing.xs + 2,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: tokens.colors.surfaceContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.full,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  filterPillActive: {
    backgroundColor: tokens.colors.primaryLight,
    borderColor: tokens.colors.primary,
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: tokens.radii.full,
  },
  filterText: {
    color: tokens.colors.textSecondary,
    fontSize: 11,
  },
  filterTextActive: {
    color: tokens.colors.primary,
    fontWeight: tokens.typography.weight.semibold,
  },
});
