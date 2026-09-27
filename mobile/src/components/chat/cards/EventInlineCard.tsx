import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../../theme/tokens';
import { Event } from '../../../types';

interface EventInlineCardProps {
  event: Event;
  onPressDetail?: () => void;
}

export const EventInlineCard: React.FC<EventInlineCardProps> = ({ event, onPressDetail }) => {
  const startTime = new Date(event.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const endTime = new Date(event.end_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.card}>
      <View style={styles.accentBar} />

      {/* Header do Card */}
      <View style={styles.topRow}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBox}>
            <MaterialIcons name="event-available" size={18} color={tokens.colors.primary} />
          </View>
          <View style={styles.titleCol}>
            <Text style={styles.title} numberOfLines={1}>{event.title}</Text>
            <Text style={styles.subtitle}>Agenda • Google Calendar</Text>
          </View>
        </View>

        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Confirmado</Text>
        </View>
      </View>

      {/* Grid de Detalhes de Horário e Local */}
      <View style={styles.detailsGrid}>
        <View style={styles.detailItem}>
          <MaterialIcons name="schedule" size={14} color={tokens.colors.textSecondary} />
          <Text style={styles.detailText}>{startTime} - {endTime}</Text>
        </View>
        <View style={styles.detailItem}>
          <MaterialIcons name="meeting-room" size={14} color={tokens.colors.textSecondary} />
          <Text style={styles.detailText} numberOfLines={1}>Meet • Sala Executiva</Text>
        </View>
      </View>

      {/* Linha de Participantes e Ação */}
      <View style={styles.actionRow}>
        <View style={styles.attendeesRow}>
          <View style={[styles.avatarBubble, { backgroundColor: tokens.colors.primaryContainer }]}>
            <Text style={styles.avatarBubbleText}>AV</Text>
          </View>
          <View style={[styles.avatarBubble, { backgroundColor: tokens.colors.secondaryContainer, marginLeft: -6 }]}>
            <Text style={styles.avatarBubbleText}>LC</Text>
          </View>
          <View style={[styles.avatarBubble, { backgroundColor: tokens.colors.surfaceContainerHighest, marginLeft: -6 }]}>
            <Text style={styles.avatarBubbleText}>+2</Text>
          </View>
        </View>

        {onPressDetail && (
          <TouchableOpacity style={styles.detailButton} onPress={onPressDetail} activeOpacity={0.8}>
            <Text style={styles.detailButtonText}>Ver pauta</Text>
            <MaterialIcons name="arrow-forward" size={14} color={tokens.colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surfaceContainer,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    marginTop: tokens.spacing.xs,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    gap: tokens.spacing.sm,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3.5,
    backgroundColor: tokens.colors.cobalt,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
  },
  title: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
  },
  subtitle: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.size.xs,
    marginTop: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radii.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.success,
  },
  statusText: {
    color: tokens.colors.success,
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    backgroundColor: tokens.colors.surfaceContainerLow,
    padding: tokens.spacing.xs + 2,
    borderRadius: tokens.radii.sm,
  },
  detailItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.medium,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  attendeesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBubble: {
    width: 22,
    height: 22,
    borderRadius: tokens.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: tokens.colors.surfaceContainer,
  },
  avatarBubbleText: {
    color: tokens.colors.textPrimary,
    fontSize: 9,
    fontWeight: tokens.typography.weight.bold,
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: tokens.colors.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.full,
  },
  detailButtonText: {
    color: tokens.colors.primary,
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
  },
});
