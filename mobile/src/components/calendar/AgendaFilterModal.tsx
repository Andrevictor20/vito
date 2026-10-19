import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import {
  AgendaFilterState,
  DEFAULT_AGENDA_FILTER,
  AGENDA_PERIOD_OPTIONS,
  AGENDA_SOURCE_OPTIONS,
  AGENDA_CATEGORY_OPTIONS,
  AGENDA_FORMAT_OPTIONS,
  AgendaPeriod,
  AgendaSource,
  AgendaCategory,
  AgendaFormat,
} from '../../utils/agendaFilter';

interface AgendaFilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters: AgendaFilterState;
  onFiltersChange: (next: AgendaFilterState) => void;
  resultCount: number;
}

export const AgendaFilterModal: React.FC<AgendaFilterModalProps> = ({
  visible,
  onClose,
  filters,
  onFiltersChange,
  resultCount,
}) => {
  const { colors, isDark } = useTheme();

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
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Filtros da Agenda"
      subtitle="Refine por período, categoria, origem e formato"
    >
      <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sheetGroupLabel, { color: colors.textMuted }]}>PERÍODO</Text>
        <View style={styles.sheetGrid}>
          {AGENDA_PERIOD_OPTIONS.map((p) => {
            const active = filters.period === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.sheetChip,
                  {
                    backgroundColor: active ? colors.primary : (isDark ? colors.surfaceContainerLow : '#F4F4F5'),
                    borderColor: colors.outlineVariant,
                  },
                ]}
                onPress={() => handlePeriodChange(p.id)}
                activeOpacity={0.8}
                hitSlop={tokens.hitSlop.sm}
              >
                <Text style={[styles.sheetChipText, { color: active ? colors.onPrimary : colors.onSurface }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sheetGroupLabel, { color: colors.textMuted }]}>ORIGEM</Text>
        <View style={styles.sheetGrid}>
          {AGENDA_SOURCE_OPTIONS.map((s) => {
            const active = filters.source === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.sheetChip,
                  {
                    backgroundColor: active ? colors.primary : (isDark ? colors.surfaceContainerLow : '#F4F4F5'),
                    borderColor: colors.outlineVariant,
                  },
                ]}
                onPress={() => handleSourceChange(s.id)}
                activeOpacity={0.8}
                hitSlop={tokens.hitSlop.sm}
              >
                <Text style={[styles.sheetChipText, { color: active ? colors.onPrimary : colors.onSurface }]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sheetGroupLabel, { color: colors.textMuted }]}>CATEGORIA</Text>
        <View style={styles.sheetGrid}>
          {AGENDA_CATEGORY_OPTIONS.map((c) => {
            const active = filters.category === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.sheetChip,
                  {
                    backgroundColor: active ? colors.primary : (isDark ? colors.surfaceContainerLow : '#F4F4F5'),
                    borderColor: colors.outlineVariant,
                  },
                ]}
                onPress={() => handleCategoryChange(c.id)}
                activeOpacity={0.8}
                hitSlop={tokens.hitSlop.sm}
              >
                <Text style={[styles.sheetChipText, { color: active ? colors.onPrimary : colors.onSurface }]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sheetGroupLabel, { color: colors.textMuted }]}>FORMATO</Text>
        <View style={styles.sheetGrid}>
          {AGENDA_FORMAT_OPTIONS.map((f) => {
            const active = filters.format === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.sheetChip,
                  {
                    backgroundColor: active ? colors.primary : (isDark ? colors.surfaceContainerLow : '#F4F4F5'),
                    borderColor: colors.outlineVariant,
                  },
                ]}
                onPress={() => handleFormatChange(f.id)}
                activeOpacity={0.8}
                hitSlop={tokens.hitSlop.sm}
              >
                <Text style={[styles.sheetChipText, { color: active ? colors.onPrimary : colors.onSurface }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.sheetFooter}>
        <TouchableOpacity
          style={[styles.sheetClearBtn, { borderColor: colors.outlineVariant }]}
          onPress={handleClearAll}
          activeOpacity={0.8}
          accessibilityLabel="Limpar filtros da agenda"
          accessibilityRole="button"
        >
          <Text style={[styles.sheetClearText, { color: colors.onSurface }]}>Limpar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sheetApplyBtn, { backgroundColor: colors.primary }]}
          onPress={onClose}
          activeOpacity={0.85}
          accessibilityLabel={`Mostrar ${resultCount} eventos`}
          accessibilityRole="button"
        >
          <Text style={[styles.sheetApplyText, { color: colors.onPrimary }]}>
            Mostrar {resultCount} {resultCount === 1 ? 'evento' : 'eventos'}
          </Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  sheetGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.xs,
  },
  sheetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 40,
    justifyContent: 'center',
  },
  sheetChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sheetFooter: {
    flexDirection: 'row',
    gap: 8,
    marginTop: tokens.spacing.lg,
  },
  sheetClearBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  sheetClearText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sheetApplyBtn: {
    flex: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  sheetApplyText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
