import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { MD3Shapes } from '../../theme/tokens';
import { Event, Todo } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { EventCard } from './EventCard';
import { TodoItem } from '../todos/TodoItem';

interface CalendarModalProps {
  visible: boolean;
  onClose: () => void;
  events: Event[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onOpenCreate?: () => void;
  onDeleteEvent?: (id: string) => void;
  todos?: Todo[];
  onToggleTodo?: (id: string) => void;
  onDeleteTodo?: (id: string) => void;
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const CalendarModal: React.FC<CalendarModalProps> = ({
  visible,
  onClose,
  events,
  selectedDate,
  onSelectDate,
  onOpenCreate,
  onDeleteEvent,
  todos = [],
  onToggleTodo,
  onDeleteTodo,
}) => {
  const { colors, isDark } = useTheme();
  const [modalTab, setModalTab] = useState<'calendar' | 'todos'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const handleGoToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    onSelectDate(today);
  };

  // Matriz do mês
  const monthGrid = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const items: Array<{ dayNumber: number; isCurrentMonth: boolean; date: Date }> = [];

    // Dias do mês anterior
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      items.push({
        dayNumber: d,
        isCurrentMonth: false,
        date: new Date(year, month - 1, d),
      });
    }

    // Dias do mês atual
    for (let i = 1; i <= totalDaysInMonth; i++) {
      items.push({
        dayNumber: i,
        isCurrentMonth: true,
        date: new Date(year, month, i),
      });
    }

