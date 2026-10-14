import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';

export type AgendaPeriodFilter = 'all' | 'today' | 'week';

const PERIODS: Array<{ id: AgendaPeriodFilter; label: string }> = [
  { id: 'all', label: 'Tudo' },
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: '7 dias' },
];

interface AgendaSearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  period: AgendaPeriodFilter;
  onPeriodChange: (p: AgendaPeriodFilter) => void;
  resultCount: number;
}

/** Busca + filtros da Agenda (espelho do padrão de Tarefas). */
export const AgendaSearchBar: React.FC<AgendaSearchBarProps> = ({
  query,
  onQueryChange,
  period,
  onPeriodChange,
  resultCount,
}) => {
  const { colors } = useTheme();
  const [filterVisible, setFilterVisible] = useState(false);
  const filtered = period !== 'all';

  return (
    <View>
      <View style={styles.row}>
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
          <MaterialIcons name="search" size={18} color={colors.onSurfaceVariant} />
          <TextInput
            style={[styles.input, { color: colors.onSurface }]}
            value={query}
            onChangeText={onQueryChange}
            placeholder="Pesquisar eventos..."
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            accessibilityLabel="Pesquisar eventos"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => onQueryChange('')}
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
              backgroundColor: filtered ? colors.primary : colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
            },
          ]}
          onPress={() => setFilterVisible(true)}
          activeOpacity={0.8}
          hitSlop={tokens.hitSlop.sm}
          accessibilityLabel="Filtrar agenda por período"
          accessibilityRole="button"
        >
          <MaterialIcons
            name="filter-list"
            size={20}
            color={filtered ? colors.onPrimary : colors.onSurface}
          />
        </TouchableOpacity>
      </View>

      <BottomSheetModal
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        title="Filtrar Agenda"
        subtitle="Refine os compromissos exibidos"
      >
        <Text style={[styles.groupLabel, { color: colors.textMuted }]}>PERÍODO</Text>
        <View style={styles.grid}>
          {PERIODS.map((p) => {
            const active = period === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                  },
                ]}
                onPress={() => onPeriodChange(p.id)}
                activeOpacity={0.8}
                hitSlop={tokens.hitSlop.sm}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Período ${p.label}`}
              >
                <Text style={[styles.chipText, { color: active ? colors.onPrimary : colors.onSurface }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.clearBtn, { borderColor: colors.outlineVariant }]}
            onPress={() => { onPeriodChange('all'); onQueryChange(''); }}
            activeOpacity={0.8}
            accessibilityLabel="Limpar filtros da agenda"
            accessibilityRole="button"
          >
            <Text style={[styles.clearText, { color: colors.onSurface }]}>Limpar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.applyBtn, { backgroundColor: colors.primary }]}
            onPress={() => setFilterVisible(false)}
            activeOpacity={0.85}
            accessibilityLabel={`Mostrar ${resultCount} eventos`}
            accessibilityRole="button"
          >
            <Text style={[styles.applyText, { color: colors.onPrimary }]}>
              Mostrar {resultCount} eventos
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: tokens.spacing.sm,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 48,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 10,
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: tokens.spacing.lg,
  },
  clearBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '700',
  },
  applyBtn: {
    flex: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  applyText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
