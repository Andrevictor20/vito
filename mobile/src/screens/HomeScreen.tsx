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
} from 'react-native';
import { AdaptivePager, AdaptivePagerRef } from '../components/common/AdaptivePager';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../theme/tokens';
import { FloatingTabBar } from '../components/common/FloatingTabBar';
import { Header } from '../components/common/Header';
import { ExecutiveMonthCalendarCard } from '../components/home/ExecutiveMonthCalendarCard';
import { EventCard } from '../components/calendar/EventCard';
import { CreateItemModal } from '../components/calendar/CreateItemModal';
import { EditEventModal } from '../components/calendar/EditEventModal';
import { ProfileScreen } from './ProfileScreen';
import { ChatScreen, ChatScreenRef } from './ChatScreen';
import { TriggersScreen } from './TriggersScreen';
import { TasksScreen } from './TasksScreen';
import { BookingScreen } from './BookingScreen';
import { ExecutiveSummariesHubView } from './ExecutiveSummariesHubView';
import { hapticFeedback } from '../theme/motion';
import { useHomeData } from '../hooks/useHomeData';
import { dataSync } from '../services/dataSync';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Event } from '../types';
import {
  MainTabType,
  getIndexForTab,
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
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showSummariesScreen, setShowSummariesScreen] = useState(false);
  const [createTab, setCreateTab] = useState<'event' | 'todo'>('event');

  const chatRef = useRef<ChatScreenRef>(null);
  const pagerRef = useRef<AdaptivePagerRef>(null);
  const { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(windowWidth || 390);

  const fireTabSideEffects = (tab: MainTabType) => {
    if (tab === 'calendar' || tab === 'tasks') {
      loadData(true);
    } else if (tab === 'triggers') {
      dataSync.notify('refresh_triggers');
    } else if (tab === 'booking') {
      dataSync.notify('refresh_bookings');
    }
  };

  const handleSelectTab = (tab: MainTabType) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    pagerRef.current?.setPage(getIndexForTab(tab));
    fireTabSideEffects(tab);
  };

  // Fonte única de verdade: gesto de swipe atualiza Header + Footbar juntos.
  const handlePageSelected = (position: number) => {
    const newTab = getTabForIndex(position);
    if (newTab !== activeTab) {
      hapticFeedback.selection();
      setActiveTab(newTab);
      fireTabSideEffects(newTab);
    }
  };

  // Intercepta gesto de voltar do hardware/sistema para navegar hierarquicamente
  useEffect(() => {
    const onBackPress = () => {
      const hasModal = createModalVisible || editModalVisible || Boolean(editingEvent);
      const action = determineBackAction({
        activeTab,
        hasSubScreen: showSummariesScreen,
        hasModal,
      });

      if (showSummariesScreen) {
        setShowSummariesScreen(false);
        pagerRef.current?.setPageWithoutAnimation(getIndexForTab(activeTab));
        return true;
      }
      if (action.type === 'CLOSE_MODAL') {
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
  }, [showSummariesScreen, createModalVisible, editModalVisible, editingEvent, activeTab, containerWidth]);
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
    handleUpdateTodo,
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

  const pendingTodos = useMemo(
    () => todos.filter((t) => t.status !== 'completed'),
    [todos]
  );
  const completedTodosList = useMemo(
    () => todos.filter((t) => t.status === 'completed'),
    [todos]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Page Title enxuto M3: título centralizado + hamburger do chat à esquerda */}
      <Header
        activeTab={activeTab}
        onPressNewChat={() => chatRef.current?.startNewChat()}
        onPressMenu={activeTab === 'chat' ? () => chatRef.current?.openHistory() : undefined}
        hideTitle={activeTab === 'chat'}
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
        <AdaptivePager
          ref={pagerRef}
          style={styles.pagerScrollView}
          initialPage={0}
          scrollEnabled={
            !shouldPreventSwipe({
              isKeyboardOpen,
              hasModal: createModalVisible || editModalVisible || Boolean(editingEvent),
              hasSubScreen: showSummariesScreen,
            })
          }
          onPageSelected={handlePageSelected}
        >
          {/* Página 0: Chat com IA */}
          <View key="0" style={[styles.pageWrapper, { width: containerWidth }]}>
            <ChatScreen
              ref={chatRef}
              onDataChanged={loadData}
              onKeyboardStateChange={setIsKeyboardOpen}
              onLoadingStateChange={setIsChatLoading}
            />
          </View>

          {/* Página 1: Agenda & Tarefas */}
          <View key="1" style={[styles.pageWrapper, { width: containerWidth }]}>
            <ScrollView
              style={[styles.scroll, { backgroundColor: colors.surface }]}
              contentContainerStyle={[styles.content, { backgroundColor: colors.surface }]}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
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

              {/* Eventos do dia */}
              {(
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
              )}

            </ScrollView>
            {/* FAB fixo padronizado: pill compacta sempre visível */}
            {!isKeyboardOpen && (
              <View style={styles.fabOverlay} pointerEvents="box-none">
                <TouchableOpacity
                  style={[styles.createFab, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setCreateTab('event');
                    setCreateModalVisible(true);
                  }}
                  activeOpacity={0.85}
                  accessibilityLabel="Criar novo evento"
                  accessibilityRole="button"
                >
                  <MaterialIcons name="add" size={22} color={colors.onPrimary} />
                  <Text style={[styles.createFabText, { color: colors.onPrimary }]}>Novo</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Página 2: Tarefas e Pendências */}
          <View key="2" style={[styles.pageWrapper, { width: containerWidth }]}>
            <TasksScreen
              todos={todos}
              pendingTodos={pendingTodos}
              completedTodosList={completedTodosList}
              completedCount={completedCount}
              loading={loading}
              refreshing={refreshing}
              onRefresh={onRefresh}
              onToggleTodo={handleToggleTodo}
              onDeleteTodo={handleDeleteTodo}
              onToggleSubtask={handleToggleSubtask}
              onAddSubtask={handleAddSubtask}
              onDeleteSubtask={handleDeleteSubtask}
              onSaveTodoFull={handleCreateTodo}
              onUpdateTodoFull={handleUpdateTodo}
              onOpenEventCreate={() => {
                setCreateTab('event');
                setCreateModalVisible(true);
              }}
            />
          </View>

          {/* Página 3: Disparadores / Radares */}
          <View key="3" style={[styles.pageWrapper, { width: containerWidth }]}>
            <TriggersScreen onOpenExecutiveSummaries={() => setShowSummariesScreen(true)} />
          </View>

          {/* Página 4: Vito Booking */}
          <View key="4" style={[styles.pageWrapper, { width: containerWidth }]}>
            <BookingScreen />
          </View>

          {/* Página 5: Perfil e Configurações */}
          <View key="5" style={[styles.pageWrapper, { width: containerWidth }]}>
            <ProfileScreen refreshing={refreshing} onRefresh={onRefresh} onDataChanged={loadData} />
          </View>
        </AdaptivePager>

        <CreateItemModal
          visible={createModalVisible}
          onClose={() => setCreateModalVisible(false)}
          selectedDate={selectedDate}
          events={events}
          fixedTab={createTab}
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

      {/* Sub-tela de Resumos em Overlay (preserva a montagem e posição do Pager) */}
      {showSummariesScreen && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface, zIndex: 100 }]}>
          <ExecutiveSummariesHubView
            onBack={() => {
              setShowSummariesScreen(false);
              pagerRef.current?.setPageWithoutAnimation(getIndexForTab(activeTab));
            }}
            onOpenChatWithPrompt={(prompt) => {
              setShowSummariesScreen(false);
              handleSelectTab('chat');
              setTimeout(() => {
                chatRef.current?.submitExternalPrompt(prompt);
              }, 250);
            }}
          />
        </View>
      )}

      {/* Bottom M3 Navigation Bar */}
      <FloatingTabBar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        visible={!isKeyboardOpen && !showSummariesScreen}
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
    paddingBottom: 150,
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
    borderRadius: MD3Shapes.largeIncreased,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    marginBottom: tokens.spacing.md,
  },
  emptyCard: {
    backgroundColor: tokens.colors.surfaceContainer,
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
    borderRadius: MD3Shapes.largeIncreased,
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
  fabOverlay: {
    position: 'absolute',
    right: 16,
    bottom: 96,
    zIndex: 50,
    alignItems: 'flex-end',
  },
  // Extended FAB Material Design 3 (pill compacta fixa)
  createFab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: MD3Shapes.full,
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