    // Completar última semana
    const remaining = 7 - (items.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        items.push({
          dayNumber: i,
          isCurrentMonth: false,
          date: new Date(year, month + 1, i),
        });
      }
    }

    return items;
  }, [year, month]);

  // Eventos do dia selecionado
  const selectedDayEvents = useMemo(() => {
    const targetY = selectedDate.getFullYear();
    const targetM = selectedDate.getMonth();
    const targetD = selectedDate.getDate();

    return events.filter((ev) => {
      try {
        const d = new Date(ev.start_at);
        return (
          d.getFullYear() === targetY &&
          d.getMonth() === targetM &&
          d.getDate() === targetD
        );
      } catch {
        return false;
      }
    });
  }, [events, selectedDate]);

  // Mapa de eventos por dia
  const eventsByDay = useMemo(() => {
    const map = new Map<string, Event[]>();
    events.forEach((ev) => {
      try {
        const d = new Date(ev.start_at);
        const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(ev);
      } catch {}
    });
    return map;
  }, [events]);

  const selectedFormatted = selectedDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface }]}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          {/* Header M3 com Tabs no centro e Ações */}
          <View style={[styles.topBar, { borderBottomColor: colors.outlineVariant }]}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.surfaceContainerLow }]}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityLabel="Fechar calendário"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons name="arrow-back" size={22} color={colors.onSurface} />
            </TouchableOpacity>

            {/* Tabs Centrais: Calendário vs Tarefas */}
            <View style={styles.tabSelector}>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  modalTab === 'calendar' && {
                    borderBottomColor: colors.primary,
                    borderBottomWidth: 2,
                  },
                ]}
                onPress={() => setModalTab('calendar')}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    {
                      color: modalTab === 'calendar' ? colors.onSurface : colors.textMuted,
                      fontWeight: modalTab === 'calendar' ? '700' : '500',
                    },
                  ]}
                >
                  Calendário
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabButton,
                  modalTab === 'todos' && {
                    borderBottomColor: colors.primary,
                    borderBottomWidth: 2,
                  },
                ]}
                onPress={() => setModalTab('todos')}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    {
                      color: modalTab === 'todos' ? colors.onSurface : colors.textMuted,
                      fontWeight: modalTab === 'todos' ? '700' : '500',
                    },
                  ]}
                >
                  Tarefas {todos.length > 0 ? `(${todos.length})` : ''}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.todayBtn, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow }]}
              onPress={handleGoToday}
              activeOpacity={0.75}
              accessibilityLabel="Ir para hoje"
            >
              <Text style={[styles.todayBtnText, { color: colors.primary }]}>Hoje</Text>
            </TouchableOpacity>
          </View>

          {/* Conteúdo Principal Expandido */}
          {modalTab === 'calendar' ? (
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Barra de Navegação do Mês */}
              <View style={styles.monthNavRow}>
                <View style={styles.monthTitleWrapper}>
                  <Text style={[styles.monthTitleText, { color: colors.onSurface }]}>
                    {MONTH_NAMES[month]} {year}
                  </Text>
                </View>

                <View style={styles.monthNavBtns}>
                  <TouchableOpacity
                    style={[styles.navArrowBtn, { backgroundColor: colors.surfaceContainerLow }]}
                    onPress={handlePrevMonth}
                    activeOpacity={0.7}
                    accessibilityLabel="Mês anterior"
                  >
                    <MaterialIcons name="chevron-left" size={24} color={colors.onSurface} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.navArrowBtn, { backgroundColor: colors.surfaceContainerLow }]}
                    onPress={handleNextMonth}
                    activeOpacity={0.7}
                    accessibilityLabel="Próximo mês"
                  >
                    <MaterialIcons name="chevron-right" size={24} color={colors.onSurface} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Dias da Semana (D S T Q Q S S) */}
              <View style={[styles.weekDaysRow, { borderBottomColor: colors.outlineVariant }]}>
                {WEEKDAYS.map((w, idx) => (
                  <Text key={idx} style={[styles.weekDayLabel, { color: colors.textMuted }]}>
                    {w}
                  </Text>
                ))}
              </View>

              {/* Grade de Dias do Mês */}
              <View style={styles.calendarGrid}>
                {monthGrid.map((item, idx) => {
                  const isSelected =
                    item.date.getFullYear() === selectedDate.getFullYear() &&
                    item.date.getMonth() === selectedDate.getMonth() &&
                    item.date.getDate() === selectedDate.getDate();

                  const today = new Date();
                  const isToday =
                    item.date.getFullYear() === today.getFullYear() &&
                    item.date.getMonth() === today.getMonth() &&
                    item.date.getDate() === today.getDate();

                  const dayKey = `${item.date.getFullYear()}-${item.date.getMonth()}-${item.date.getDate()}`;
                  const dayEvents = eventsByDay.get(dayKey) || [];
                  const hasEvents = dayEvents.length > 0;

                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.gridCell,
                        {
                          borderColor: colors.outlineVariant,
                          backgroundColor: isSelected
                            ? colors.primary
                            : isToday
                            ? colors.surfaceContainerHighest
                            : colors.surface,
                        },
                      ]}
                      onPress={() => onSelectDate(item.date)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.gridCellNumber,
                          {
                            color: isSelected
                              ? colors.onPrimary
                              : !item.isCurrentMonth
                              ? colors.outline
                              : colors.onSurface,
                            fontWeight: isSelected || isToday ? '700' : '500',
                          },
                        ]}
                      >
                        {String(item.dayNumber).padStart(2, '0')}
                      </Text>

                      {hasEvents && (
                        <View style={styles.eventsIndicatorBox}>
                          <View
                            style={[
                              styles.eventIndicatorDot,
                              { backgroundColor: isSelected ? colors.onPrimary : colors.primary },
                            ]}
                          />
                          {dayEvents[0] && (
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.cellEventSnippet,
                                {
                                  color: isSelected ? colors.onPrimary : colors.textSecondary,
                                },
                              ]}
                            >
                              {dayEvents[0].title}
                            </Text>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Seção Inferior: Detalhes dos Eventos da Data Selecionada */}
              <View style={styles.eventsSection}>
                <View style={styles.eventsSectionHeader}>
                  <View>
                    <Text style={[styles.eventsSectionTitle, { color: colors.onSurface }]}>
                      {selectedFormatted.toUpperCase()}
                    </Text>
                    <Text style={[styles.eventsSectionSubtitle, { color: colors.textMuted }]}>
                      {selectedDayEvents.length === 0
                        ? 'Nenhum compromisso marcado'
                        : `${selectedDayEvents.length} compromisso${selectedDayEvents.length > 1 ? 's' : ''}`}
                    </Text>
                  </View>
                </View>

                {selectedDayEvents.length === 0 ? (
                  <View
                    style={[
                      styles.emptyDayCard,
                      {
                        backgroundColor: colors.surfaceContainerLow,
                        borderColor: colors.outlineVariant,
                      },
                    ]}
                  >
                    <MaterialIcons name="event-available" size={24} color={colors.primary} />
                    <View style={styles.emptyDayTextCol}>
                      <Text style={[styles.emptyDayTitle, { color: colors.onSurface }]}>Dia Livre</Text>
                      <Text style={[styles.emptyDaySub, { color: colors.textSecondary }]}>
                        Aproveite para descansar ou adicione um novo compromisso tocando no botão +.
                      </Text>
                    </View>
                  </View>
                ) : (
                  selectedDayEvents.map((ev) => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      onDelete={onDeleteEvent || (() => {})}
                    />
                  ))
                )}
              </View>
            </ScrollView>
          ) : (
            /* Modo Tarefas Completo */
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.todosHeaderRow}>
                <Text style={[styles.todosSectionTitle, { color: colors.onSurface }]}>
                  Checklist e Pendências
                </Text>
                <Text style={[styles.todosCountText, { color: colors.textMuted }]}>
                  {todos.filter((t) => t.status === 'completed').length}/{todos.length} concluídas
                </Text>
              </View>

              {todos.length === 0 ? (
                <View
                  style={[
                    styles.emptyDayCard,
                    {
                      backgroundColor: colors.surfaceContainerLow,
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                >
                  <MaterialIcons name="checklist" size={24} color={colors.primary} />
                  <View style={styles.emptyDayTextCol}>
                    <Text style={[styles.emptyDayTitle, { color: colors.onSurface }]}>Sem tarefas</Text>
                    <Text style={[styles.emptyDaySub, { color: colors.textSecondary }]}>
                      Todas as suas tarefas estão em dia!
                    </Text>
                  </View>
                </View>
              ) : (
                <View
                  style={[
                    styles.todosListContainer,
                    {
                      backgroundColor: colors.surfaceContainerLow,
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                >
                  {todos.map((t, idx) => (
                    <TodoItem
                      key={t.id}
                      todo={t}
                      onToggle={onToggleTodo || (() => {})}
                      onDelete={onDeleteTodo || (() => {})}
                      isLast={idx === todos.length - 1}
                      grouped
                    />
                  ))}
                </View>
              )}
            </ScrollView>
          )}

          {/* FAB Inferior Flutuante */}
          {onOpenCreate && (
            <TouchableOpacity
              style={[styles.fab, { backgroundColor: colors.primary }]}
              onPress={() => {
                onClose();
                onOpenCreate();
              }}
              activeOpacity={0.85}
              accessibilityLabel="Novo evento ou tarefa"
            >
              <MaterialIcons name="add" size={28} color={colors.onPrimary} />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: MD3Shapes.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tabButtonText: {
    fontSize: 15,
  },
  todayBtn: {
    borderWidth: 1,
    borderRadius: MD3Shapes.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  todayBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 80,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthTitleText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  monthNavBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDaysRow: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  weekDayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  gridCell: {
    width: '14.28%',
    minHeight: 52,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderRadius: 8,
    borderWidth: 0.5,
    marginVertical: 1.5,
  },
  gridCellNumber: {
    fontSize: 12,
  },
  eventsIndicatorBox: {
    alignItems: 'center',
    marginTop: 2,
    width: '100%',
  },
  eventIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginBottom: 1,
  },
  cellEventSnippet: {
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: '100%',
  },
  eventsSection: {
    marginTop: 8,
    gap: 8,
  },
  eventsSectionHeader: {
    marginBottom: 4,
  },
  eventsSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  eventsSectionSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  emptyDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  emptyDayTextCol: {
    flex: 1,
    gap: 2,
  },
  emptyDayTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyDaySub: {
    fontSize: 12,
    lineHeight: 16,
  },
  todosHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  todosSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  todosCountText: {
    fontSize: 12,
  },
  todosListContainer: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
});
