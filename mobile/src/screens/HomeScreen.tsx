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

export const HomeScreen: React.FC<{
  serverUrl: string;
  onToggleServer: () => void;
}> = ({ serverUrl, onToggleServer }) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'calendar'>('chat');
  const [profileVisible, setProfileVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const {
    events,
    todos,
    loading,
    refreshing,
    onRefresh,
    selectedDate,
    setSelectedDate,
    dayEvents,
    isTodaySelected,
    handleDeleteEvent,
    handleToggleTodo,
    handleDeleteTodo,
    handleAssistantSubmit,
    loadData,
  } = useHomeData();

  const eventDates = useMemo(() => {
    const dates = new Set<string>();
    events.forEach((ev) => {
      try {
        const d = new Date(ev.start_at);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dates.add(k);
      } catch {}
    });
    return dates;
  }, [events]);

  const completedCount = useMemo(() => {
    return todos.filter((t) => t.status === 'completed').length;
  }, [todos]);

  return (
    <View style={styles.container}>
      <View style={styles.mainContent}>
        {activeTab === 'calendar' ? (
        <>
          <Header onPressProfile={() => setProfileVisible(true)} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.colors.primary}
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

        {/* Section: Eventos de hoje */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Eventos de hoje</Text>
          <View style={styles.countBadgePill}>
            <Text style={styles.countBadgeText}>
              {dayEvents.length} {dayEvents.length === 1 ? 'evento' : 'eventos'}
            </Text>
          </View>
        </View>

        {loading && events.length === 0 ? (
          <ActivityIndicator color={tokens.colors.primary} style={{ marginVertical: 20 }} />
        ) : dayEvents.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconContainer}>
              <MaterialIcons name="event-available" size={20} color={tokens.colors.primary} />
            </View>
            <View style={styles.emptyContent}>
              <Text style={styles.emptyTitle}>Dia Livre</Text>
              <Text style={styles.emptySub}>
                {isTodaySelected
                  ? 'Nenhum compromisso marcado para hoje.'
                  : `Nenhum compromisso marcado para ${selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}.`}
              </Text>
            </View>
          </View>
        ) : (
          dayEvents.map((ev) => (
            <EventCard key={ev.id} event={ev} onDelete={handleDeleteEvent} />
          ))
        )}

        {/* Section: Checklist da festa */}
        <View style={[styles.sectionHeader, { marginTop: tokens.spacing.lg }]}>
          <View>
            <Text style={styles.sectionTitle}>Checklist da festa</Text>
            <Text style={styles.checklistSubtitle}>
              {completedCount}/{todos.length} concluídos
            </Text>
          </View>
        </View>

        {loading && todos.length === 0 ? (
          <ActivityIndicator color={tokens.colors.primary} style={{ marginVertical: 20 }} />
        ) : todos.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={[styles.emptyIconContainer, { backgroundColor: 'rgba(46, 108, 56, 0.12)' }]}>
              <MaterialIcons name="done-all" size={20} color={tokens.colors.success} />
            </View>
            <View style={styles.emptyContent}>
              <Text style={styles.emptyTitle}>Tudo em Dia</Text>
              <Text style={styles.emptySub}>Nenhuma tarefa pendente no momento.</Text>
            </View>
          </View>
        ) : (
          <View style={styles.checklistCard}>
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
            style={styles.createFab}
            onPress={() => setCreateModalVisible(true)}
            activeOpacity={0.85}
            accessibilityLabel="Criar nova tarefa ou evento"
          >
            <MaterialIcons name="add" size={20} color={tokens.colors.onPrimary} />
            <Text style={styles.createFabText}>Nova Tarefa ou Evento</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

          <CreateItemModal
            visible={createModalVisible}
            onClose={() => setCreateModalVisible(false)}
            selectedDate={selectedDate}
            onSaveEvent={(title) => {
              handleAssistantSubmit(`Agendar evento: ${title} para o dia ${selectedDate.toLocaleDateString('pt-BR')}`);
            }}
            onSaveTodo={(title, priority) => {
              handleAssistantSubmit(`Nova tarefa: ${title} prioridade ${priority}`);
            }}
          />

          <CalendarModal
            visible={calendarModalVisible}
            onClose={() => setCalendarModalVisible(false)}
            events={events}
            selectedDate={selectedDate}
            onSelectDate={(d) => {
              setSelectedDate(d);
              setCalendarModalVisible(false);
            }}
            onOpenCreate={() => setCreateModalVisible(true)}
          />
        </>
      ) : (
        <ChatScreen onDataChanged={loadData} onPressProfile={() => setProfileVisible(true)} onKeyboardStateChange={setIsKeyboardOpen} />
      )}
      </View>

      {/* Bottom M3 Navigation Bar */}
      <FloatingTabBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        visible={!isKeyboardOpen}
      />

      <ProfileModal
        visible={profileVisible}
        onClose={() => setProfileVisible(false)}
        serverUrl={serverUrl}
        onToggleServer={onToggleServer}
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
