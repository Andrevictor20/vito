import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { TRIGGER_CATEGORIES, TriggerCategory } from '../../types';

export type RadarCategoryFilter = TriggerCategory | 'all';

interface RadarFilterButtonProps {
  selected: RadarCategoryFilter;
  onChange: (c: RadarCategoryFilter) => void;
  counts: Record<string, number>;
  total: number;
  resultCount: number;
}

/** Funil dos Radares: só o ícone (sem barra de busca), espelho do filtro da Agenda. */
export const RadarFilterButton: React.FC<RadarFilterButtonProps> = ({
  selected,
  onChange,
  counts,
  total,
  resultCount,
}) => {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const filtered = selected !== 'all';

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.filterBtn,
          {
            backgroundColor: filtered ? colors.primary : colors.surfaceContainerLow,
            borderColor: colors.outlineVariant,
          },
        ]}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
        hitSlop={tokens.hitSlop.sm}
        accessibilityLabel="Filtrar radares por categoria"
        accessibilityRole="button"
      >
        <MaterialIcons
          name="filter-list"
          size={20}
          color={filtered ? colors.onPrimary : colors.onSurface}
        />
      </TouchableOpacity>

      <BottomSheetModal
        visible={visible}
        onClose={() => setVisible(false)}
        title="Filtrar Radares"
        subtitle="Refine os radares exibidos"
      >
        <Text style={[styles.groupLabel, { color: colors.textMuted }]}>CATEGORIA</Text>
        <View style={styles.grid}>
          <TouchableOpacity
            style={[
              styles.chip,
              {
                backgroundColor: selected === 'all' ? colors.primary : colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
              },
            ]}
            onPress={() => onChange('all')}
            activeOpacity={0.8}
            hitSlop={tokens.hitSlop.sm}
            accessibilityRole="button"
            accessibilityState={{ selected: selected === 'all' }}
            accessibilityLabel="Todas as categorias"
          >
            <Text style={[styles.chipText, { color: selected === 'all' ? colors.onPrimary : colors.onSurface }]}>
              Todas ({total})
            </Text>
          </TouchableOpacity>
          {TRIGGER_CATEGORIES.filter((c) => (counts[c.id] ?? 0) > 0).map((c) => {
            const active = selected === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                  },
                ]}
                onPress={() => onChange(c.id)}
                activeOpacity={0.8}
                hitSlop={tokens.hitSlop.sm}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Categoria ${c.label}`}
              >
                <Text style={[styles.chipText, { color: active ? colors.onPrimary : colors.onSurface }]}>
                  {c.label} ({counts[c.id]})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.clearBtn, { borderColor: colors.outlineVariant }]}
            onPress={() => onChange('all')}
            activeOpacity={0.8}
            accessibilityLabel="Limpar filtro de radares"
            accessibilityRole="button"
          >
            <Text style={[styles.clearText, { color: colors.onSurface }]}>Limpar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.applyBtn, { backgroundColor: colors.primary }]}
            onPress={() => setVisible(false)}
            activeOpacity={0.85}
            accessibilityLabel={`Mostrar ${resultCount} radares`}
            accessibilityRole="button"
          >
            <Text style={[styles.applyText, { color: colors.onPrimary }]}>
              Mostrar {resultCount} {resultCount === 1 ? 'radar' : 'radares'}
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
    </View>
  );
};

const styles = StyleSheet.create({
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
