import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Keyboard, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Notifications from 'expo-notifications';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { dataSync, chatPromptBus } from '../services/dataSync';
import { navigateToTab } from './navigationRef';
import { FloatingTabBar } from '../components/common/FloatingTabBar';
import { Header, HeaderPill } from '../components/common/Header';
import { ExecutiveSummariesHubView } from '../screens/ExecutiveSummariesHubView';
import { ChatScreen, ChatScreenRef } from '../screens/ChatScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { TriggersScreen } from '../screens/TriggersScreen';
import { BookingScreen } from '../screens/BookingScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { AgendaView } from '../components/home/AgendaView';
import { CreateItemModal } from '../components/calendar/CreateItemModal';
import { EditEventModal } from '../components/calendar/EditEventModal';
import { useHomeDataContext } from './HomeDataProvider';
import { useTheme } from '../context/ThemeContext';
import type { MainTabType } from '../utils/pagerNavigation';
import type { Event } from '../types';

import type { MainTabParamList } from '../AppRoot';

const Tab = createBottomTabNavigator<MainTabParamList>();

// MOB-02: FloatingTabBar vira a tabBar nativa (visibilidade segue o teclado).
const VitoTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s1 = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const s2 = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  const activeTab = state.routes[state.index].name as MainTabType;
  return (
    <FloatingTabBar
      activeTab={activeTab}
      onSelectTab={(tab: MainTabType) => navigation.navigate(tab)}
      visible={!keyboardOpen}
    />
  );
};

const ChatTabScreen: React.FC = () => {
  const { loadData } = useHomeDataContext();
  const chatRef = useRef<ChatScreenRef>(null);

  // Prompts externos vindos dos radares (§9.4: cards acionáveis).
  useEffect(() => {
    return chatPromptBus.subscribe((prompt) => {
      chatRef.current?.submitExternalPrompt(prompt);
    });
  }, []);

  return (
    <View style={styles.tabRoot}>
      <Header
        activeTab="chat"
        onPressNewChat={() => chatRef.current?.startNewChat()}
        onPressMenu={() => chatRef.current?.openHistory()}
        hideTitle
      />
      <ChatScreen ref={chatRef} onDataChanged={loadData} />
    </View>
  );
};

// Push de radar -> refresh imediato; toque na notificação -> abre Radares (§9.4).
// Push de booking (booking_appointment) -> atualiza Recebidos + Agenda;
// toque na notificação -> abre a aba Booking.
const useRadarPushSync = () => {
  const navigation = useNavigation<any>();
  useEffect(() => {
    const subReceived = Notifications.addNotificationReceivedListener((n) => {
      const data = (n.request?.content?.data || {}) as Record<string, unknown>;
      if (data.type === 'RADAR_TRIGGERED') {
        dataSync.notify('refresh_triggers');
      }
      if (data.type === 'booking_appointment' || data.type === 'meeting_vote' || data.type === 'meeting_confirmed') {
        dataSync.notify('refresh_bookings');
        dataSync.notify('refresh_events');
      }
    });
    const subResponse = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = (resp.notification.request?.content?.data || {}) as Record<string, unknown>;
      if (data.type === 'RADAR_TRIGGERED') {
        dataSync.notify('refresh_triggers');
        if (navigation) navigation.navigate('main', { screen: 'triggers' });
        else navigateToTab('triggers');
      }
      if (data.type === 'booking_appointment' || data.type === 'meeting_vote' || data.type === 'meeting_confirmed') {
        dataSync.notify('refresh_bookings');
        dataSync.notify('refresh_events');
        if (navigation) navigation.navigate('main', { screen: 'booking' });
        else navigateToTab('booking');
      }
    });
    return () => {
      subReceived.remove();
      subResponse.remove();
    };
  }, [navigation]);
};

