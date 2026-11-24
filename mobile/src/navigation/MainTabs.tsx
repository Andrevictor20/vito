import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  DeviceEventEmitter,
  Keyboard,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { AdaptivePager, AdaptivePagerRef } from '../components/common/AdaptivePager';
import { DOCK_TABS, FloatingTabBar, type DockTabType } from '../components/common/FloatingTabBar';
import { HeaderRoundButton, SubScreenHeader } from '../components/common/Header';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { notificationsInboxStore } from '../services/notificationsInboxStore';
import { chatPromptBus, dataSync, tabNavigationBus } from '../services/dataSync';
import { BookingScreen } from '../screens/BookingScreen';
import { ChatScreenRef } from '../screens/ChatScreen';
import { FinanceScreen } from '../screens/FinanceScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { hapticFeedback } from '../theme/motion';
import { SectionTransition } from '../ds/SectionTransition';
import {
  VfxCelebrationOverlay,
  useReduceMotion,
} from '../theme/vitoMotion';
import { determineBackAction, type MainTabType } from '../utils/pagerNavigation';
import { AgendaTabScreen } from './AgendaTabScreen';
import { useHomeDataContext } from './HomeDataProvider';
import {
  BotsTabScreen,
  ChatTabScreen,
  TasksTabScreen,
  getDockIndex,
  getDockTabAt,
  getInitials,
  isDockTab,
  tryNavigateStackRoute,
  useRadarPushSync,
} from './MainTabViews';

type OverlaySubScreen = 'booking' | 'profile' | 'notifications' | null;

