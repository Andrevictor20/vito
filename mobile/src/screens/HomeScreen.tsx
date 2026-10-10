import React, { useState, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Easing,
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
import { useHomeData } from '../hooks/useHomeData';
import { useTheme } from '../context/ThemeContext';
import { Event } from '../types';

export const HomeScreen: React.FC<{
  serverUrl: string;
  onToggleServer: () => void;
}> = ({ serverUrl, onToggleServer }) => {
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'chat' | 'calendar' | 'triggers'>('chat');
  const [profileVisible, setProfileVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const chatRef = useRef<ChatScreenRef>(null);
  const tabFadeAnim = useRef(
    new Animated.Value(activeTab === 'chat' ? 0 : activeTab === 'calendar' ? 1 : 2)
  ).current;

  const handleSelectTab = (tab: 'chat' | 'calendar' | 'triggers') => {
    setActiveTab(tab);
    const target = tab === 'chat' ? 0 : tab === 'calendar' ? 1 : 2;
    Animated.timing(tabFadeAnim, {
      toValue: target,
      duration: 220,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: true,
    }).start();
    if (tab === 'calendar') {
      loadData(true);
    }
  };
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
  } = useHomeData();

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

      <View style={[styles.mainContent, { backgroundColor: colors.surface }]}>
        {/* Camada 1: Agenda & Tarefas */}
        <Animated.View
          style={[
            styles.tabLayer,
            {
              opacity: tabFadeAnim.interpolate({
                inputRange: [0, 0.5, 1, 1.5, 2],
                outputRange: [0, 0, 1, 0, 0],
              }),
              zIndex: activeTab === 'calendar' ? 2 : 1,
            },
          ]}
          pointerEvents={activeTab === 'calendar' ? 'auto' : 'none'}
        >
          <ScrollView
            style={[styles.scroll, { backgroundColor: colors.surface }]}
            contentContainerStyle={[styles.content, { backgroundColor: colors.surface }]}
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

            {/* Seletor Segmentado de Foco: Eventos vs Tarefas (Elimina a Rolagem Infinita) */}
            <View
              style={[
                styles.focusSegmentedContainer,
                {
                  backgroundColor: isDark ? colors.surfaceContainerLow : '#F4F4F5',
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.focusSegmentBtn,
                  homeFocusMode === 'events' && [
                    styles.focusSegmentBtnActive,
                    { backgroundColor: isDark ? colors.surfaceContainerHighest : colors.primary },
                  ],
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
                  homeFocusMode === 'todos' && [
                    styles.focusSegmentBtnActive,
                    { backgroundColor: isDark ? colors.surfaceContainerHighest : colors.primary },
                  ],
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

                {/* Gaveta Colapsável de Concluídas (Zero-Slop List) */}
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


        </Animated.View>

        {/* Camada 2: Chat com IA */}
        <Animated.View
          style={[
            styles.tabLayer,
            {
              opacity: tabFadeAnim.interpolate({
                inputRange: [0, 0.5, 1, 2],
                outputRange: [1, 0, 0, 0],
              }),
              zIndex: activeTab === 'chat' ? 2 : 1,
            },
          ]}
          pointerEvents={activeTab === 'chat' ? 'auto' : 'none'}
        >
          <ChatScreen
            ref={chatRef}
            onDataChanged={loadData}
            onKeyboardStateChange={setIsKeyboardOpen}
            onLoadingStateChange={setIsChatLoading}
          />
        </Animated.View>

        {/* Camada 3: Disparadores / Vigília de Inteligência */}
        <Animated.View
          style={[
            styles.tabLayer,
            {
              opacity: tabFadeAnim.interpolate({
                inputRange: [0, 1, 1.5, 2],
                outputRange: [0, 0, 0, 1],
              }),
              zIndex: activeTab === 'triggers' ? 2 : 1,
            },
          ]}
          pointerEvents={activeTab === 'triggers' ? 'auto' : 'none'}
        >
          <TriggersScreen />
        </Animated.View>
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
  tabLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    alignItems: 'center',
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
    padding: 3,
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
    gap: 4,
  },
  focusSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: MD3Shapes.full,
    gap: 6,
  },
  focusSegmentBtnActive: {
    ...tokens.shadows.level1,
  },
  focusSegmentText: {
    fontSize: tokens.typography.size.labelMedium,
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
