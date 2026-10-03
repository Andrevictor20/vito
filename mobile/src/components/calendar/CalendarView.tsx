import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { Event } from '../../types';
import { CalendarTopBar, CalendarViewMode } from './CalendarTopBar';
import { CalendarGrid } from './CalendarGrid';

export { CalendarViewMode };

interface CalendarViewProps {
  events: Event[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  viewMode?: CalendarViewMode;
  onChangeViewMode?: (mode: CalendarViewMode) => void;
  onSearchQuery?: (q: string) => void;
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

interface CalendarDayItem {
  dayNumber: number;
  isCurrentMonth: boolean;
  date: Date;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  selectedDate,
  onSelectDate,
  viewMode: controlledViewMode,
  onChangeViewMode,
  onSearchQuery,
  selectedCategory = 'all',
  onSelectCategory,
}) => {
  const [localViewMode, setLocalViewMode] = useState<CalendarViewMode>('month');
  const activeViewMode = controlledViewMode || localViewMode;

  const [isExpanded, setIsExpanded] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState(selectedCategory);

  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const jumpToToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    onSelectDate(today);
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (d: Date) => {
    return (
      d.getDate() === selectedDate.getDate() &&
      d.getMonth() === selectedDate.getMonth() &&
      d.getFullYear() === selectedDate.getFullYear()
    );
  };

  const getDayEvents = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = y + '-' + m + '-' + day;
    return events.filter((e) => {
      const startDay = e.start_at.substring(0, 10);
      const endDay = e.end_at.substring(0, 10);
      return dateStr >= startDay && dateStr <= endDay;
    });
  };

  const setView = (mode: CalendarViewMode) => {
    setLocalViewMode(mode);
    if (onChangeViewMode) onChangeViewMode(mode);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (onSearchQuery) onSearchQuery(text);
  };

  const handleCategorySelect = (cat: string) => {
    setActiveCategory(cat);
    if (onSelectCategory) onSelectCategory(cat);
  };

