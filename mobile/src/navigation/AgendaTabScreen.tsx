import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Header, HeaderRoundButton } from '../components/common/Header';
import { ExecutiveSummariesHubView } from '../screens/ExecutiveSummariesHubView';
import { FullMonthCalendarView } from '../components/calendar/FullMonthCalendarView';
import { AgendaView } from '../components/home/AgendaView';
import { AgendaFilterModal } from '../components/calendar/AgendaFilterModal';
import { SmartActionSheetModal } from '../components/ui/SmartActionSheetModal';
import { buildAgendaSmartActions, formatEventSubtitle } from '../utils/smartActionBuilders';
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
  const [showFullCalendar, setShowFullCalendar] = useState(false);

  // Estados de busca retrátil e modal de filtros (vito-telas.html)
  const [searchOpen, setSearchOpen] = useState(false);
  const [filters, setFilters] = useState<AgendaFilterState>(DEFAULT_AGENDA_FILTER);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [actionEvent, setActionEvent] = useState<Event | null>(null);

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
    onModalChange(filterModalVisible || !!actionEvent);
  }, [filterModalVisible, actionEvent, onModalChange]);

  // Ação contextual de evento via Vito Action Sheet inteligente
  const handleEventAction = useCallback((item: Event) => {
    setActionEvent(item);
  }, []);

  const handleCreatePrompt = useCallback(() => {
    chatPromptBus.askAssistant('Qual próximo evento você quer adicionar na sua agenda?');
  }, []);

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
          onEditEvent={handleEventAction}
          onDeleteEvent={home.handleDeleteEvent}
          onCreateEvent={handleCreatePrompt}
        />
      </View>
    );
  }

  return (
    <View style={[styles.tabRoot, { backgroundColor: colors.surface }]}>
      {/* Header editorial fiel a vito-telas.html:
          - Título H1 "Agenda", subtítulo com data
          - Botões circulares no topo (.acts):
            * Lupa circular de busca
            * Botão circular de Resumos (.rb)
            * Botão circular primário com ícone Spark de IA (.rb.pri)
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
              icon="auto-awesome"
              onPress={handleCreatePrompt}
              accessibilityLabel="Pedir ao Vito: novo evento"
              variant="primary"
              size={20}
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
        onEditEvent={handleEventAction}
        onCreateEvent={handleCreatePrompt}
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

      {/* Modal de Ações Contextuais Inteligentes (Padrão Vito) */}
      <SmartActionSheetModal
        visible={!!actionEvent}
        onClose={() => setActionEvent(null)}
        tag={actionEvent?.source ? `AGENDA • ${actionEvent.source}` : 'COMPROMISSO'}
        title={actionEvent?.title || ''}
        subtitle={actionEvent ? formatEventSubtitle(actionEvent) : undefined}
        actions={
          actionEvent
            ? buildAgendaSmartActions(actionEvent, {
                onAskVitoReschedule: (prompt) => chatPromptBus.askAssistant(prompt),
                onAskVitoMoveTomorrow: (prompt) => chatPromptBus.notify(prompt),
                onAskVitoBriefing: (prompt) => chatPromptBus.notify(prompt),
                onAskVitoCancel: (prompt) => chatPromptBus.notify(prompt),
              })
            : []
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  tabRoot: {
    flex: 1,
  },
});
