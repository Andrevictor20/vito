import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Keyboard, Platform, BackHandler, useWindowDimensions, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { dataSync, chatPromptBus, tabNavigationBus, pagerSwipeLockBus } from '../services/dataSync';
import { navigateToTab } from './navigationRef';
import { FloatingTabBar } from '../components/common/FloatingTabBar';
import { Header, HeaderPill, HeaderRoundButton } from '../components/common/Header';
import { AdaptivePager, AdaptivePagerRef } from '../components/common/AdaptivePager';
import { ChatScreen, ChatScreenRef } from '../screens/ChatScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { TriggersScreen } from '../screens/TriggersScreen';
import { BookingScreen } from '../screens/BookingScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { AgendaTabScreen } from './AgendaTabScreen';
import { useHomeDataContext } from './HomeDataProvider';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../theme/motion';
import {
  MainTabType,
  getIndexForTab,
  getTabForIndex,
  shouldPreventSwipe,
  determineBackAction,
} from '../utils/pagerNavigation';


const ChatTabScreen: React.FC<{
  chatRef: React.RefObject<ChatScreenRef | null>;
  onKeyboardStateChange: (open: boolean) => void;
}> = ({ chatRef, onKeyboardStateChange }) => {
  const { loadData } = useHomeDataContext();

  return (
    <View style={styles.tabRoot}>
      <Header
        activeTab="chat"
        onPressNewChat={() => chatRef.current?.startNewChat()}
        onPressMenu={() => chatRef.current?.openHistory()}
        hideTitle
      />
      <ChatScreen
        ref={chatRef}
        onDataChanged={loadData}
        onKeyboardStateChange={onKeyboardStateChange}
      />
    </View>
  );
};

