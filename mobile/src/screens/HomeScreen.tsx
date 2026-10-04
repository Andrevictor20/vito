import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../theme/tokens';
import { FloatingTabBar } from '../components/common/FloatingTabBar';
import { Header } from '../components/common/Header';
import { CompactCalendarCard } from '../components/calendar/CompactCalendarCard';
import { CalendarModal } from '../components/calendar/CalendarModal';
import { EventCard } from '../components/calendar/EventCard';
import { TodoItem } from '../components/todos/TodoItem';
import { CreateItemModal } from '../components/calendar/CreateItemModal';
import { ProfileModal } from '../components/profile/ProfileModal';
import { ChatScreen } from './ChatScreen';
import { useHomeData } from '../hooks/useHomeData';
import { useTheme } from '../context/ThemeContext';

export const HomeScreen: React.FC<{
  serverUrl: string;
  onToggleServer: () => void;
}> = ({ serverUrl, onToggleServer }) => {
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'chat' | 'calendar'>('chat');
  const [profileVisible, setProfileVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const handleSelectTab = (tab: 'chat' | 'calendar') => {
    setActiveTab(tab);
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
    handleCreateTodo,
    handleDeleteEvent,
    handleToggleTodo,
    handleDeleteTodo,
    handleAssistantSubmit,
    loadData,
  } = useHomeData();

  const completedCount = useMemo(() => {
    return todos.filter((t) => t.status === 'completed').length;
  }, [todos]);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={[styles.mainContent, { backgroundColor: colors.surface }]}>
        {activeTab === 'calendar' ? (
        <>
          <Header onPressProfile={() => setProfileVisible(true)} />

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
        {/* Card Compacto de Preview Semanal */}
        <CompactCalendarCard
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onOpenFullCalendar={() => setCalendarModalVisible(true)}
          eventDates={eventDates}
        />

        {/* Section: Eventos do dia selecionado */}
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
                  <EventCard key={ev.id} event={ev} onDelete={handleDeleteEvent} />
                ))}
              </View>
            )}
          </>
        ) : (
          dayEvents.map((ev) => (
            <EventCard key={ev.id} event={ev} onDelete={handleDeleteEvent} />
          ))
        )}

        {/* Section: Checklist de tarefas */}
        <View style={[styles.sectionHeader, { marginTop: tokens.spacing.lg }]}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Tarefas e Pendências</Text>
            <Text style={[styles.checklistSubtitle, { color: colors.textMuted }]}>
              {completedCount}/{todos.length} concluídos
            </Text>
          </View>
        </View>

        {loading && todos.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
        ) : todos.length === 0 ? (
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
            {todos.map((t, idx) => (
              <TodoItem
                key={t.id}
                todo={t}
                onToggle={handleToggleTodo}
                onDelete={handleDeleteTodo}
                isLast={idx === todos.length - 1}
                grouped
              />
            ))}
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
            onSaveTodo={async (title, priority) => {
              await handleCreateTodo({
                title,
                priority,
                due_date: selectedDate.toISOString(),
              });
            }}
          />

          <CalendarModal
            visible={calendarModalVisible}
            onClose={() => setCalendarModalVisible(false)}
            events={events}
            selectedDate={selectedDate}
            onSelectDate={(d) => setSelectedDate(d)}
            onOpenCreate={() => setCreateModalVisible(true)}
            onDeleteEvent={handleDeleteEvent}
            todos={todos}
            onToggleTodo={handleToggleTodo}
            onDeleteTodo={handleDeleteTodo}
            onRefresh={() => loadData(false)}
          />
        </>
      ) : (
        <ChatScreen onDataChanged={loadData} onPressProfile={() => setProfileVisible(true)} onKeyboardStateChange={setIsKeyboardOpen} />
      )}
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
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: tokens.spacing.lg,
    paddingBottom: 100,
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
});