export const MainTabs: React.FC<{ route?: { params?: { screen?: MainTabType } } }> = ({ route }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const home = useHomeDataContext();
  const reduceMotion = useReduceMotion();

  const [activeTab, setActiveTab] = useState<DockTabType>('chat');
  const [overlaySubScreen, setOverlaySubScreen] = useState<OverlaySubScreen>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [inAgendaSubView, setInAgendaSubView] = useState(false);
  const [inAgendaModal, setInAgendaModal] = useState(false);
  const [showSummaries, setShowSummaries] = useState(false);
  const [inTriggersSubView, setInTriggersSubView] = useState(false);
  const [inBookingSubView, setInBookingSubView] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const chatRef = useRef<ChatScreenRef>(null);
  const pagerRef = useRef<AdaptivePagerRef>(null);
  const { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(windowWidth || 390);
  const profileInitials = useMemo(() => getInitials(user?.name), [user?.name]);

  const refreshUnreadCount = useCallback(async () => {
    try {
      await notificationsInboxStore.refreshUnreadCount();
    } catch {
      try {
        const pending = await api.getPendingItems();
        setUnreadNotificationsCount(Array.isArray(pending) ? pending.length : 0);
      } catch {
        // Mantém último valor conhecido
      }
    }
  }, []);

  useEffect(() => {
    const unsubStore = notificationsInboxStore.subscribe((count) => {
      setUnreadNotificationsCount(Math.max(0, count));
    });
    void refreshUnreadCount();
    const unsubPending = dataSync.subscribe('refresh_pending', refreshUnreadCount);
    const unsubAll = dataSync.subscribe('refresh_all', refreshUnreadCount);
    const badgeSub = DeviceEventEmitter.addListener(
      'vito:notifications-unread',
      (count: unknown) => {
        if (typeof count === 'number' && Number.isFinite(count)) {
          notificationsInboxStore.setUnreadCount(Math.max(0, count));
        }
      }
    );
    return () => {
      unsubStore();
      unsubPending();
      unsubAll();
      badgeSub.remove();
    };
  }, [refreshUnreadCount]);

  const fireTabSideEffects = useCallback(
    (tab: MainTabType) => {
      if (tab === 'calendar' || tab === 'tasks') {
        home.loadData(true);
      } else if (tab === 'finance') {
        dataSync.notify('refresh_finance');
      } else if (tab === 'triggers') {
        dataSync.notify('refresh_triggers');
      } else if (tab === 'booking') {
        dataSync.notify('refresh_bookings');
      }
    },
    [home]
  );

  const handleSelectTab = useCallback(
    (tab: MainTabType) => {
      if (tab === 'booking') {
        if (!tryNavigateStackRoute('booking')) {
          setOverlaySubScreen('booking');
        }
        fireTabSideEffects('booking');
        return;
      }
      if (tab === 'profile') {
        if (!tryNavigateStackRoute('profile')) {
          setOverlaySubScreen('profile');
        }
        return;
      }
      if (isDockTab(tab)) {
        setOverlaySubScreen(null);
        setActiveTab(tab);
        pagerRef.current?.setPage(getDockIndex(tab));
        fireTabSideEffects(tab);
      }
    },
    [fireTabSideEffects]
  );

  const handleOpenNotifications = useCallback(() => {
    if (tryNavigateStackRoute('notifications')) return;
    setOverlaySubScreen('notifications');
    DeviceEventEmitter.emit('vito:open-notifications');
  }, []);

  const handleOpenProfile = useCallback(() => {
    if (tryNavigateStackRoute('profile')) return;
    setOverlaySubScreen('profile');
  }, []);

  const handlePageSelected = useCallback(
    (position: number) => {
      const newTab = getDockTabAt(position);
      if (newTab !== activeTab) {
        hapticFeedback.selection();
        setActiveTab(newTab);
        fireTabSideEffects(newTab);
      }
    },
    [activeTab, fireTabSideEffects]
  );

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

  useEffect(() => {
    return tabNavigationBus.subscribe((tab) => {
      handleSelectTab(tab);
    });
  }, [handleSelectTab]);

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

  const targetScreen = route?.params?.screen;
  useEffect(() => {
    if (targetScreen && targetScreen !== activeTab) {
      handleSelectTab(targetScreen);
    }
  }, [targetScreen, activeTab, handleSelectTab]);

  useEffect(() => {
    const onBackPress = () => {
      if (overlaySubScreen) {
        if (overlaySubScreen === 'booking' && inBookingSubView) {
          return false;
        }
        setOverlaySubScreen(null);
        return true;
      }
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
  }, [
    activeTab,
    overlaySubScreen,
    inAgendaModal,
    inAgendaSubView,
    inTriggersSubView,
    inBookingSubView,
    showSummaries,
    handleSelectTab,
  ]);

  return (
    <View
      style={[styles.mainTabsContainer, { backgroundColor: colors.bg }]}
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
        onPageSelected={handlePageSelected}
      >
        <View key="0" style={[styles.pageWrapper, { width: containerWidth }]} collapsable={false}>
          <ChatTabScreen
            chatRef={chatRef}
            onKeyboardStateChange={setKeyboardOpen}
            unreadNotificationsCount={unreadNotificationsCount}
            profileInitials={profileInitials}
            onOpenNotifications={handleOpenNotifications}
            onOpenProfile={handleOpenProfile}
          />
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
          <FinanceScreen />
        </View>

        <View key="4" style={[styles.pageWrapper, { width: containerWidth }]} collapsable={false}>
          <BotsTabScreen onSubViewChange={setInTriggersSubView} />
        </View>
      </AdaptivePager>

      {/* Sub-telas pushed fora da dock: Booking (#open-book), Perfil (AV) e Notificações */}
      <SectionTransition
        visible={overlaySubScreen === 'booking'}
        mode="push"
        reduceMotion={reduceMotion}
        style={[styles.overlaySubScreen, { backgroundColor: colors.bg }]}
      >
        <SubScreenHeader
          title="Agendamentos"
          subtitle="Links e votações de horário"
          onPressBack={() => setOverlaySubScreen(null)}
          rightAction={
            <HeaderRoundButton
              icon="add"
              variant="primary"
              onPress={() => {
                setOverlaySubScreen(null);
                handleSelectTab('chat');
              }}
              accessibilityLabel="Novo link"
              size={20}
            />
          }
        />
        <BookingScreen onSubViewChange={setInBookingSubView} />
      </SectionTransition>

      <SectionTransition
        visible={overlaySubScreen === 'profile'}
        mode="push"
        reduceMotion={reduceMotion}
        style={[styles.overlaySubScreen, { backgroundColor: colors.bg }]}
      >
        <SubScreenHeader
          title="Perfil"
          subtitle="Conta, autonomia e integrações"
          onPressBack={() => setOverlaySubScreen(null)}
        />
        <ProfileScreen
          refreshing={home.refreshing}
          onRefresh={home.onRefresh}
          onDataChanged={home.loadData}
        />
      </SectionTransition>

      <SectionTransition
        visible={overlaySubScreen === 'notifications'}
        mode="push"
        reduceMotion={reduceMotion}
        style={[styles.overlaySubScreen, { backgroundColor: colors.bg }]}
      >
        <NotificationsScreen onBack={() => setOverlaySubScreen(null)} />
      </SectionTransition>

      <FloatingTabBar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        visible={!keyboardOpen && overlaySubScreen === null && !inAgendaSubView && !inTriggersSubView}
      />

      <VfxCelebrationOverlay />
    </View>
  );
};

const styles = StyleSheet.create({
  mainTabsContainer: {
    flex: 1,
    position: 'relative',
  },
  pager: {
    flex: 1,
  },
  pageWrapper: {
    flex: 1,
  },
  overlaySubScreen: {
    ...StyleSheet.absoluteFill,
    zIndex: 110,
  },
});