  // Construir grade completa
  const allDaysGrid: CalendarDayItem[] = [];

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    allDaysGrid.push({
      dayNumber: d,
      isCurrentMonth: false,
      date: new Date(year, month - 1, d),
    });
  }

  for (let d = 1; d <= totalDaysInMonth; d++) {
    allDaysGrid.push({
      dayNumber: d,
      isCurrentMonth: true,
      date: new Date(year, month, d),
    });
  }

  const remainingCells = 7 - (allDaysGrid.length % 7);
  if (remainingCells < 7) {
    for (let d = 1; d <= remainingCells; d++) {
      allDaysGrid.push({
        dayNumber: d,
        isCurrentMonth: false,
        date: new Date(year, month + 1, d),
      });
    }
  }

  // Filtragem por visualização de Semana vs Mês
  let displayedGrid = allDaysGrid;
  if (activeViewMode === 'week') {
    // Localiza a semana do dia selecionado
    const selectedIdx = allDaysGrid.findIndex((item) => isSelected(item.date));
    const weekStartIdx = selectedIdx >= 0 ? Math.floor(selectedIdx / 7) * 7 : 0;
    displayedGrid = allDaysGrid.slice(weekStartIdx, weekStartIdx + 7);
  }

  return (
    <View style={styles.card}>
      {/* 1. Barra de Controles Topo (Segmentos, Busca e Filtros Stitch) */}
      <CalendarTopBar
        activeViewMode={activeViewMode}
        onChangeViewMode={setView}
        searchVisible={searchVisible}
        onToggleSearch={() => setSearchVisible(!searchVisible)}
        searchQuery={searchQuery}
        onSearchChange={handleSearch}
        filterVisible={filterVisible}
        onToggleFilter={() => setFilterVisible(!filterVisible)}
        activeCategory={activeCategory}
        onSelectCategory={handleCategorySelect}
      />

      {/* 2. Month Bar & Expand Option (Stitch Lines 35-48) */}
      {activeViewMode !== 'todos' && (
        <>
          <View style={styles.header}>
            <View style={styles.headerTitleGroup}>
              <TouchableOpacity style={styles.navButton} onPress={prevMonth} hitSlop={tokens.hitSlop.sm}>
                <MaterialIcons name="chevron-left" size={22} color={tokens.colors.textSecondary} />
              </TouchableOpacity>

              <Text style={styles.monthTitle}>
                {MONTH_NAMES[month]} {year}
              </Text>

              <TouchableOpacity style={styles.navButton} onPress={nextMonth} hitSlop={tokens.hitSlop.sm}>
                <MaterialIcons name="chevron-right" size={22} color={tokens.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.headerRightGroup}>
              <TouchableOpacity style={styles.todayButton} onPress={jumpToToday} activeOpacity={0.75}>
                <Text style={styles.todayButtonText}>Hoje</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.expandBtn, isExpanded && styles.expandBtnActive]}
                onPress={() => setIsExpanded(!isExpanded)}
                accessibilityLabel={isExpanded ? 'Visualização normal' : 'Visualização expandida'}
              >
                <MaterialIcons
                  name={isExpanded ? 'close-fullscreen' : 'open-in-full'}
                  size={16}
                  color={isExpanded ? tokens.colors.primary : tokens.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Dias da semana */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, idx) => (
              <Text key={idx} style={styles.weekText}>
                {w}
              </Text>
            ))}
          </View>

          {/* Grade de Dias Modular */}
          <CalendarGrid
            days={displayedGrid}
            isExpanded={isExpanded}
            isSelected={isSelected}
            isToday={isToday}
            getDayEvents={getDayEvents}
            onSelectDate={onSelectDate}
          />

          {/* Legenda de Categorias Stitch */}
          <View style={styles.legendRow}>
            <View style={styles.legendLeft}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: tokens.colors.primary }]} />
                <Text style={styles.legendText}>Liderança</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: tokens.colors.tertiary }]} />
                <Text style={styles.legendText}>Foco</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: tokens.colors.secondary }]} />
                <Text style={styles.legendText}>Pessoal</Text>
              </View>
            </View>
            <Text style={styles.syncMetaText}>Google • Apple</Text>
          </View>
        </>
      )}

      {activeViewMode === 'todos' && (
        <View style={styles.todosModeContainer}>
          <MaterialIcons name="checklist" size={24} color={tokens.colors.primary} />
          <Text style={styles.todosModeTitle}>Visualização de Tarefas Ativa</Text>
          <Text style={styles.todosModeSub}>
            Veja a lista completa de pendências e prioridades logo abaixo na sua agenda executiva.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
  },
  todosModeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.md,
    gap: 6,
  },
  todosModeTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.textPrimary,
  },
  todosModeSub: {
    fontSize: tokens.typography.size.xs,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.xs,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  monthTitle: {
    fontSize: tokens.typography.size.sm + 1,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.textPrimary,
  },
  navButton: {
    padding: 2,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  todayButton: {
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  todayButtonText: {
    fontSize: 11,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.primary,
  },
  expandBtn: {
    width: 28,
    height: 28,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  expandBtnActive: {
    backgroundColor: tokens.colors.primaryLight,
    borderColor: tokens.colors.primary,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.outlineVariant,
    marginBottom: tokens.spacing.xs,
  },
  weekText: {
    flex: 1,
    textAlign: 'center',
    fontSize: tokens.typography.size.xs,
    color: tokens.colors.outline,
    fontWeight: tokens.typography.weight.semibold,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: tokens.spacing.sm,
    paddingTop: tokens.spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.outlineVariant,
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: tokens.radii.full,
  },
  legendText: {
    fontSize: 10,
    color: tokens.colors.textSecondary,
    fontWeight: tokens.typography.weight.medium,
  },
  syncMetaText: {
    fontSize: 10,
    color: tokens.colors.outline,
  },
});
