import React, { useState } from 'react';
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
import { tokens } from '../theme/tokens';
import { FloatingTabBar } from '../components/common/FloatingTabBar';
import { Header } from '../components/common/Header';
import { CalendarView } from '../components/calendar/CalendarView';
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

  return (
    <View style={styles.container}>
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
        {/* Calendário Interativo do Mês */}
        <CalendarView
          events={events}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        {/* Section: Timeline da Agenda */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {isTodaySelected
              ? 'Agenda de Hoje'
              : `Agenda (${selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})`}
          </Text>
          <Text style={styles.countBadge}>{dayEvents.length}</Text>
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

        {/* Section: Tarefas Pendentes */}
        <View style={[styles.sectionHeader, { marginTop: tokens.spacing.lg }]}>
          <Text style={styles.sectionTitle}>Tarefas & Lembretes</Text>
          <Text style={styles.countBadge}>{todos.length}</Text>
        </View>

        {loading && todos.length === 0 ? (
          <ActivityIndicator color={tokens.colors.primary} style={{ marginVertical: 20 }} />
        ) : todos.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={[styles.emptyIconContainer, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
              <MaterialIcons name="done-all" size={20} color={tokens.colors.success} />
            </View>
            <View style={styles.emptyContent}>
              <Text style={styles.emptyTitle}>Tudo em Dia</Text>
              <Text style={styles.emptySub}>Nenhuma tarefa pendente no momento.</Text>
            </View>
          </View>
        ) : (
          todos.map((t) => (
            <TodoItem
              key={t.id}
              todo={t}
              onToggle={handleToggleTodo}
              onDelete={handleDeleteTodo}
            />
          ))
        )}
      </ScrollView>

          {/* Botão de Criação Rápida de Nova Tarefa / Evento (Stitch CTA) */}
          <View style={styles.createBtnWrapper}>
            <TouchableOpacity
              style={styles.createFab}
              onPress={() => setCreateModalVisible(true)}
              activeOpacity={0.85}
              accessibilityLabel="Criar nova tarefa ou evento"
            >
              <MaterialIcons name="add" size={20} color="#ffffff" />
              <Text style={styles.createFabText}>Nova Tarefa ou Evento</Text>
            </TouchableOpacity>
          </View>

          {/* Modal de Criação Executiva */}
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
        </>
      ) : (
        <ChatScreen onDataChanged={loadData} onPressProfile={() => setProfileVisible(true)} onKeyboardStateChange={setIsKeyboardOpen} />
      )}

      {/* Bottom Floating Pill Navigation */}
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
    backgroundColor: tokens.colors.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: tokens.spacing.lg,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.textPrimary,
    letterSpacing: -0.2,
  },
  countBadge: {
    backgroundColor: tokens.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    color: tokens.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tokens.radii.full,
  },
  emptyCard: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: tokens.spacing.md,
  },
  emptyIconContainer: {
    width: 38,
    height: 38,
    borderRadius: tokens.radii.md,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
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
    color: tokens.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  emptySub: {
    color: tokens.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.surfaceBorder,
    paddingVertical: 8,
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: tokens.radii.full,
  },
  tabButtonActive: {
    backgroundColor: tokens.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  tabText: {
    fontSize: 12,
    color: tokens.colors.textMuted,
    fontWeight: '500',
  },
  tabTextActive: {
    color: tokens.colors.primary,
    fontWeight: '700',
  },
  createBtnWrapper: {
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
  },
  createFab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: tokens.colors.cobalt,
    paddingVertical: 13,
    borderRadius: tokens.radii.full,
    shadowColor: tokens.colors.cobalt,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  createFabText: {
    color: '#ffffff',
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    letterSpacing: 0.1,
  },
});
