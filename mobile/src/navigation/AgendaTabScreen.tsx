import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Header, HeaderPill } from '../components/common/Header';
import { ExecutiveSummariesHubView } from '../screens/ExecutiveSummariesHubView';
import { FullMonthCalendarView } from '../components/calendar/FullMonthCalendarView';
import { AgendaView } from '../components/home/AgendaView';
import { CreateItemModal } from '../components/calendar/CreateItemModal';
import { EditEventModal } from '../components/calendar/EditEventModal';
import { useHomeDataContext } from './HomeDataProvider';
import { useTheme } from '../context/ThemeContext';
import { chatPromptBus } from '../services/dataSync';
import { navigateToTab } from './navigationRef';
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

  useEffect(() => {
    onSubViewChange(showSummaries || showFullCalendar);
  }, [showSummaries, showFullCalendar, onSubViewChange]);

  useEffect(() => {
    onModalChange(createVisible || editVisible);
  }, [createVisible, editVisible, onModalChange]);

  const dateSubtitle = home.selectedDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

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
      <Header
        activeTab="calendar"
        align="left"
        subtitle={dateSubtitle}
        contextualActions={
          <>
            <HeaderPill
              label="Calendário"
              variant="ghost"
              icon="calendar-month"
              onPress={() => setShowFullCalendar(true)}
              accessibilityLabel="Abrir visão do mês em tela cheia"
            />
            <HeaderPill
              label="Resumos"
              variant="ghost"
              icon="bar-chart"
              onPress={() => setShowSummaries(true)}
              accessibilityLabel="Abrir Central de Resumos"
            />
            <HeaderPill
              label="Evento"
              onPress={() => {
                setCreateTab('event');
                setCreateVisible(true);
              }}
              accessibilityLabel="Criar novo evento"
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
      />
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