const AgendaTabScreen: React.FC = () => {
  const home = useHomeDataContext();
  const { colors } = useTheme();
  const [createVisible, setCreateVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [createTab, setCreateTab] = useState<'event' | 'todo'>('event');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  // Central de Resumos vive na Agenda (mesma rota de antes, novo acesso).
  const [showSummaries, setShowSummaries] = useState(false);

  // Revalidação silenciosa em background ao focar na aba
  useFocusEffect(
    useCallback(() => {
      home.loadData(true);
    }, [home.loadData])
  );

  useEffect(() => {
    const s1 = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const s2 = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

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

  return (
    <View style={[styles.tabRoot, { backgroundColor: colors.surface }]}>
      <Header
        activeTab="calendar"
        align="left"
        subtitle={dateSubtitle}
        contextualActions={
          <>
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

const TasksTabScreen: React.FC = () => {
  const home = useHomeDataContext();

  // Revalidação silenciosa em background ao focar na aba
  useFocusEffect(
    useCallback(() => {
      home.loadData(true);
    }, [home.loadData])
  );

  const pendingTodos = home.todos.filter((t) => t.status !== 'completed');
  const completedList = home.todos.filter((t) => t.status === 'completed');
  const [createRequestId, setCreateRequestId] = useState(0);
  const now = Date.now();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const overdue = pendingTodos.filter((t) => {
    if (!t.due_date) return false;
    const ms = new Date(t.due_date.length === 10 ? `${t.due_date}T23:59:59` : t.due_date).getTime();
    return !Number.isNaN(ms) && ms < dayStart.getTime();
  }).length;
  const subtitle = `${pendingTodos.length} ativas · ${overdue} atrasadas · ${completedList.length} concluídas`;
  return (
    <View style={styles.tabRoot}>
      <Header
        activeTab="tasks"
        align="left"
        subtitle={subtitle}
        contextualActions={
          <HeaderPill
            label="Nova tarefa"
            onPress={() => setCreateRequestId((n) => n + 1)}
            accessibilityLabel="Criar nova tarefa"
          />
        }
      />
      <TasksScreen
        todos={home.todos}
        pendingTodos={pendingTodos}
        completedTodosList={completedList}
        completedCount={completedList.length}
        loading={home.loading}
        refreshing={home.refreshing}
        onRefresh={home.onRefresh}
        onToggleTodo={home.handleToggleTodo}
        onDeleteTodo={home.handleDeleteTodo}
        onToggleSubtask={home.handleToggleSubtask}
        onAddSubtask={home.handleAddSubtask}
        onDeleteSubtask={home.handleDeleteSubtask}
        onSaveTodoFull={home.handleCreateTodo}
        onUpdateTodoFull={home.handleUpdateTodo}
        onOpenEventCreate={() => {}}
        createRequestId={createRequestId}
      />
    </View>
  );
};

const TriggersTabScreen: React.FC = () => {
  const [inSubView, setInSubView] = useState(false);
  const [createRequestId, setCreateRequestId] = useState(0);
  return (
    <View style={styles.tabRoot}>
      <Header
        activeTab="triggers"
        align="left"
        hideTitle={inSubView}
        contextualActions={
          inSubView ? undefined : (
            <HeaderPill
              label="Novo"
              onPress={() => setCreateRequestId((n) => n + 1)}
              accessibilityLabel="Criar novo radar"
            />
          )
        }
      />
      <TriggersScreen onSubViewChange={setInSubView} createRequestId={createRequestId} />
    </View>
  );
};

const BookingTabScreen: React.FC = () => {
  const [inSubView, setInSubView] = useState(false);
  const [createRequestId, setCreateRequestId] = useState(0);
  return (
    <View style={styles.tabRoot}>
      <Header
        activeTab="booking"
        align="left"
        hideTitle={inSubView}
        contextualActions={
          inSubView ? undefined : (
            <HeaderPill
              label="Novo Link"
              onPress={() => setCreateRequestId((n) => n + 1)}
              accessibilityLabel="Criar novo link de agendamento"
            />
          )
        }
      />
      <BookingScreen onSubViewChange={setInSubView} createRequestId={createRequestId} />
    </View>
  );
};

const ProfileTabScreen: React.FC = () => {
  const home = useHomeDataContext();
  return (
    <View style={styles.tabRoot}>
      <Header
        activeTab="profile"
        align="left"
        subtitle="Conta, autonomia e integrações"
      />
      <ProfileScreen refreshing={home.refreshing} onRefresh={home.onRefresh} onDataChanged={home.loadData} />
    </View>
  );
};

export const MainTabs: React.FC = () => {
  useRadarPushSync();
  return (
    <Tab.Navigator
      initialRouteName="chat"
      backBehavior="initialRoute"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <VitoTabBar {...props} />}
    >
      <Tab.Screen name="chat" component={ChatTabScreen} options={{ tabBarAccessibilityLabel: 'Aba Chat' }} />
      <Tab.Screen name="calendar" component={AgendaTabScreen} />
      <Tab.Screen name="tasks" component={TasksTabScreen} />
      <Tab.Screen name="triggers" component={TriggersTabScreen} />
      <Tab.Screen name="booking" component={BookingTabScreen} />
      <Tab.Screen name="profile" component={ProfileTabScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabRoot: {
    flex: 1,
  },
});
