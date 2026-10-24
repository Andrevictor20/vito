import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Header, HeaderRoundButton } from '../components/common/Header';
import { ExecutiveSummariesHubView } from '../screens/ExecutiveSummariesHubView';
import { FullMonthCalendarView } from '../components/calendar/FullMonthCalendarView';
import { AgendaView } from '../components/home/AgendaView';
import { AgendaFilterModal } from '../components/calendar/AgendaFilterModal';
import { CreateItemModal } from '../components/calendar/CreateItemModal';
import { EditEventModal } from '../components/calendar/EditEventModal';
import { useHomeDataContext } from './HomeDataProvider';
import { useTheme } from '../context/ThemeContext';
import { chatPromptBus } from '../services/dataSync';
import { navigateToTab } from './navigationRef';
import {
  AgendaFilterState,
  DEFAULT_AGENDA_FILTER,
  countActiveAgendaFilters,
  filterAgendaEvents,
} from '../utils/agendaFilter';
import type { Event } from '../types';

export interface AgendaTabScreenProps {
  onSubViewChange: (inSubView: boolean) => void;
  onModalChange: (open: boolean) => void;
  showSummaries: boolean;
  setShowSummaries: (val: boolean) => void;
  keyboardOpen: boolean;
}

export const AgendaTabScreen: React.FC<AgendaTabScreenProps> = ({
  onSubViewChange,
  onModalChange,
  showSummaries,
  setShowSummaries,
  keyboardOpen,
}) => {
  const home = useHomeDataContext();
  const { colors } = useTheme();
  const [createVisible, setCreateVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [createTab, setCreateTab] = useState<'event' | 'todo'>('event');
  const [showFullCalendar, setShowFullCalendar] = useState(false);

  // Estados de busca retrátil e modal de filtros (vito-telas.html)
  const [searchOpen, setSearchOpen] = useState(false);
  const [filters, setFilters] = useState<AgendaFilterState>(DEFAULT_AGENDA_FILTER);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const activeFilterCount = countActiveAgendaFilters(filters);
  const isFiltering = activeFilterCount > 0 || !!filters.query;

  const totalResultsCount = useMemo(() => {
    if (isFiltering) {
      return filterAgendaEvents(home.events, filters).length;
    }
    return home.dayEvents.length + home.upcomingEvents.length;
  }, [home.events, home.dayEvents, home.upcomingEvents, filters, isFiltering]);

  useEffect(() => {
    onSubViewChange(showSummaries || showFullCalendar);
  }, [showSummaries, showFullCalendar, onSubViewChange]);

  useEffect(() => {
    onModalChange(createVisible || editVisible || filterModalVisible);
  }, [createVisible, editVisible, filterModalVisible, onModalChange]);

  // Subtítulo editorial em português com a data de hoje: ex. "sexta-feira, 23 de outubro"
  const dateSubtitle = useMemo(() => {
    const today = new Date();
    return today.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }, []);

  if (showSummaries) {
    return (
      <View style={[styles.tabRoot, { backgroundColor: colors.surface }]}>
        <ExecutiveSummariesHubView
          onBack={() => setShowSummaries(false)}
          onOpenChatWithPrompt={(prompt) => {
            chatPromptBus.notify(prompt);
            navigateToTab('chat');
          }}
        />
      </View>
    );
  }

  if (showFullCalendar) {
    return (
      <View style={[styles.tabRoot, { backgroundColor: colors.surface }]}>
        <FullMonthCalendarView
          selectedDate={home.selectedDate}
          onSelectDate={home.setSelectedDate}
          onBack={() => setShowFullCalendar(false)}
          events={home.events}
          dayEvents={home.dayEvents}
          eventDates={home.eventDates}
          totalTodos={home.todos.length}
          completedTodos={home.todos.filter((t) => t.status === 'completed').length}
          onEditEvent={(item) => {
            setEditingEvent(item);
            setEditVisible(true);
          }}
          onDeleteEvent={home.handleDeleteEvent}
          onCreateEvent={() => {
            setCreateTab('event');
            setCreateVisible(true);
          }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.tabRoot, { backgroundColor: colors.surface }]}>
      {/* Header editorial fiel a vito-telas.html:
          - Título H1 "Agenda", subtítulo com data ("sexta-feira, 23 de outubro")
          - Botões circulares no topo (.acts):
            * Lupa circular que expande a barra retrátil de busca com botão tune para filtros avançados
            * Botão circular de Resumos (.rb)
            * Botão circular primário (+) de novo evento (.rb.pri)
      */}
      <Header
        activeTab="calendar"
        align="left"
        subtitle={dateSubtitle}
        showSearchButton={true}
        searchOpen={searchOpen}
        onToggleSearch={() => setSearchOpen((prev) => !prev)}
        searchQuery={filters.query}
        onSearchChange={(q) => setFilters((f) => ({ ...f, query: q }))}
        searchPlaceholder="Pesquisar eventos, locais..."
        onPressFilter={() => setFilterModalVisible(true)}
        hasActiveFilters={activeFilterCount > 0}
        contextualActions={
          <>
            <HeaderRoundButton
              icon="bar-chart"
              onPress={() => setShowSummaries(true)}
              accessibilityLabel="Resumos"
              variant="default"
              size={20}
            />
            <HeaderRoundButton
              icon="add"
              onPress={() => {
                setCreateTab('event');
                setCreateVisible(true);
              }}
              accessibilityLabel="Novo evento"
              variant="primary"
              size={22}
            />
          </>
        }
      />

      <AgendaView
        events={home.events}
        loading={home.loading}
        refreshing={home.refreshing}
        onRefresh={home.onRefresh}
        selectedDate={home.selectedDate}
        onSelectDate={home.setSelectedDate}
        dayEvents={home.dayEvents}
        upcomingEvents={home.upcomingEvents}
        eventDates={home.eventDates}
        totalTodos={home.todos.length}
        completedTodos={home.todos.filter((t) => t.status === 'completed').length}
        isTodaySelected={home.isTodaySelected}
        isKeyboardOpen={keyboardOpen}
        onDeleteEvent={home.handleDeleteEvent}
        onEditEvent={(item) => {
          setEditingEvent(item);
          setEditVisible(true);
        }}
        onCreateEvent={() => {
          setCreateTab('event');
          setCreateVisible(true);
        }}
        onOpenFullCalendar={() => setShowFullCalendar(true)}
        filters={filters}
        onFiltersChange={setFilters}
        onReserveStudyBlock={async () => {
          const start = new Date(home.selectedDate);
          start.setHours(14, 0, 0, 0);
          const end = new Date(home.selectedDate);
          end.setHours(16, 0, 0, 0);
          await home.handleCreateEvent({
            title: 'Bloco de estudo',
            start_at: start.toISOString(),
            end_at: end.toISOString(),
          });
        }}
      />

      {/* Modal de Filtros Avançados da Agenda */}
      <AgendaFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={filters}
        onFiltersChange={setFilters}
        resultCount={totalResultsCount}
      />

      {/* Modal de Criação de Evento */}
      <CreateItemModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        selectedDate={home.selectedDate}
        events={home.events}
        fixedTab={createTab}
        onSaveEvent={async (title, _priority, startISO, endISO) => {
          const start = startISO ? new Date(startISO) : new Date(home.selectedDate);
          if (!startISO) start.setHours(9, 0, 0, 0);
          const end = endISO ? new Date(endISO) : new Date(home.selectedDate);
          if (!endISO) end.setHours(10, 0, 0, 0);
          await home.handleCreateEvent({
            title,
            start_at: start.toISOString(),
            end_at: end.toISOString(),
          });
        }}
        onSaveTodo={async (title, priority, eventId, eventTitle) => {
          await home.handleCreateTodo({
            title,
            priority,
            due_date: home.selectedDate.toISOString(),
            event_id: eventId,
            event_title: eventTitle,
          });
        }}
      />

      {/* Modal de Edição de Evento */}
      <EditEventModal
        visible={editVisible}
        onClose={() => {
          setEditVisible(false);
          setEditingEvent(null);
        }}
        event={editingEvent}
        onSave={home.handleUpdateEvent}
        onDelete={home.handleDeleteEvent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  tabRoot: {
    flex: 1,
  },
});
