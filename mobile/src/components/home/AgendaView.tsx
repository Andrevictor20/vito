import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { ExecutiveMonthCalendarCard } from './ExecutiveMonthCalendarCard';
import { EventCard } from '../calendar/EventCard';
import { AgendaSearchBar, AgendaPeriodFilter } from '../calendar/AgendaSearchBar';
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
}

// MOB-03: visão da Agenda extraída do HomeScreen (container fica só com roteamento).
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
}) => {
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState<AgendaPeriodFilter>('all');

  const query = searchQuery.trim().toLowerCase();
  const matchesQuery = (ev: Event) =>
    !query ||
    ev.title.toLowerCase().includes(query) ||
    (ev.location || '').toLowerCase().includes(query);
  const matchesPeriod = (ev: Event) => {
    if (period === 'all') return true;
    const ms = new Date(ev.start_at).getTime();
    if (Number.isNaN(ms)) return false;
    const now = new Date();
    if (period === 'today') {
      const d = new Date(ms);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }
    // week: hoje + próximos 7 dias
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = start.getTime() + 7 * 24 * 3600 * 1000;
    return ms >= start.getTime() && ms < end;
  };
  const filteredDay = useMemo(
    () => dayEvents.filter((ev) => matchesQuery(ev)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayEvents, query]
  );
  const filteredUpcoming = useMemo(
    () => upcomingEvents.filter((ev) => matchesQuery(ev) && matchesPeriod(ev)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [upcomingEvents, query, period]
  );
  const searching = query.length > 0 || period !== 'all';

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
        <ExecutiveMonthCalendarCard
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
          dayEvents={dayEvents}
          totalTodos={totalTodos}
          completedTodos={completedTodos}
          eventDates={eventDates}
        />

        <AgendaSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          period={period}
          onPeriodChange={setPeriod}
          resultCount={filteredDay.length + filteredUpcoming.length}
        />

        <View style={styles.focusSectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
              {isTodaySelected
                ? 'Eventos de hoje'
                : `Eventos de ${selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`}
            </Text>
            <View style={[styles.countBadgePill, { backgroundColor: colors.primaryContainer }]}>
              <Text style={[styles.countBadgeText, { color: colors.onPrimaryContainer }]}>
                {filteredDay.length} {filteredDay.length === 1 ? 'evento' : 'eventos'}
              </Text>
            </View>
          </View>

          {loading && events.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : filteredDay.length === 0 ? (
            <>
              <View style={[styles.emptyCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
                <View style={[styles.emptyIconContainer, { backgroundColor: colors.surfaceContainerHigh }]}>
                  <MaterialIcons name={searching ? 'search-off' : 'event-available'} size={20} color={colors.primary} />
                </View>
                <View style={styles.emptyContent}>
                  <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                    {searching ? `Nada para "${searchQuery.trim()}"` : 'Dia Livre'}
                  </Text>
                  <Text style={[styles.emptySub, { color: colors.onSurfaceVariant }]}>
                    {searching
                      ? 'Tente outro termo ou limpe a busca.'
                      : isTodaySelected
                      ? 'Nenhum compromisso marcado para hoje.'
                      : `Nenhum compromisso marcado para ${selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}.`}
                  </Text>
                </View>
              </View>

              {filteredUpcoming.length > 0 && (
                <View style={{ marginTop: tokens.spacing.md }}>
                  <View style={[styles.sectionHeader, { marginBottom: tokens.spacing.sm }]}>
                    <Text style={[styles.sectionTitle, { fontSize: tokens.typography.size.titleSmall, color: colors.onSurface }]}>
                      Próximos compromissos na agenda
                    </Text>
                    <View style={[styles.countBadgePill, { backgroundColor: colors.surfaceContainerHighest }]}>
                      <Text style={[styles.countBadgeText, { color: colors.onSurface }]}>
                        {filteredUpcoming.length} no total
                      </Text>
                    </View>
                  </View>
                  {filteredUpcoming.slice(0, 5).map((ev) => (
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
          ) : (
            filteredDay.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                onDelete={onDeleteEvent}
                onPress={onEditEvent}
                onRequestDelete={onEditEvent}
              />
            ))
          )}
        </View>
      </ScrollView>
      {/* CTA vive no Header (+ Evento); sem FAB sobre a lista. */}
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
  fabOverlay: {
    position: 'absolute',
    right: 16,
    bottom: 96,
    zIndex: 50,
    alignItems: 'flex-end',
  },
  createFab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: MD3Shapes.full,
    ...tokens.shadows.level3,
  },
  createFabText: {
    fontSize: tokens.typography.size.labelLarge,
    fontWeight: tokens.typography.weight.bold,
    letterSpacing: 0.2,
  },
});
