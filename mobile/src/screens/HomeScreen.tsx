import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  BackHandler,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../theme/tokens';
import { FloatingTabBar } from '../components/common/FloatingTabBar';
import { Header } from '../components/common/Header';
import { ExecutiveMonthCalendarCard } from '../components/home/ExecutiveMonthCalendarCard';
import { EventCard } from '../components/calendar/EventCard';
import { TodoItem } from '../components/todos/TodoItem';
import { CreateItemModal } from '../components/calendar/CreateItemModal';
import { EditEventModal } from '../components/calendar/EditEventModal';
import { ProfileModal } from '../components/profile/ProfileModal';
import { ChatScreen, ChatScreenRef } from './ChatScreen';
import { TriggersScreen } from './TriggersScreen';
import { PendingItemsView } from './PendingItemsView';
import { BookingScreen } from './BookingScreen';
import { ExecutiveSummariesHubView } from './ExecutiveSummariesHubView';
import { hapticFeedback } from '../theme/motion';
import { useHomeData } from '../hooks/useHomeData';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Event } from '../types';
import {
  MainTabType,
  calculatePageIndex,
  calculateScrollTarget,
  getTabForIndex,
  shouldPreventSwipe,
  determineBackAction,
} from '../utils/pagerNavigation';

export const HomeScreen: React.FC<{
  serverUrl: string;
  onToggleServer: () => void;
}> = ({ serverUrl, onToggleServer }) => {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<MainTabType>('chat');
  const [profileVisible, setProfileVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showPendingItems, setShowPendingItems] = useState(false);
  const [showBookingScreen, setShowBookingScreen] = useState(false);
  const [showSummariesScreen, setShowSummariesScreen] = useState(false);

  const chatRef = useRef<ChatScreenRef>(null);
  const pagerRef = useRef<ScrollView>(null);
  const { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(windowWidth || 390);
  const isProgrammaticScroll = useRef(false);

  const handleSelectTab = (tab: MainTabType) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    isProgrammaticScroll.current = true;
    const targetX = calculateScrollTarget(tab, containerWidth);
    pagerRef.current?.scrollTo({ x: targetX, animated: true });
    if (tab === 'calendar') {
      loadData(true);
    }
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isProgrammaticScroll.current = false;
    const offsetX = e.nativeEvent.contentOffset.x;
    const pageIndex = calculatePageIndex(offsetX, containerWidth);
    const newTab = getTabForIndex(pageIndex);
    if (newTab !== activeTab) {
      hapticFeedback.selection();
      setActiveTab(newTab);
      if (newTab === 'calendar') {
        loadData(true);
      }
    }
  };

  // Mantém a visualização sincronizada com a largura da tela em caso de rotação
  useEffect(() => {
    if (containerWidth > 0) {
      const targetX = calculateScrollTarget(activeTab, containerWidth);
      pagerRef.current?.scrollTo({ x: targetX, animated: false });
    }
  }, [containerWidth]);

  // Intercepta gesto de voltar do hardware/sistema para navegar hierarquicamente
  useEffect(() => {
    const onBackPress = () => {
      const hasModal = profileVisible || createModalVisible || editModalVisible || Boolean(editingEvent);
      const action = determineBackAction({
        activeTab,
        hasSubScreen: showPendingItems,
        hasModal,
      });

      if (showBookingScreen) {
        setShowBookingScreen(false);
        return true;
      }
      if (showSummariesScreen) {
        setShowSummariesScreen(false);
        return true;
      }
      if (action.type === 'CLOSE_SUBSCREEN') {
        setShowPendingItems(false);
        return true;
      }
      if (action.type === 'CLOSE_MODAL') {
        if (profileVisible) setProfileVisible(false);
        if (createModalVisible) setCreateModalVisible(false);
        if (editModalVisible || editingEvent) {
          setEditModalVisible(false);
          setEditingEvent(null);
        }
        return true;
      }
      if (action.type === 'NAVIGATE_TO_TAB') {
        handleSelectTab(action.targetTab);
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [showPendingItems, profileVisible, createModalVisible, editModalVisible, editingEvent, activeTab, containerWidth]);
  const {
    events,
    todos,
    loading,
    refreshing,
    onRefresh,
    selectedDate,
    setSelectedDate,
    dayEvents,
    upcomingEvents,
    eventDates,
    isTodaySelected,
    handleCreateEvent,
    handleUpdateEvent,
    handleCreateTodo,
    handleDeleteEvent,
    handleToggleTodo,
    handleDeleteTodo,
    handleToggleSubtask,
    handleAddSubtask,
    handleDeleteSubtask,
    handleAssistantSubmit,
    loadData,
    syncGoogleCalendar,
    syncingGoogle,
  } = useHomeData(user?.id);


  const completedCount = useMemo(() => {
    return todos.filter((t) => t.status === 'completed').length;
  }, [todos]);

  // Modo de foco dedicado: 'events' vs 'todos' para eliminar rolagem infinita dupla
  const [homeFocusMode, setHomeFocusMode] = useState<'events' | 'todos'>('events');
  const [showCompletedTodos, setShowCompletedTodos] = useState(false);

  const pendingTodos = useMemo(
    () => todos.filter((t) => t.status !== 'completed'),
    [todos]
  );
  const completedTodosList = useMemo(
    () => todos.filter((t) => t.status === 'completed'),
    [todos]
  );

  if (showPendingItems) {
    return (
      <PendingItemsView
        onBack={() => setShowPendingItems(false)}
        onOpenEventCreate={(title) => {
          setShowPendingItems(false);
          setCreateModalVisible(true);
        }}
      />
    );
  }

  if (showBookingScreen) {
    return (
      <BookingScreen
        onBack={() => setShowBookingScreen(false)}
      />
    );
  }

  if (showSummariesScreen) {
    return (
      <ExecutiveSummariesHubView
        onBack={() => setShowSummariesScreen(false)}
        onOpenChatWithPrompt={(prompt) => {
          setShowSummariesScreen(false);
          handleSelectTab('chat');
          setTimeout(() => {
            chatRef.current?.submitExternalPrompt(prompt);
          }, 250);
        }}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Top App Bar Persistente M3 com transição suave e contínua */}
      <Header
        activeTab={activeTab}
        onPressProfile={() => setProfileVisible(true)}
        onPressNewChat={() => chatRef.current?.startNewChat()}
        onPressHistory={() => chatRef.current?.openHistory()}
        mascotState={activeTab === 'chat' && isChatLoading ? 'thinking' : 'idle'}
      />

      <View
        style={[styles.mainContent, { backgroundColor: colors.surface }]}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - containerWidth) > 1) {
            setContainerWidth(w);
          }
        }}
      >
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          scrollEventThrottle={16}
          nestedScrollEnabled={true}
          directionalLockEnabled={true}
          scrollEnabled={
            !shouldPreventSwipe({
              isKeyboardOpen,
              hasModal: profileVisible || createModalVisible || editModalVisible || Boolean(editingEvent),
              hasSubScreen: showPendingItems,
            })
          }
          onMomentumScrollEnd={handleMomentumScrollEnd}
          style={styles.pagerScrollView}
          contentContainerStyle={styles.pagerContentContainer}
        >
          {/* Página 0: Chat com IA */}
          <View style={[styles.pageWrapper, { width: containerWidth }]}>
            <ChatScreen
              ref={chatRef}
              onDataChanged={loadData}
              onKeyboardStateChange={setIsKeyboardOpen}
              onLoadingStateChange={setIsChatLoading}
            />
          </View>

          {/* Página 1: Agenda & Tarefas */}
          <View style={[styles.pageWrapper, { width: containerWidth }]}>
            <ScrollView
              style={[styles.scroll, { backgroundColor: colors.surface }]}
              contentContainerStyle={[styles.content, { backgroundColor: colors.surface }]}
              nestedScrollEnabled={true}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                />
              }
            >
              {/* Mini Calendário Mensal Executivo & Resumo */}
              <ExecutiveMonthCalendarCard
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                dayEvents={dayEvents}
                totalTodos={todos.length}
                completedTodos={completedCount}
                eventDates={eventDates}
              />

              {/* Seletor Segmentado de Foco (Eventos vs Tarefas - 50% cada) */}
              <View style={styles.focusSegmentedContainer}>
                <TouchableOpacity
                  style={[
                    styles.focusSegmentBtn,
                    {
                      backgroundColor:
                        homeFocusMode === 'events'
                          ? (isDark ? colors.surfaceContainerHighest : colors.primary)
                          : (isDark ? colors.surfaceContainerLow : '#F4F4F5'),
                      borderColor:
                        homeFocusMode === 'events'
                          ? 'transparent'
                          : colors.outlineVariant,
                    },
                    homeFocusMode === 'events' && styles.focusSegmentBtnActive,
                  ]}
                  onPress={() => setHomeFocusMode('events')}
                  activeOpacity={0.75}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: homeFocusMode === 'events' }}
                >
                  <MaterialIcons
                    name="event"
                    size={16}
                    color={
                      homeFocusMode === 'events'
                        ? (isDark ? colors.onSurface : colors.onPrimary)
                        : colors.onSurfaceVariant
                    }
                  />
                  <Text
                    style={[
                      styles.focusSegmentText,
                      {
                        color:
                          homeFocusMode === 'events'
                            ? (isDark ? colors.onSurface : colors.onPrimary)
                            : colors.onSurfaceVariant,
                        fontWeight: homeFocusMode === 'events' ? '700' : '500',
                      },
                    ]}
                  >
                    Eventos ({dayEvents.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.focusSegmentBtn,
                    {
                      backgroundColor:
                        homeFocusMode === 'todos'
                          ? (isDark ? colors.surfaceContainerHighest : colors.primary)
                          : (isDark ? colors.surfaceContainerLow : '#F4F4F5'),
                      borderColor:
                        homeFocusMode === 'todos'
                          ? 'transparent'
                          : colors.outlineVariant,
                    },
                    homeFocusMode === 'todos' && styles.focusSegmentBtnActive,
                  ]}
                  onPress={() => setHomeFocusMode('todos')}
                  activeOpacity={0.75}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: homeFocusMode === 'todos' }}
                >
                  <MaterialIcons
                    name="check-circle-outline"
                    size={16}
                    color={
                      homeFocusMode === 'todos'
                        ? (isDark ? colors.onSurface : colors.onPrimary)
                        : colors.onSurfaceVariant
                    }
                  />
                  <Text
                    style={[
                      styles.focusSegmentText,
                      {
                        color:
                          homeFocusMode === 'todos'
                            ? (isDark ? colors.onSurface : colors.onPrimary)
                            : colors.onSurfaceVariant,
                        fontWeight: homeFocusMode === 'todos' ? '700' : '500',
                      },
                    ]}
                  >
                    Tarefas ({pendingTodos.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Ações Rápidas Executivas: Pendências & Vito Booking (100% visíveis, sem swipe) */}
              <View style={styles.quickActionsDockRow}>
                <TouchableOpacity
                  style={[
                    styles.quickActionCard,
                    {
                      backgroundColor: isDark ? colors.surfaceContainerLow : '#F4F4F5',
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                  onPress={() => {
                    hapticFeedback.selection();
                    setShowPendingItems(true);
                  }}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir Pendências"
                >
                  <MaterialIcons
                    name="inbox"
                    size={16}
                    color={colors.primary}
                  />
                  <Text
                    style={[
                      styles.quickActionText,
                      { color: colors.onSurface },
                    ]}
                  >
                    Pendências
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.quickActionCard,
                    {
                      backgroundColor: isDark ? colors.surfaceContainerLow : '#F4F4F5',
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                  onPress={() => {
                    hapticFeedback.selection();
                    setShowBookingScreen(true);
                  }}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir Vito Booking"
                >
                  <MaterialIcons
                    name="link"
                    size={16}
                    color={colors.primary}
                  />
                  <Text
                    style={[
                      styles.quickActionText,
                      { color: colors.onSurface },
                    ]}
                  >
                    Vito Booking
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Visualização de Eventos com Foco Dedicado */}
              {homeFocusMode === 'events' ? (
                <View style={styles.focusSectionContainer}>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
                      {isTodaySelected
                        ? 'Eventos de hoje'
                        : `Eventos de ${selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`}
                    </Text>
                    <View style={[styles.countBadgePill, { backgroundColor: colors.primaryContainer }]}>
                      <Text style={[styles.countBadgeText, { color: colors.onPrimaryContainer }]}>
                        {dayEvents.length} {dayEvents.length === 1 ? 'evento' : 'eventos'}
                      </Text>
                    </View>
                  </View>

                  {loading && events.length === 0 ? (
                    <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
                  ) : dayEvents.length === 0 ? (
                    <>
                      <View style={[styles.emptyCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
                        <View style={[styles.emptyIconContainer, { backgroundColor: colors.surfaceContainerHigh }]}>
                          <MaterialIcons name="event-available" size={20} color={colors.primary} />
                        </View>
                        <View style={styles.emptyContent}>
                          <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Dia Livre</Text>
                          <Text style={[styles.emptySub, { color: colors.onSurfaceVariant }]}>
                            {isTodaySelected
                              ? 'Nenhum compromisso marcado para hoje.'
                              : `Nenhum compromisso marcado para ${selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}.`}
                          </Text>
                        </View>
                      </View>

                      {/* Próximos compromissos na agenda quando o dia atual estiver livre */}
                      {upcomingEvents.length > 0 && (
                        <View style={{ marginTop: tokens.spacing.md }}>
                          <View style={[styles.sectionHeader, { marginBottom: tokens.spacing.sm }]}>
                            <Text style={[styles.sectionTitle, { fontSize: tokens.typography.size.titleSmall, color: colors.onSurface }]}>
                              Próximos compromissos na agenda
                            </Text>
                            <View style={[styles.countBadgePill, { backgroundColor: colors.surfaceContainerHighest }]}>
                              <Text style={[styles.countBadgeText, { color: colors.onSurface }]}>
                                {upcomingEvents.length} no total
                              </Text>
                            </View>
                          </View>
                          {upcomingEvents.slice(0, 5).map((ev) => (
                            <EventCard
                              key={ev.id}
                              event={ev}
                              onDelete={handleDeleteEvent}
                              onPress={(item) => {
                                setEditingEvent(item);
                                setEditModalVisible(true);
                              }}
                              onRequestDelete={(item) => {
                                setEditingEvent(item);
                                setEditModalVisible(true);
                              }}
                            />
                          ))}
                        </View>
                      )}
                    </>
                  ) : (
                    dayEvents.map((ev) => (
                      <EventCard
                        key={ev.id}
                        event={ev}
                        onDelete={handleDeleteEvent}
                        onPress={(item) => {
                          setEditingEvent(item);
                          setEditModalVisible(true);
                        }}
                        onRequestDelete={(item) => {
                          setEditingEvent(item);
                          setEditModalVisible(true);
                        }}
                      />
                    ))
                  )}
                </View>
              ) : (
                /* Visualização de Tarefas com Foco Dedicado e Gaveta de Concluídas */
                <View style={styles.focusSectionContainer}>
                  <View style={styles.sectionHeader}>
                    <View>
                      <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Tarefas e Pendências</Text>
                      <Text style={[styles.checklistSubtitle, { color: colors.textMuted }]}>
                        {completedCount}/{todos.length} concluídas
                      </Text>
                    </View>
                  </View>

                  {loading && todos.length === 0 ? (
                    <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
                  ) : pendingTodos.length === 0 ? (
                    <View style={[styles.emptyCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
                      <View style={[styles.emptyIconContainer, { backgroundColor: 'rgba(52, 211, 153, 0.15)' }]}>
                        <MaterialIcons name="done-all" size={20} color={colors.success} />
                      </View>
                      <View style={styles.emptyContent}>
                        <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Tudo em Dia</Text>
                        <Text style={[styles.emptySub, { color: colors.onSurfaceVariant }]}>Nenhuma tarefa pendente no momento.</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.checklistCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant, borderWidth: 1 }]}>
                      {pendingTodos.map((t, idx) => (
                        <TodoItem
                          key={t.id}
                          todo={t}
                          onToggle={handleToggleTodo}
                          onDelete={handleDeleteTodo}
                          onToggleSubtask={handleToggleSubtask}
                          onAddSubtask={handleAddSubtask}
                          onDeleteSubtask={handleDeleteSubtask}
                          isLast={idx === pendingTodos.length - 1}
                          grouped
                        />
                      ))}
                    </View>
                  )}

                  {/* Gaveta Colapsável de Concluídas */}
                  {completedTodosList.length > 0 && (
                    <View style={styles.completedSectionWrapper}>
                      <TouchableOpacity
                        style={[
                          styles.completedSectionToggle,
                          {
                            backgroundColor: isDark ? colors.surfaceContainerLow : '#F4F4F5',
                            borderColor: colors.outlineVariant,
                          },
                        ]}
                        onPress={() => setShowCompletedTodos(!showCompletedTodos)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Alternar visualização de tarefas concluídas"
                      >
                        <View style={styles.completedToggleLeft}>
                          <MaterialIcons name="done-all" size={16} color={colors.accents.emerald} />
                          <Text style={[styles.completedToggleText, { color: colors.onSurfaceVariant }]}>
                            Concluídas ({completedTodosList.length})
                          </Text>
                        </View>
                        <MaterialIcons
                          name={showCompletedTodos ? 'expand-less' : 'expand-more'}
                          size={20}
                          color={colors.onSurfaceVariant}
                        />
                      </TouchableOpacity>

                      {showCompletedTodos && (
                        <View
                          style={[
                            styles.checklistCard,
                            {
                              backgroundColor: colors.surfaceContainer,
                              borderColor: colors.outlineVariant,
                              borderWidth: 1,
                              marginTop: 8,
                              opacity: 0.85,
                            },
                          ]}
                        >
                          {completedTodosList.map((t, idx) => (
                            <TodoItem
                              key={t.id}
                              todo={t}
                              onToggle={handleToggleTodo}
                              onDelete={handleDeleteTodo}
                              onToggleSubtask={handleToggleSubtask}
                              onAddSubtask={handleAddSubtask}
                              onDeleteSubtask={handleDeleteSubtask}
                              isLast={idx === completedTodosList.length - 1}
                              grouped
                            />
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Botão de Criação Rápida */}
              <View style={styles.createBtnWrapper}>
                <TouchableOpacity
                  style={[styles.createFab, { backgroundColor: colors.primary }]}
                  onPress={() => setCreateModalVisible(true)}
                  activeOpacity={0.85}
                  accessibilityLabel="Criar nova tarefa ou evento"
                >
                  <MaterialIcons name="add" size={22} color={colors.onPrimary} />
                  <Text style={[styles.createFabText, { color: colors.onPrimary }]}>Nova Tarefa ou Evento</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>

          {/* Página 2: Disparadores / Radares */}
          <View style={[styles.pageWrapper, { width: containerWidth }]}>
            <TriggersScreen onOpenExecutiveSummaries={() => setShowSummariesScreen(true)} />
          </View>
        </ScrollView>

        <CreateItemModal
          visible={createModalVisible}
          onClose={() => setCreateModalVisible(false)}
          selectedDate={selectedDate}
          events={events}
          onSaveEvent={async (title) => {
            const start = new Date(selectedDate);
            start.setHours(9, 0, 0, 0);
            const end = new Date(selectedDate);
            end.setHours(10, 0, 0, 0);
            await handleCreateEvent({
              title,
              start_at: start.toISOString(),
              end_at: end.toISOString(),
            });
          }}
          onSaveTodo={async (title, priority, eventId, eventTitle) => {
            await handleCreateTodo({
              title,
              priority,
              due_date: selectedDate.toISOString(),
              event_id: eventId,
              event_title: eventTitle,
            });
          }}
        />

        <EditEventModal
          visible={editModalVisible}
          onClose={() => {
            setEditModalVisible(false);
            setEditingEvent(null);
          }}
          event={editingEvent}
          onSave={handleUpdateEvent}
          onDelete={handleDeleteEvent}
        />
      </View>

      {/* Bottom M3 Navigation Bar */}
      <FloatingTabBar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        visible={!isKeyboardOpen}
      />

      <ProfileModal
        visible={profileVisible}
        onClose={() => setProfileVisible(false)}
        serverUrl={serverUrl}
        onToggleServer={onToggleServer}
        onDataChanged={loadData}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
  },
  mainContent: {
    flex: 1,
    position: 'relative',
  },
  pagerScrollView: {
    flex: 1,
  },
  pagerContentContainer: {
    flexGrow: 1,
  },
  pageWrapper: {
    flex: 1,
    height: '100%',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: tokens.spacing.lg,
    paddingBottom: 100,
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
    color: tokens.colors.onSurface,
    letterSpacing: 0.1,
  },
  countBadgePill: {
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: MD3Shapes.full,
  },
  countBadgeText: {
    color: tokens.colors.onPrimaryContainer,
    fontSize: tokens.typography.size.labelSmall,
    fontWeight: tokens.typography.weight.bold,
  },
  checklistSubtitle: {
    fontSize: tokens.typography.size.labelSmall,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  checklistCard: {
    backgroundColor: tokens.colors.surfaceContainerLow,
    borderRadius: MD3Shapes.large,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    marginBottom: tokens.spacing.md,
  },
  emptyCard: {
    backgroundColor: tokens.colors.surfaceContainer,
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
    borderRadius: MD3Shapes.large,
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
    backgroundColor: tokens.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconSymbol: {
    fontSize: 18,
  },
  emptyContent: {
    flex: 1,
  },
  emptyTitle: {
    color: tokens.colors.onSurface,
    fontSize: tokens.typography.size.titleSmall,
    fontWeight: tokens.typography.weight.bold,
  },
  emptySub: {
    color: tokens.colors.onSurfaceVariant,
    fontSize: tokens.typography.size.bodySmall,
    marginTop: 2,
  },
  createBtnWrapper: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.md,
  },
  // Extended FAB Material Design 3
  createFab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: tokens.colors.primary,
    paddingVertical: 14,
    borderRadius: MD3Shapes.large,
    ...tokens.shadows.level3,
  },
  createFabText: {
    color: tokens.colors.onPrimary,
    fontSize: tokens.typography.size.labelLarge,
    fontWeight: tokens.typography.weight.bold,
    letterSpacing: 0.2,
  },
  focusSegmentedContainer: {
    flexDirection: 'row',
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.xs,
    gap: 8,
  },
  focusSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    gap: 6,
  },
  focusSegmentBtnActive: {
    ...tokens.shadows.level1,
  },
  focusSegmentText: {
    fontSize: tokens.typography.size.labelMedium,
  },
  quickActionsDockRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: tokens.spacing.md,
  },
  quickActionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: MD3Shapes.small,
    borderWidth: 1,
    gap: 6,
  },
  quickActionText: {
    fontSize: tokens.typography.size.labelMedium,
    fontWeight: '600',
  },
  focusSectionContainer: {
    marginBottom: tokens.spacing.sm,
  },
  completedSectionWrapper: {
    marginTop: tokens.spacing.md,
  },
  completedSectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
  },
  completedToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completedToggleText: {
    fontSize: tokens.typography.size.labelMedium,
    fontWeight: tokens.typography.weight.bold,
  },
});
