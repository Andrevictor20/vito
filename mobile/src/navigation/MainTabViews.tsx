import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { DOCK_TABS, type DockTabType } from '../components/common/FloatingTabBar';
import { Header, HeaderRoundButton } from '../components/common/Header';
import { dataSync, tabNavigationBus } from '../services/dataSync';
import { BotsScreen } from '../features/bots/screens/BotsScreen';
import { ChatScreen, ChatScreenRef } from '../features/chat/screens/ChatScreen';
import { TasksScreen } from '../features/tasks/screens/TasksScreen';
import type { MainTabType } from '../utils/navigation/pagerNavigation';
import { useHomeDataContext } from './HomeDataProvider';
import { navigationRef } from './navigationRef';

export function isDockTab(tab: MainTabType): tab is DockTabType {
  return DOCK_TABS.some((item) => item.id === tab);
}

export function getDockIndex(tab: DockTabType): number {
  const idx = DOCK_TABS.findIndex((item) => item.id === tab);
  return idx >= 0 ? idx : 0;
}

export function getDockTabAt(index: number): DockTabType {
  if (index <= 0) return DOCK_TABS[0].id;
  if (index >= DOCK_TABS.length - 1) return DOCK_TABS[DOCK_TABS.length - 1].id;
  return DOCK_TABS[index].id;
}

export function getInitials(name?: string | null): string {
  const clean = (name || '').trim();
  if (!clean) return 'AV';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function tryNavigateStackRoute(routeName: string): boolean {
  if (!navigationRef.isReady()) return false;
  try {
    const nav = navigationRef as unknown as {
      navigate: (name: string, params?: Record<string, unknown>) => void;
      getRootState?: () => { routeNames?: string[] } | undefined;
      getState?: () => { routeNames?: string[] } | undefined;
    };
    const rootState = nav.getRootState?.();
    const state = rootState?.routeNames ? rootState : nav.getState?.();
    if (state?.routeNames && state.routeNames.includes(routeName)) {
      nav.navigate(routeName);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export const ChatTabScreen: React.FC<{
  chatRef: React.RefObject<ChatScreenRef | null>;
  onKeyboardStateChange: (open: boolean) => void;
  unreadNotificationsCount: number;
  profileInitials: string;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
}> = ({
  chatRef,
  onKeyboardStateChange,
  unreadNotificationsCount,
  profileInitials,
  onOpenNotifications,
  onOpenProfile,
}) => {
  const { loadData } = useHomeDataContext();

  return (
    <View style={tabStyles.tabRoot}>
      <Header
        activeTab="chat"
        title="Conversas"
        onPressNewChat={() => chatRef.current?.startNewChat()}
        onPressMenu={() => chatRef.current?.openHistory()}
        onPressNotifications={onOpenNotifications}
        unreadNotificationsCount={unreadNotificationsCount}
        onPressProfile={onOpenProfile}
        profileInitials={profileInitials}
      />
      <ChatScreen
        ref={chatRef}
        onDataChanged={loadData}
        onKeyboardStateChange={onKeyboardStateChange}
      />
    </View>
  );
};

export const useRadarPushSync = (onSelectTab: (tab: MainTabType) => void) => {
  useEffect(() => {
    const subReceived = Notifications.addNotificationReceivedListener((n) => {
      const data = (n.request?.content?.data || {}) as Record<string, unknown>;
      if (data.type === 'RADAR_TRIGGERED') {
        dataSync.notify('refresh_triggers');
      }
      if (
        data.type === 'booking_appointment' ||
        data.type === 'meeting_vote' ||
        data.type === 'meeting_confirmed'
      ) {
        dataSync.notify('refresh_bookings');
        dataSync.notify('refresh_events');
      }
    });
    const subResponse = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = (resp.notification.request?.content?.data || {}) as Record<string, unknown>;
      if (data.type === 'RADAR_TRIGGERED') {
        dataSync.notify('refresh_triggers');
        onSelectTab('triggers');
      }
      if (
        data.type === 'booking_appointment' ||
        data.type === 'meeting_vote' ||
        data.type === 'meeting_confirmed'
      ) {
        dataSync.notify('refresh_bookings');
        dataSync.notify('refresh_events');
        onSelectTab('booking');
      }
    });
    return () => {
      subReceived.remove();
      subResponse.remove();
    };
  }, [onSelectTab]);
};

export const TasksTabScreen: React.FC = () => {
  const home = useHomeDataContext();
  const pendingTodos = home.todos.filter((t) => t.status !== 'completed');
  const completedList = home.todos.filter((t) => t.status === 'completed');
  const [createRequestId] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
    <View style={tabStyles.tabRoot}>
      <Header
        activeTab="tasks"
        align="left"
        subtitle={subtitle}
        showSearchButton={true}
        searchOpen={searchOpen}
        onToggleSearch={() => setSearchOpen((prev) => !prev)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Pesquisar tarefas..."
        contextualActions={
          <HeaderRoundButton
            icon="auto-awesome"
            variant="primary"
            onPress={() => tabNavigationBus.notify('chat')}
            accessibilityLabel="Pedir ao Vito: nova tarefa"
            size={20}
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
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchOpen={searchOpen}
      />
    </View>
  );
};

export const BotsTabScreen: React.FC<{
  onSubViewChange: (inSubView: boolean) => void;
}> = ({ onSubViewChange }) => {
  const [inSubView, setInSubView] = useState(false);
  const [subtitle, setSubtitle] = useState('Mini assistentes, cada um com uma função só');
  const [createRequestId, setCreateRequestId] = useState(0);

  const handleSubViewChange = (sub: boolean) => {
    setInSubView(sub);
    onSubViewChange(sub);
  };

  return (
    <View style={tabStyles.tabRoot}>
      <Header
        activeTab="triggers"
        align="left"
        subtitle={subtitle}
        hideTitle={inSubView}
        contextualActions={
          inSubView ? undefined : (
            <HeaderRoundButton
              icon="auto-awesome"
              variant="primary"
              onPress={() => setCreateRequestId((n) => n + 1)}
              accessibilityLabel="Novo bot"
              size={20}
            />
          )
        }
      />
      <BotsScreen
        onSubViewChange={handleSubViewChange}
        onSubtitleChange={setSubtitle}
        createRequestId={createRequestId}
      />
    </View>
  );
};

const tabStyles = StyleSheet.create({
  tabRoot: { flex: 1 },
});
