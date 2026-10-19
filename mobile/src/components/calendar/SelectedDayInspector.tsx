import React, { useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { EventCard } from './EventCard';
import type { Event } from '../../types';

interface SelectedDayInspectorProps {
  selectedDate: Date;
  selectedDayEvents: Event[];
  totalTodos: number;
  completedTodos: number;
  onBack: () => void;
  onEditEvent?: (ev: Event) => void;
  onDeleteEvent?: (id: string) => void;
  onCreateEvent?: () => void;
}

export const SelectedDayInspector: React.FC<SelectedDayInspectorProps> = ({
  selectedDate,
  selectedDayEvents,
  totalTodos,
  completedTodos,
  onBack,
  onEditEvent,
  onDeleteEvent,
  onCreateEvent,
}) => {
  const { colors } = useTheme();
  const today = useMemo(() => new Date(), []);

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();

  const selectedDateFormatted = useMemo(() => {
    if (isSameDay(selectedDate, today)) {
      return `Hoje, ${selectedDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}`;
    }
    const formatted = selectedDate.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, [selectedDate, today]);

  return (
    <View style={styles.selectedDaySection}>
      <View style={styles.selectedDayHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.selectedDayTitle, { color: colors.onSurface }]}>
            {selectedDateFormatted}
          </Text>
          <Text style={[styles.selectedDayMeta, { color: colors.textMuted }]}>
            {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'compromisso' : 'compromissos'}
            {isSameDay(selectedDate, today) && totalTodos > 0
              ? ` · ${completedTodos}/${totalTodos} tarefas (${Math.round((completedTodos / totalTodos) * 100)}%)`
              : ''}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.viewInAgendaBtn, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant }]}
          onPress={onBack}
          activeOpacity={0.75}
          accessibilityLabel="Ver compromissos deste dia na agenda principal"
          accessibilityRole="button"
        >
          <MaterialIcons name="visibility" size={16} color={colors.primary} />
          <Text style={[styles.viewInAgendaText, { color: colors.onSurface }]}>Ver na Agenda</Text>
        </TouchableOpacity>
      </View>

      {selectedDayEvents.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.surfaceContainerHigh }]}>
            <MaterialIcons name="event-available" size={22} color={colors.primary} />
          </View>
          <View style={styles.emptyContent}>
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Dia Livre</Text>
            <Text style={[styles.emptySub, { color: colors.onSurfaceVariant }]}>
              Nenhum compromisso marcado para este dia.
            </Text>
          </View>
          {onCreateEvent && (
            <TouchableOpacity
              style={[styles.quickAddBtn, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant }]}
              onPress={onCreateEvent}
              activeOpacity={0.8}
              accessibilityLabel="Adicionar evento neste dia"
              accessibilityRole="button"
            >
              <MaterialIcons name="add" size={16} color={colors.primary} />
              <Text style={[styles.quickAddText, { color: colors.primary }]}>Adicionar</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        selectedDayEvents.map((ev) => (
          <EventCard
            key={ev.id}
            event={ev}
            onDelete={onDeleteEvent || (() => {})}
            onPress={onEditEvent}
            onRequestDelete={onEditEvent}
          />
        ))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  selectedDaySection: {
    marginTop: tokens.spacing.xs,
  },
  selectedDayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.sm + 4,
    gap: 12,
  },
  selectedDayTitle: {
    fontSize: tokens.typography.size.titleMedium,
    fontWeight: tokens.typography.weight.bold,
  },
  selectedDayMeta: {
    fontSize: tokens.typography.size.bodySmall,
    marginTop: 2,
  },
  viewInAgendaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
  },
  viewInAgendaText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: MD3Shapes.largeIncreased,
    padding: tokens.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyIconContainer: {
    width: 42,
    height: 42,
    borderRadius: MD3Shapes.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContent: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: tokens.typography.size.titleSmall,
    fontWeight: tokens.typography.weight.bold,
  },
  emptySub: {
    fontSize: tokens.typography.size.bodySmall,
    marginTop: 2,
  },
  quickAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
  },
  quickAddText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
