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
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { EventCard } from '../calendar/EventCard';
import { AgendaWeekStrip } from '../calendar/AgendaWeekStrip';
import { VitoLoginMark } from '../login/VitoLoginMark';
import { chatPromptBus } from '../../services/dataSync';
import { navigateToTab } from '../../navigation/navigationRef';
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
  onCreateEvent: () => void;
  onOpenFullCalendar?: () => void;
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
  onOpenFullCalendar,
  filters: controlledFilters,
  onFiltersChange: controlledOnFiltersChange,
  onReserveStudyBlock,
}) => {
  const { colors, isDark } = useTheme();
  const [internalFilters, setInternalFilters] = useState<AgendaFilterState>(DEFAULT_AGENDA_FILTER);
  const [sugDismissed, setSugDismissed] = useState(false);

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

  const handleStudyBlockReservation = () => {
    setSugDismissed(true);
    if (onReserveStudyBlock) {
      onReserveStudyBlock();
    }
  };

  const handleAskVitoFreeDay = () => {
    chatPromptBus.notify('Tenho um dia livre na minha agenda. O que sugere encaixar?');
    navigateToTab('chat');
  };

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
        <AgendaWeekStrip
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
          onExpandCalendar={onOpenFullCalendar || (() => {})}
          eventDates={eventDates}
          events={events}
        />

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
                <MaterialIcons name="search-off" size={24} color={colors.muted} />
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
                  onRequestDelete={onEditEvent}
                />
              ))
            )}
          </View>
        ) : (
          /* Visualização Padrão da Agenda */
          <View style={styles.sectionContainer}>
            {/* Seção .sec do dia selecionado */}
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
                onRequestDelete={onEditEvent}
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
                onRequestDelete={onEditEvent}
              />
            ))}

            {/* Estado vazio para o dia */}
            {dayEvents.length === 0 && (
              <Text style={[styles.emptyDayText, { color: colors.muted }]}>
                Nada marcado para este dia.
              </Text>
            )}

            {/* Sugestão Inteligente do Vito (.vsug) */}
            {isTodaySelected && !sugDismissed && (
              <View
                style={[
                  styles.vsugCard,
                  {
                    backgroundColor: colors.bg,
                    borderColor: colors.line,
                  },
                ]}
              >
                <VitoLoginMark color={colors.ink} width={28} height={30} />
                <View style={styles.vsugBody}>
                  <Text style={[styles.vsugText, { color: colors.ink }]}>
                    Você está livre depois das 13:00. Quer que eu reserve um bloco de estudo?
                  </Text>
                  <View style={styles.vsugButtons}>
                    <TouchableOpacity
                      style={[styles.vsugPrimaryBtn, { backgroundColor: colors.ink }]}
                      onPress={handleStudyBlockReservation}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.vsugPrimaryBtnText, { color: colors.bg }]}>
                        Reservar
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.vsugSecondaryBtn,
                        { borderColor: colors.line, backgroundColor: 'transparent' },
                      ]}
                      onPress={() => setSugDismissed(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.vsugSecondaryBtnText, { color: colors.ink }]}>
                        Agora não
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {!isTodaySelected && dayEvents.length === 0 && (
              <View
                style={[
                  styles.vsugCard,
                  {
                    backgroundColor: colors.bg,
                    borderColor: colors.line,
                  },
                ]}
              >
                <VitoLoginMark color={colors.ink} width={28} height={30} />
                <View style={styles.vsugBody}>
                  <Text style={[styles.vsugText, { color: colors.ink }]}>
                    Dia livre. Quer que eu encaixe algo, como uma reunião ou uma tarefa?
                  </Text>
                  <View style={styles.vsugButtons}>
                    <TouchableOpacity
                      style={[styles.vsugPrimaryBtn, { backgroundColor: colors.ink }]}
                      onPress={handleAskVitoFreeDay}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.vsugPrimaryBtnText, { color: colors.bg }]}>
                        Pedir ao Vito
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Seção 'Em seguida' (.sec + .next com .db) */}
            {upcomingEvents.length > 0 && (
              <View style={styles.nextSection}>
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
                    onRequestDelete={onEditEvent}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  sectionContainer: {
    marginTop: 4,
  },
  sec: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 10,
  },
  secH2: {
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 17,
    letterSpacing: -0.34,
  },
  cntBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cntText: {
    fontFamily: tokens.typography.family.semibold,
    fontSize: 12,
  },
  emptyDayText: {
    fontFamily: tokens.typography.family.regular,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 18,
  },
  emptyFilterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  emptyFilterTitle: {
    fontFamily: tokens.typography.family.semibold,
    fontSize: 15,
  },
  emptyFilterSub: {
    fontFamily: tokens.typography.family.regular,
    fontSize: 13,
    marginTop: 2,
  },
  clearLinkText: {
    fontFamily: tokens.typography.family.semibold,
    fontSize: 13,
  },
  vsugCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginVertical: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  vsugBody: {
    flex: 1,
  },
  vsugText: {
    fontFamily: tokens.typography.family.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  vsugButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  vsugPrimaryBtn: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsugPrimaryBtnText: {
    fontFamily: tokens.typography.family.semibold,
    fontSize: 13,
  },
  vsugSecondaryBtn: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsugSecondaryBtnText: {
    fontFamily: tokens.typography.family.semibold,
    fontSize: 13,
  },
  nextSection: {
    marginTop: 10,
  },
});
