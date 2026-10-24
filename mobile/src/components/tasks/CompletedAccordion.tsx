import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { tokens } from '../../theme/tokens';
import { hapticFeedback } from '../../theme/motion';
import type { UnifiedRow } from '../../utils/unifiedTasks';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CompletedAccordionProps {
  completedRows: UnifiedRow[];
  onToggleRow: (row: UnifiedRow) => void;
  onEditRow?: (row: UnifiedRow) => void;
  onDeleteRow?: (row: UnifiedRow) => void;
}

/**
 * Acordeão de concluídas (.dn e .dl) fiel a vito-telas.html.
 * - Barra arredondada de 16px em colors.surf com padding 14px e margem 22px
 * - Ícone de duplo check em verde (colors.acc)
 * - Título: "Concluídas (X)" em 14px semibold
 * - Chevron animado
 * - Ao abrir: lista de tarefas concluídas tachadas com checkbox para desfazer
 */
export const CompletedAccordion: React.FC<CompletedAccordionProps> = ({
  completedRows,
  onToggleRow,
  onEditRow,
  onDeleteRow,
}) => {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  if (completedRows.length === 0) return null;

  const toggleOpen = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    hapticFeedback.selection();
    setIsOpen((prev) => !prev);
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[
          styles.accordionBar,
          {
            backgroundColor: colors.surf,
          },
        ]}
        onPress={toggleOpen}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Concluídas, ${completedRows.length} tarefas. Toque para ${isOpen ? 'recolher' : 'expandir'}`}
        accessibilityState={{ expanded: isOpen }}
      >
        <View style={styles.left}>
          <MaterialIcons name="done-all" size={18} color={colors.acc} />
          <Text
            style={[
              styles.barText,
              {
                color: colors.ink,
                fontFamily: tokens.typography.family.semibold,
              },
            ]}
          >
            Concluídas ({completedRows.length})
          </Text>
        </View>

        <MaterialIcons
          name={isOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={20}
          color={colors.muted}
        />
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.listContainer}>
          {completedRows.map((row) => (
            <View
              key={`done-${row.kind}-${row.id}`}
              style={[
                styles.doneRow,
                {
                  borderBottomColor: colors.line,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.checkCircle,
                  {
                    backgroundColor: colors.purple,
                    borderColor: colors.purple,
                  },
                ]}
                onPress={() => {
                  hapticFeedback.selection();
                  onToggleRow(row);
                }}
                activeOpacity={0.7}
                hitSlop={tokens.hitSlop.sm}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: true }}
                accessibilityLabel="Reabrir tarefa concluída"
              >
                <MaterialIcons name="check" size={14} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.textSlot}
                onPress={() => onEditRow?.(row)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Ver detalhes de ${row.title}`}
              >
                <Text
                  style={[
                    styles.doneTitle,
                    {
                      color: colors.muted,
                      fontFamily: tokens.typography.family.regular,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {row.title}
                </Text>
              </TouchableOpacity>

              {onDeleteRow && (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => {
                    hapticFeedback.selection();
                    onDeleteRow(row);
                  }}
                  hitSlop={tokens.hitSlop.sm}
                  activeOpacity={0.7}
                  accessibilityLabel="Excluir tarefa"
                  accessibilityRole="button"
                >
                  <MaterialIcons name="delete-outline" size={18} color={colors.muted} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 22,
    marginHorizontal: 20,
    marginBottom: 40,
  },
  accordionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    width: '100%',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    paddingTop: 4,
    paddingHorizontal: 4,
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  textSlot: {
    flex: 1,
  },
  doneTitle: {
    fontSize: 14.5,
    textDecorationLine: 'line-through',
    opacity: 0.8,
  },
  deleteBtn: {
    padding: 4,
  },
});
