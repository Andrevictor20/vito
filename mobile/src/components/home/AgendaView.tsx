import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { EventCard } from '../calendar/EventCard';
import { AgendaSearchBar } from '../calendar/AgendaSearchBar';
import { AgendaWeekStrip } from '../calendar/AgendaWeekStrip';
import {
  AgendaFilterState,
  DEFAULT_AGENDA_FILTER,
  countActiveAgendaFilters,
  filterAgendaEvents,
} from '../../utils/agendaFilter';
import type { Event } from '../../types';

interface AgendaViewProps {
  events: Event[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  dayEvents: Event[];
  upcomingEvents: Event[];
  eventDates: Set<string>;
  totalTodos: number;
  completedTodos: number;
  isTodaySelected: boolean;
  isKeyboardOpen: boolean;
  onDeleteEvent: (id: string) => void;
  onEditEvent: (ev: Event) => void;
  onCreateEvent: () => void;
  onOpenFullCalendar?: () => void;
}

// MOB-03: visão da Agenda focada nos eventos com busca e filtros completos.
export const AgendaView: React.FC<AgendaViewProps> = ({
  events,
  loading,
  refreshing,
  onRefresh,
  selectedDate,
  onSelectDate,
  dayEvents,
  upcomingEvents,
  eventDates,
  totalTodos,
  completedTodos,
  isTodaySelected,
  onDeleteEvent,
  onEditEvent,
  onCreateEvent,
  onOpenFullCalendar,
}) => {
  const { colors } = useTheme();
  const [filters, setFilters] = useState<AgendaFilterState>(DEFAULT_AGENDA_FILTER);

  const activeFilterCount = countActiveAgendaFilters(filters);
  const isFiltering = activeFilterCount > 0 || !!filters.query;

  // Eventos filtrados através do utilitário centralizado
  const filteredAllEvents = useMemo(() => {
    if (!isFiltering) return [];
    return filterAgendaEvents(events, filters);
  }, [events, filters, isFiltering]);

  const totalResultsCount = isFiltering
    ? filteredAllEvents.length
    : dayEvents.length + upcomingEvents.length;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.surface }]}
        contentContainerStyle={[styles.content, { backgroundColor: colors.surface }]}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Visão Compacta da Semana (Toque para Expandir Calendário Toki) */}
        <AgendaWeekStrip
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
          onExpandCalendar={onOpenFullCalendar || (() => {})}
          eventDates={eventDates}
        />

        {/* Barra de Busca e Filtros Completos (Apenas Modal) */}
        <AgendaSearchBar
          filters={filters}
          onFiltersChange={setFilters}
          resultCount={totalResultsCount}
        />

        {/* Seção Principal de Eventos (Foco Total nos Compromissos) */}
        <View style={styles.focusSectionContainer}>
          {loading && events.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : isFiltering ? (
            /* Visualização Filtrada */
            <>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
                  Eventos Filtrados
                </Text>
                <View style={[styles.countBadgePill, { backgroundColor: colors.primaryContainer }]}>
                  <Text style={[styles.countBadgeText, { color: colors.onPrimaryContainer }]}>
                    {filteredAllEvents.length} {filteredAllEvents.length === 1 ? 'evento' : 'eventos'}
                  </Text>
                </View>
              </View>

              {filteredAllEvents.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
                  <View style={[styles.emptyIconContainer, { backgroundColor: colors.surfaceContainerHigh }]}>
                    <MaterialIcons name="search-off" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.emptyContent}>
                    <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                      Nenhum evento encontrado
                    </Text>
                    <Text style={[styles.emptySub, { color: colors.onSurfaceVariant }]}>
                      Tente outro termo ou limpe os filtros ativos.
                    </Text>
                    <TouchableOpacity
                      onPress={() => setFilters(DEFAULT_AGENDA_FILTER)}
                      style={{ marginTop: 6 }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.clearLinkText, { color: colors.primary }]}>Limpar filtros</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                filteredAllEvents.map((ev) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    onDelete={onDeleteEvent}
                    onPress={onEditEvent}
                    onRequestDelete={onEditEvent}
                  />
                ))
              )}
            </>
          ) : (
            /* Visualização Padrão (Foco Total nos Eventos - Paridade com a Foto 2) */
            <>
              {/* Eventos de Hoje / Dia Selecionado */}
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
                  {isTodaySelected
                    ? 'Eventos de hoje'
                    : `Eventos de ${selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`}
                </Text>
                <View style={[styles.countBadgePill, { backgroundColor: colors.primaryContainer }]}>
                  <Text style={[styles.countBadgeText, { color: colors.onPrimaryContainer }]}>
                    {dayEvents.length} {dayEvents.length === 1 ? 'evento' : 'eventos'}
                  </Text>
                </View>
              </View>

              {dayEvents.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
                  <View style={[styles.emptyIconContainer, { backgroundColor: colors.surfaceContainerHigh }]}>
                    <MaterialIcons name="event-available" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.emptyContent}>
                    <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Dia Livre</Text>
                    <Text style={[styles.emptySub, { color: colors.onSurfaceVariant }]}>
                      {isTodaySelected
                        ? 'Nenhum compromisso marcado para hoje.'
                        : `Nenhum compromisso marcado para ${selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}.`}
                    </Text>
                  </View>
                </View>
              ) : (
                dayEvents.map((ev) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    onDelete={onDeleteEvent}
                    onPress={onEditEvent}
                    onRequestDelete={onEditEvent}
                  />
                ))
              )}

              {/* Próximos Compromissos na Agenda */}
              {upcomingEvents.length > 0 && (
                <View style={{ marginTop: tokens.spacing.md }}>
                  <View style={[styles.sectionHeader, { marginBottom: tokens.spacing.sm }]}>
                    <Text style={[styles.sectionTitle, { fontSize: tokens.typography.size.titleSmall, color: colors.onSurface }]}>
                      Próximos compromissos deste mês
                    </Text>
                    <View style={[styles.countBadgePill, { backgroundColor: colors.surfaceContainerHighest }]}>
                      <Text style={[styles.countBadgeText, { color: colors.onSurface }]}>
                        {upcomingEvents.length} este mês
                      </Text>
                    </View>
                  </View>
                  {upcomingEvents.map((ev) => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      onDelete={onDeleteEvent}
                      onPress={onEditEvent}
                      onRequestDelete={onEditEvent}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    padding: tokens.spacing.lg,
    paddingBottom: 150,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.md,
  },
  sectionTitle: {
    fontSize: tokens.typography.size.titleMedium,
    fontWeight: tokens.typography.weight.bold,
    letterSpacing: 0.1,
  },
  countBadgePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: MD3Shapes.full,
  },
  countBadgeText: {
    fontSize: tokens.typography.size.labelSmall,
    fontWeight: tokens.typography.weight.bold,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: MD3Shapes.largeIncreased,
    padding: tokens.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: tokens.spacing.md,
  },
  emptyIconContainer: {
    width: 38,
    height: 38,
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
  focusSectionContainer: {
    marginBottom: tokens.spacing.sm,
  },
  clearLinkText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
