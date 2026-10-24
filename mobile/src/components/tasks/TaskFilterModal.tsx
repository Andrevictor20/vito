import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { useTheme } from '../../context/ThemeContext';
import { tokens } from '../../theme/tokens';
import type { TaskSort } from '../../utils/unifiedTasks';

export type PriorityFilter = 'all' | 'low' | 'medium' | 'high';

interface TaskFilterModalProps {
  visible: boolean;
  onClose: () => void;
  priorityFilter: PriorityFilter;
  onSelectPriority: (p: PriorityFilter) => void;
  sort: TaskSort;
  onSelectSort: (s: TaskSort) => void;
  onReset: () => void;
  activeCount: number;
}

const PRIORITY_OPTIONS: Array<{ id: PriorityFilter; label: string }> = [
  { id: 'all', label: 'Todas as prioridades' },
  { id: 'high', label: '• Alta Prioridade' },
  { id: 'medium', label: '• Média Prioridade' },
  { id: 'low', label: '• Baixa Prioridade' },
];

const SORT_OPTIONS: Array<{ id: TaskSort; label: string }> = [
  { id: 'date', label: 'Prazo' },
  { id: 'priority', label: 'Prioridade' },
  { id: 'alpha', label: 'A–Z' },
];

export const TaskFilterModal: React.FC<TaskFilterModalProps> = ({
  visible,
  onClose,
  priorityFilter,
  onSelectPriority,
  sort,
  onSelectSort,
  onReset,
  activeCount,
}) => {
  const { colors } = useTheme();

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Filtrar e Ordenar"
      subtitle="Refine sua visualização de tarefas ativas"
    >
      <Text
        style={[
          styles.groupLabel,
          {
            color: colors.muted,
            fontFamily: tokens.typography.family.semibold,
          },
        ]}
      >
        PRIORIDADE
      </Text>
      <View style={styles.grid}>
        {PRIORITY_OPTIONS.map((p) => {
          const active = priorityFilter === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.ink : colors.surf,
                  borderColor: active ? colors.ink : colors.line,
                },
              ]}
              onPress={() => onSelectPriority(p.id)}
              activeOpacity={0.8}
              hitSlop={tokens.hitSlop.sm}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Prioridade ${p.label}`}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: active ? colors.bg : colors.ink,
                    fontFamily: tokens.typography.family.semibold,
                  },
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text
        style={[
          styles.groupLabel,
          {
            color: colors.muted,
            fontFamily: tokens.typography.family.semibold,
          },
        ]}
      >
        ORDENAR LISTA POR
      </Text>
      <View style={styles.grid}>
        {SORT_OPTIONS.map((s) => {
          const active = sort === s.id;
          return (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.ink : colors.surf,
                  borderColor: active ? colors.ink : colors.line,
                },
              ]}
              onPress={() => onSelectSort(s.id)}
              activeOpacity={0.8}
              hitSlop={tokens.hitSlop.sm}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Ordenar por ${s.label}`}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: active ? colors.bg : colors.ink,
                    fontFamily: tokens.typography.family.semibold,
                  },
                ]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.clearBtn,
            {
              borderColor: colors.line,
            },
          ]}
          onPress={onReset}
          activeOpacity={0.8}
          accessibilityLabel="Limpar filtros"
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.clearText,
              {
                color: colors.ink,
                fontFamily: tokens.typography.family.semibold,
              },
            ]}
          >
            Limpar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.applyBtn,
            {
              backgroundColor: colors.ink,
            },
          ]}
          onPress={onClose}
          activeOpacity={0.85}
          accessibilityLabel={`Mostrar ${activeCount} tarefas`}
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.applyText,
              {
                color: colors.bg,
                fontFamily: tokens.typography.family.semibold,
              },
            ]}
          >
            Mostrar {activeCount} tarefas
          </Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 8,
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
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
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
    fontWeight: '600',
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
    fontWeight: '600',
  },
});
