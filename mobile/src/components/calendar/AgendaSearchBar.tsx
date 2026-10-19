import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { AgendaFilterModal } from './AgendaFilterModal';
import {
  AgendaFilterState,
  DEFAULT_AGENDA_FILTER,
  countActiveAgendaFilters,
  AgendaPeriod,
  AgendaSource,
  AgendaCategory,
  AgendaFormat,
} from '../../utils/agendaFilter';

export type AgendaPeriodFilter = AgendaPeriod;

export interface AgendaSearchBarProps {
  filters: AgendaFilterState;
  onFiltersChange: (f: AgendaFilterState) => void;
  resultCount: number;
}

/** Busca + filtros completos da Agenda (período, origem, categoria e formato). */
export const AgendaSearchBar: React.FC<AgendaSearchBarProps> = ({
  filters,
  onFiltersChange,
  resultCount,
}) => {
  const { colors, isDark } = useTheme();
  const [filterVisible, setFilterVisible] = useState(false);
  const activeCount = countActiveAgendaFilters(filters);
  const hasActiveFilters = activeCount > 0 || !!filters.query;

  const handleQueryChange = (q: string) => {
    onFiltersChange({ ...filters, query: q });
  };

  const handlePeriodChange = (p: AgendaPeriod) => {
    onFiltersChange({ ...filters, period: p });
  };

  const handleSourceChange = (s: AgendaSource) => {
    onFiltersChange({ ...filters, source: s });
  };

  const handleCategoryChange = (c: AgendaCategory) => {
    onFiltersChange({ ...filters, category: c });
  };

  const handleFormatChange = (f: AgendaFormat) => {
    onFiltersChange({ ...filters, format: f });
  };

  const handleClearAll = () => {
    onFiltersChange(DEFAULT_AGENDA_FILTER);
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: isDark ? colors.surfaceContainerLow : '#F4F4F5',
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <MaterialIcons name="search" size={20} color={colors.onSurfaceVariant} />
          <TextInput
            style={[styles.input, { color: colors.onSurface }]}
            value={filters.query}
            onChangeText={handleQueryChange}
            placeholder="Pesquisar eventos, locais..."
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            accessibilityLabel="Pesquisar eventos"
          />
          {filters.query.length > 0 && (
            <TouchableOpacity
              onPress={() => handleQueryChange('')}
              hitSlop={tokens.hitSlop.sm}
              accessibilityLabel="Limpar busca"
              accessibilityRole="button"
            >
              <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.filterBtn,
            {
              backgroundColor: activeCount > 0 ? colors.primary : (isDark ? colors.surfaceContainerLow : '#F4F4F5'),
              borderColor: colors.outlineVariant,
            },
          ]}
          onPress={() => setFilterVisible(true)}
          activeOpacity={0.8}
          hitSlop={tokens.hitSlop.sm}
          accessibilityLabel="Abrir filtros avançados da agenda"
          accessibilityRole="button"
        >
          <MaterialIcons
            name="tune"
            size={20}
            color={activeCount > 0 ? colors.onPrimary : colors.onSurface}
          />
          {activeCount > 0 && (
            <View style={[styles.filterBadge, { backgroundColor: colors.accents.sky }]}>
              <Text style={styles.filterBadgeText}>{activeCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Barra de Filtros Rápidos com Rolagem Horizontal */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickChipsContent}
        style={styles.quickChipsScroll}
      >
        <TouchableOpacity
          style={[
            styles.quickChip,
            {
              backgroundColor:
                filters.period === 'all' &&
                filters.category === 'all' &&
                filters.source === 'all' &&
                filters.format === 'all'
                  ? colors.primary
                  : (isDark ? colors.surfaceContainerLow : '#F4F4F5'),
              borderColor: colors.outlineVariant,
            },
          ]}
          onPress={handleClearAll}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.quickChipText,
              {
                color:
                  filters.period === 'all' &&
                  filters.category === 'all' &&
                  filters.source === 'all' &&
                  filters.format === 'all'
                    ? colors.onPrimary
                    : colors.onSurface,
              },
            ]}
          >
            Todos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.quickChip,
            {
              backgroundColor: filters.period === 'today' ? colors.primary : (isDark ? colors.surfaceContainerLow : '#F4F4F5'),
              borderColor: colors.outlineVariant,
            },
          ]}
          onPress={() => handlePeriodChange(filters.period === 'today' ? 'all' : 'today')}
          activeOpacity={0.75}
        >
          <Text style={[styles.quickChipText, { color: filters.period === 'today' ? colors.onPrimary : colors.onSurface }]}>
            Hoje
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.quickChip,
            {
              backgroundColor: filters.period === 'week' ? colors.primary : (isDark ? colors.surfaceContainerLow : '#F4F4F5'),
              borderColor: colors.outlineVariant,
            },
          ]}
          onPress={() => handlePeriodChange(filters.period === 'week' ? 'all' : 'week')}
          activeOpacity={0.75}
        >
          <Text style={[styles.quickChipText, { color: filters.period === 'week' ? colors.onPrimary : colors.onSurface }]}>
            7 dias
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.quickChip,
            {
              backgroundColor: filters.period === 'month' ? colors.primary : (isDark ? colors.surfaceContainerLow : '#F4F4F5'),
              borderColor: colors.outlineVariant,
            },
          ]}
          onPress={() => handlePeriodChange(filters.period === 'month' ? 'all' : 'month')}
          activeOpacity={0.75}
        >
          <Text style={[styles.quickChipText, { color: filters.period === 'month' ? colors.onPrimary : colors.onSurface }]}>
            Este mês
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.quickChip,
            {
              backgroundColor: filters.source === 'google' ? colors.primary : (isDark ? colors.surfaceContainerLow : '#F4F4F5'),
              borderColor: colors.outlineVariant,
            },
          ]}
          onPress={() => handleSourceChange(filters.source === 'google' ? 'all' : 'google')}
          activeOpacity={0.75}
        >
          <Text style={[styles.quickChipText, { color: filters.source === 'google' ? colors.onPrimary : colors.onSurface }]}>
            Google
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.quickChip,
            {
              backgroundColor: filters.category === 'work' ? colors.primary : (isDark ? colors.surfaceContainerLow : '#F4F4F5'),
              borderColor: colors.outlineVariant,
            },
          ]}
          onPress={() => handleCategoryChange(filters.category === 'work' ? 'all' : 'work')}
          activeOpacity={0.75}
        >
          <Text style={[styles.quickChipText, { color: filters.category === 'work' ? colors.onPrimary : colors.onSurface }]}>
            Trabalho
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.quickChip,
            {
              backgroundColor: filters.category === 'holiday' ? colors.primary : (isDark ? colors.surfaceContainerLow : '#F4F4F5'),
              borderColor: colors.outlineVariant,
            },
          ]}
          onPress={() => handleCategoryChange(filters.category === 'holiday' ? 'all' : 'holiday')}
          activeOpacity={0.75}
        >
          <Text style={[styles.quickChipText, { color: filters.category === 'holiday' ? colors.onPrimary : colors.onSurface }]}>
            Feriados
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.quickChip,
            {
              backgroundColor: filters.category === 'study' ? colors.primary : (isDark ? colors.surfaceContainerLow : '#F4F4F5'),
              borderColor: colors.outlineVariant,
            },
          ]}
          onPress={() => handleCategoryChange(filters.category === 'study' ? 'all' : 'study')}
          activeOpacity={0.75}
        >
          <Text style={[styles.quickChipText, { color: filters.category === 'study' ? colors.onPrimary : colors.onSurface }]}>
            Estudo
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Indicador de Filtros Ativos */}
      {hasActiveFilters && (
        <View style={styles.activeFilterRow}>
          <Text style={[styles.activeFilterText, { color: colors.textMuted }]}>
            {resultCount} {resultCount === 1 ? 'evento filtrado' : 'eventos filtrados'}
            {filters.query ? ` para "${filters.query.trim()}"` : ''}
          </Text>
          <TouchableOpacity onPress={handleClearAll} activeOpacity={0.7}>
            <Text style={[styles.clearFilterLink, { color: colors.primary }]}>Limpar filtros</Text>
          </TouchableOpacity>
        </View>
      )}

      <AgendaFilterModal
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        filters={filters}
        onFiltersChange={onFiltersChange}
        resultCount={resultCount}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: tokens.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 46,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 10,
  },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '800',
  },
  quickChipsScroll: {
    marginTop: 8,
  },
  quickChipsContent: {
    gap: 6,
    paddingRight: 8,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  activeFilterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  activeFilterText: {
    fontSize: 12,
    fontWeight: '500',
  },
  clearFilterLink: {
    fontSize: 12,
    fontWeight: '700',
  },
});
