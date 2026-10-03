import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { CalendarView } from './CalendarView';
import { Event } from '../../types';

interface CalendarModalProps {
  visible: boolean;
  onClose: () => void;
  events: Event[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onOpenCreate?: () => void;
}

export const CalendarModal: React.FC<CalendarModalProps> = ({
  visible,
  onClose,
  events,
  selectedDate,
  onSelectDate,
  onOpenCreate,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header M3 */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityLabel="Fechar calendário"
              hitSlop={tokens.hitSlop.sm}
            >
              <MaterialIcons name="arrow-back" size={24} color={tokens.colors.primary} />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Calendário</Text>

            <TouchableOpacity
              style={styles.todayBtn}
              onPress={() => onSelectDate(new Date())}
              activeOpacity={0.75}
              accessibilityLabel="Ir para hoje"
            >
              <Text style={styles.todayBtnText}>Hoje</Text>
            </TouchableOpacity>
          </View>

          {/* Calendário Completo M3 */}
          <View style={styles.content}>
            <CalendarView
              events={events}
              selectedDate={selectedDate}
              onSelectDate={(date) => {
                onSelectDate(date);
              }}
            />
          </View>

          {/* FAB Inferior se fornecido */}
          {onOpenCreate && (
            <TouchableOpacity
              style={styles.fab}
              onPress={() => {
                onClose();
                onOpenCreate();
              }}
              activeOpacity={0.85}
              accessibilityLabel="Novo evento"
            >
              <MaterialIcons name="add" size={26} color={tokens.colors.onPrimary} />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
  },
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.outlineVariant,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: tokens.typography.size.titleMedium,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.colors.onSurface,
  },
  todayBtn: {
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
    borderRadius: MD3Shapes.full,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs + 2,
  },
  todayBtnText: {
    fontSize: tokens.typography.size.labelMedium,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.primary,
  },
  content: {
    flex: 1,
    padding: tokens.spacing.md,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: MD3Shapes.large,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadows.level3,
  },
});