// Push de radar -> refresh imediato; toque na notificação -> abre Radares (§9.4).
// Push de booking -> atualiza Recebidos + Agenda; toque -> abre Booking.
const useRadarPushSync = (onSelectTab: (tab: MainTabType) => void) => {
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
        onSelectTab('triggers');
      }
      if (data.type === 'booking_appointment' || data.type === 'meeting_vote' || data.type === 'meeting_confirmed') {
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


const TasksTabScreen: React.FC = () => {
  const home = useHomeDataContext();
  const pendingTodos = home.todos.filter((t) => t.status !== 'completed');
  const completedList = home.todos.filter((t) => t.status === 'completed');
  const [createRequestId, setCreateRequestId] = useState(0);
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
    <View style={styles.tabRoot}>
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
            onPress={() => chatPromptBus.askAssistant('Qual próxima tarefa ou pendência você quer organizar?')}
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

const TriggersTabScreen: React.FC<{
  onSubViewChange: (inSubView: boolean) => void;
}> = ({ onSubViewChange }) => {
  const [inSubView, setInSubView] = useState(false);

  const handleSubViewChange = (sub: boolean) => {
    setInSubView(sub);
    onSubViewChange(sub);
  };

  return (
    <View style={styles.tabRoot}>
      <Header
        activeTab="triggers"
        align="left"
        hideTitle={inSubView}
        contextualActions={
          inSubView ? undefined : (
            <HeaderRoundButton
              icon="auto-awesome"
              variant="primary"
              onPress={() => chatPromptBus.askAssistant('O que você gostaria de monitorar ou receber alertas?')}
              accessibilityLabel="Pedir ao Vito: novo radar"
              size={20}
            />
          )
        }
      />
      <TriggersScreen onSubViewChange={handleSubViewChange} />
    </View>
  );
};

const BookingTabScreen: React.FC<{
  onSubViewChange: (inSubView: boolean) => void;
}> = ({ onSubViewChange }) => {
  const [inSubView, setInSubView] = useState(false);

  const handleSubViewChange = (sub: boolean) => {
    setInSubView(sub);
    onSubViewChange(sub);
  };

  return (
    <View style={styles.tabRoot}>
      <Header
        activeTab="booking"
        align="left"
        hideTitle={inSubView}
        contextualActions={
          inSubView ? undefined : (
            <HeaderRoundButton
              icon="auto-awesome"
              variant="primary"
              onPress={() => chatPromptBus.askAssistant('Que tipo de reunião você quer criar? (Link individual 1-on-1 ou votação em grupo?)')}
              accessibilityLabel="Pedir ao Vito: novo link"
              size={20}
            />
          )
        }
      />
      <BookingScreen onSubViewChange={handleSubViewChange} />
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

export const MainTabs: React.FC<{ route?: any }> = ({ route }) => {
  const { colors } = useTheme();
  const home = useHomeDataContext();
  const [activeTab, setActiveTab] = useState<MainTabType>('chat');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [inAgendaSubView, setInAgendaSubView] = useState(false);
  const [inAgendaModal, setInAgendaModal] = useState(false);
  const [showSummaries, setShowSummaries] = useState(false);
  const [inTriggersSubView, setInTriggersSubView] = useState(false);
  const [inBookingSubView, setInBookingSubView] = useState(false);
  const [gestureSwipeLocked, setGestureSwipeLocked] = useState(false);

  const chatRef = useRef<ChatScreenRef>(null);
  const pagerRef = useRef<AdaptivePagerRef>(null);
  const { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(windowWidth || 390);

  const fireTabSideEffects = useCallback((tab: MainTabType) => {
    if (tab === 'calendar' || tab === 'tasks') {
      home.loadData(true);
    } else if (tab === 'triggers') {
      dataSync.notify('refresh_triggers');
    } else if (tab === 'booking') {
      dataSync.notify('refresh_bookings');
    }
  }, [home]);

  const handleSelectTab = useCallback((tab: MainTabType) => {
    setActiveTab(tab);
    pagerRef.current?.setPage(getIndexForTab(tab));
    fireTabSideEffects(tab);
  }, [fireTabSideEffects]);

  const handlePageSelected = useCallback((position: number) => {
    const newTab = getTabForIndex(position);
    if (newTab !== activeTab) {
      hapticFeedback.selection();
      setActiveTab(newTab);
      fireTabSideEffects(newTab);
    }
  }, [activeTab, fireTabSideEffects]);

  // Teclado global
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

  // Barramento de navegação lateral direta (§Instagram/TikTok swipe)
  useEffect(() => {
    return tabNavigationBus.subscribe((tab) => {
      handleSelectTab(tab);
    });
  }, [handleSelectTab]);

  // Bloqueio temporário do pager quando carrossel interno (ChatIdeasDeck) está sendo arrastado
  useEffect(() => {
    return pagerSwipeLockBus.subscribe((locked) => {
      setGestureSwipeLocked(locked);
    });
  }, []);

  // Prompts externos vindos das abas / radares
  useEffect(() => {
    return chatPromptBus.subscribe((prompt) => {
      if (typeof prompt === 'string') {
        chatRef.current?.submitExternalPrompt(prompt);
      } else if (prompt && typeof prompt === 'object' && 'question' in prompt) {
        chatRef.current?.askAssistantQuestion(prompt.question);
      }
      handleSelectTab('chat');
    });
  }, [handleSelectTab]);

  useRadarPushSync(handleSelectTab);

  // Parâmetro de rota / deep linking
  const targetScreen = route?.params?.screen as MainTabType | undefined;
  useEffect(() => {
    if (targetScreen && targetScreen !== activeTab) {
      handleSelectTab(targetScreen);
    }
  }, [targetScreen, handleSelectTab]);

  // Intercepta gesto de voltar do hardware/sistema para navegar hierarquicamente
  useEffect(() => {
    const onBackPress = () => {
      const hasModal = inAgendaModal;
      const hasSub = inAgendaSubView || inTriggersSubView || inBookingSubView;
      const action = determineBackAction({
        activeTab,
        hasSubScreen: hasSub,
        hasModal,
      });

      if (action.type === 'CLOSE_SUBSCREEN') {
        if (showSummaries) {
          setShowSummaries(false);
          return true;
        }
        return false;
      }
      if (action.type === 'CLOSE_MODAL') {
        return false;
      }
      if (action.type === 'NAVIGATE_TO_TAB') {
        handleSelectTab(action.targetTab);
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [activeTab, inAgendaModal, inAgendaSubView, inTriggersSubView, inBookingSubView, showSummaries, handleSelectTab]);

  const hasSubScreen = inAgendaSubView || inTriggersSubView || inBookingSubView;
  const hasModal = inAgendaModal;
  const scrollEnabled = !shouldPreventSwipe({
    isKeyboardOpen: keyboardOpen,
    hasModal,
    hasSubScreen,
  }) && !gestureSwipeLocked;

  return (
    <View
      style={[styles.mainTabsContainer, { backgroundColor: colors.surface }]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - containerWidth) > 1) {
          setContainerWidth(w);
        }
      }}
    >
      <AdaptivePager
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        scrollEnabled={scrollEnabled}
        onPageSelected={handlePageSelected}
      >
        <View key="0" style={[styles.pageWrapper, { width: containerWidth }]} collapsable={false}>
          <ChatTabScreen chatRef={chatRef} onKeyboardStateChange={setKeyboardOpen} />
        </View>

        <View key="1" style={[styles.pageWrapper, { width: containerWidth }]} collapsable={false}>
          <AgendaTabScreen
            onSubViewChange={setInAgendaSubView}
            onModalChange={setInAgendaModal}
            showSummaries={showSummaries}
            setShowSummaries={setShowSummaries}
            keyboardOpen={keyboardOpen}
          />
        </View>

        <View key="2" style={[styles.pageWrapper, { width: containerWidth }]} collapsable={false}>
          <TasksTabScreen />
        </View>

        <View key="3" style={[styles.pageWrapper, { width: containerWidth }]} collapsable={false}>
          <TriggersTabScreen onSubViewChange={setInTriggersSubView} />
        </View>

        <View key="4" style={[styles.pageWrapper, { width: containerWidth }]} collapsable={false}>
          <BookingTabScreen onSubViewChange={setInBookingSubView} />
        </View>

        <View key="5" style={[styles.pageWrapper, { width: containerWidth }]} collapsable={false}>
          <ProfileTabScreen />
        </View>
      </AdaptivePager>

      <FloatingTabBar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        visible={!keyboardOpen}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  mainTabsContainer: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  pageWrapper: {
    flex: 1,
  },
  tabRoot: {
    flex: 1,
  },
});

