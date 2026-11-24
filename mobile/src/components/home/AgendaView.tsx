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
import { ProtoUiIcon } from '../../icons/ProtoUiIcons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { StaggerItem } from '../../theme/vitoMotion';
import { EventCard } from '../calendar/EventCard';
import { AgendaWeekStrip } from '../calendar/AgendaWeekStrip';
import { AgendaSummariesCard } from '../calendar/AgendaSummariesCard';
import {
  AgendaFilterState,
  DEFAULT_AGENDA_FILTER,
  countActiveAgendaFilters,
  filterAgendaEvents,
} from '../../utils/agendaFilter';
import { isAllDayEvent } from '../../utils/calendarDateUtils';
import type { Event } from '../../types';

export interface AgendaViewProps {
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
  onAiEvent?: (ev: Event) => void;
  onCreateEvent: () => void;
  onOpenFullCalendar?: () => void;
  onOpenSummaries?: () => void;
  filters?: AgendaFilterState;
  onFiltersChange?: (f: AgendaFilterState) => void;
  onReserveStudyBlock?: () => void;
}

const DF_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * AgendaView fiel a vito-telas.html:
 * - Faixa semanal .strip com navegação mensal .mh e círculos de 36x36px.
 * - Seção .sec com título em Montserrat 800 e badge .cnt.
 * - Eventos de dia inteiro (.allday) e com hora (.ev com .tm e .evc).
 * - Sugestão inteligente do Vito (.vsug) com botões "Reservar" / "Agora não".
 * - Seção 'Em seguida' com badge e blocos de data (.db, 42x46px).
 */
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
  isTodaySelected,
  onDeleteEvent,
  onEditEvent,
  onAiEvent,
  onOpenFullCalendar,
  onOpenSummaries,
  filters: controlledFilters,
  onFiltersChange: controlledOnFiltersChange,
}) => {
  const { colors, isDark } = useTheme();
  const [internalFilters, setInternalFilters] = useState<AgendaFilterState>(DEFAULT_AGENDA_FILTER);

  const filters = controlledFilters ?? internalFilters;
  const setFilters = controlledOnFiltersChange ?? setInternalFilters;

  const activeFilterCount = countActiveAgendaFilters(filters);
  const isFiltering = activeFilterCount > 0 || !!filters.query;

  // Eventos filtrados através do utilitário centralizado
  const filteredAllEvents = useMemo(() => {
    if (!isFiltering) return [];
    return filterAgendaEvents(events, filters);
  }, [events, filters, isFiltering]);

  // Separação de eventos do dia: dia inteiro (.allday) e horários fixos (.ev)
  const allDayEvents = useMemo(() => {
    return dayEvents.filter((ev) => isAllDayEvent(ev));
  }, [dayEvents]);

  const timedEvents = useMemo(() => {
    return dayEvents.filter((ev) => !isAllDayEvent(ev));
  }, [dayEvents]);

  // Título da seção do dia
  const daySectionTitle = isTodaySelected
    ? `Hoje, ${selectedDate.getDate()}`
    : `${DF_SHORT[selectedDate.getDay()]}, ${selectedDate.getDate()}`;

  // Badge da quantidade de eventos
  const dayBadgeText =
    dayEvents.length > 0
      ? `${dayEvents.length} ${dayEvents.length > 1 ? 'eventos' : 'evento'}`
      : 'Dia livre';

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
            tintColor={colors.blue}
          />
        }
      >
        {/* Faixa semanal / Navegação mensal (.strip) */}
        <StaggerItem index={0}>
          <AgendaWeekStrip
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            onExpandCalendar={onOpenFullCalendar || (() => {})}
            eventDates={eventDates}
            events={events}
          />
        </StaggerItem>

        {/* Conteúdo Principal */}
        {loading && events.length === 0 ? (
          <ActivityIndicator color={colors.blue} style={{ marginVertical: 24 }} />
        ) : isFiltering ? (
          /* Visualização de Resultados Filtrados */
          <View style={styles.sectionContainer}>
            <View style={styles.sec}>
              <Text style={[styles.secH2, { color: colors.ink }]}>
                Eventos Filtrados
              </Text>
              <View style={[styles.cntBadge, { backgroundColor: colors.surf }]}>
                <Text style={[styles.cntText, { color: colors.muted }]}>
                  {filteredAllEvents.length} {filteredAllEvents.length === 1 ? 'evento' : 'eventos'}
                </Text>
              </View>
            </View>

            {filteredAllEvents.length === 0 ? (
              <View
                style={[
                  styles.emptyFilterCard,
                  {
                    backgroundColor: colors.surf,
                    borderColor: colors.line,
                  },
                ]}
              >
                <ProtoUiIcon name="search-off" size={24} color={colors.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.emptyFilterTitle, { color: colors.ink }]}>
                    Nenhum evento encontrado
                  </Text>
                  <Text style={[styles.emptyFilterSub, { color: colors.muted }]}>
                    Tente outro termo ou limpe os filtros ativos.
                  </Text>
                  <TouchableOpacity
                    onPress={() => setFilters(DEFAULT_AGENDA_FILTER)}
                    style={{ marginTop: 6 }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.clearLinkText, { color: colors.blue }]}>
                      Limpar filtros
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              filteredAllEvents.map((ev) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  showDateBadge={true}
                  onDelete={onDeleteEvent}
                  onPress={onEditEvent}
                  onAiAction={onAiEvent || onEditEvent}
                />
              ))
            )}
          </View>
        ) : (
          /* Visualização Padrão da Agenda */
          <View style={styles.sectionContainer}>
            {/* Seção .sec do dia selecionado */}
            <StaggerItem index={1}>
            <View style={styles.sec}>
              <Text style={[styles.secH2, { color: colors.ink }]}>
                {daySectionTitle}
              </Text>
              <View style={[styles.cntBadge, { backgroundColor: colors.surf }]}>
                <Text style={[styles.cntText, { color: colors.muted }]}>
                  {dayBadgeText}
                </Text>
              </View>
            </View>

            {/* Eventos de dia inteiro (.allday) */}
            {allDayEvents.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                variant="day"
                onDelete={onDeleteEvent}
                onPress={onEditEvent}
                onAiAction={onAiEvent || onEditEvent}
              />
            ))}

            {/* Eventos com hora (.ev com .tm e .evc) */}
            {timedEvents.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                variant="day"
                onDelete={onDeleteEvent}
                onPress={onEditEvent}
                onAiAction={onAiEvent || onEditEvent}
              />
            ))}

            {/* Estado vazio para o dia */}
            {dayEvents.length === 0 && (
              <Text style={[styles.emptyDayText, { color: colors.muted }]}>
                Nada marcado para este dia.
              </Text>
            )}
            </StaggerItem>

            {/* Card Resumos da semana (.vsum do protótipo) */}
            {onOpenSummaries && (
              <StaggerItem index={3}>
                <AgendaSummariesCard eventsCount={events.length} onPress={onOpenSummaries} />
              </StaggerItem>
            )}

            {/* Seção 'Em seguida' (.sec + .next com .db) */}
            {upcomingEvents.length > 0 && (
              <StaggerItem index={4} style={styles.nextSection}>
                <View style={styles.sec}>
                  <Text style={[styles.secH2, { color: colors.ink }]}>
                    Em seguida
                  </Text>
                  <View style={[styles.cntBadge, { backgroundColor: colors.surf }]}>
                    <Text style={[styles.cntText, { color: colors.muted }]}>
                      {upcomingEvents.length} neste mês
                    </Text>
                  </View>
                </View>

                {upcomingEvents.slice(0, 5).map((ev) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    variant="next"
                    onDelete={onDeleteEvent}
                    onPress={onEditEvent}
                    onAiAction={onAiEvent || onEditEvent}
                  />
                ))}
              </StaggerItem>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120, maxWidth: 640, width: '100%', alignSelf: 'center' },
  sectionContainer: { marginTop: 4 },
  sec: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 10 },
  secH2: { fontFamily: tokens.typography.family.montserratBold, fontSize: 17, letterSpacing: -0.34 },
  cntBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  cntText: { fontFamily: tokens.typography.family.semibold, fontSize: 12 },
  emptyDayText: { fontFamily: tokens.typography.family.regular, fontSize: 14, textAlign: 'center', paddingVertical: 18 },
  emptyFilterCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 8 },
  emptyFilterTitle: { fontFamily: tokens.typography.family.semibold, fontSize: 15 },
  emptyFilterSub: { fontFamily: tokens.typography.family.regular, fontSize: 13, marginTop: 2 },
  clearLinkText: { fontFamily: tokens.typography.family.semibold, fontSize: 13 },
  nextSection: { marginTop: 10 },
});
