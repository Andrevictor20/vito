import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { tokens } from '../../theme/tokens';
import { ChatMessage } from '../../types';

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({ message }) => {
  const isUser = message.sender === 'user';

  return (
    <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowVito]}>
      {!isUser && (
        <View style={styles.vitoAvatar}>
          <Text style={styles.vitoAvatarText}>V</Text>
        </View>
      )}

      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleVito]}>
        <Text style={[styles.messageText, isUser ? styles.messageTextUser : styles.messageTextVito]}>
          {message.text}
        </Text>

        {/* Card Inline de Evento Criado (Stitch Executive Card) */}
        {message.event && (
          <View style={[styles.eventCard, message.conflict?.has_conflict && styles.eventCardConflict]}>
            <View style={styles.cardTopRow}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.cardIconBox}>
                  <Text style={styles.cardIconText}>📅</Text>
                </View>
                <View style={styles.cardTitleCol}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{message.event.title}</Text>
                  <Text style={styles.cardSubtitle}>Agenda • Google Calendar</Text>
                </View>
              </View>

              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusPillText}>Confirmado</Text>
              </View>
            </View>

            {/* Grid de Detalhes */}
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Horário</Text>
                <Text style={styles.detailValue}>
                  {new Date(message.event.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {new Date(message.event.end_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>

            {message.conflict?.has_conflict && (
              <View style={styles.conflictCard}>
                <Text style={styles.conflictIcon}>⚠️</Text>
                <Text style={styles.conflictText}>{message.conflict.message}</Text>
              </View>
            )}
          </View>
        )}

        {/* Card Inline de Tarefa Criada (Stitch Executive Todo) */}
        {message.todo && (
          <View style={styles.todoCard}>
            <View style={styles.todoRow}>
              <View style={styles.todoCheckCircle}>
                <Text style={styles.todoCheckMark}>✓</Text>
              </View>
              <View style={styles.todoContent}>
                <Text style={styles.todoTitle} numberOfLines={1}>{message.todo.title}</Text>
                <Text style={styles.todoMeta}>
                  Prioridade: <Text style={styles.todoPriority}>{message.todo.priority.toUpperCase()}</Text>
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.metaRow}>
          <Text style={[styles.timestamp, isUser ? styles.timestampUser : styles.timestampVito]}>
            {new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {isUser && <Text style={styles.checkDone}>✓✓</Text>}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  messageRow: {
    flexDirection: 'row',
    marginBottom: tokens.spacing.md,
    alignItems: 'flex-end',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowVito: {
    justifyContent: 'flex-start',
  },
  vitoAvatar: {
    width: 28,
    height: 28,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.primaryLight,
    borderWidth: 1,
    borderColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.xs,
    marginBottom: 4,
  },
  vitoAvatarText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.colors.primary,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: tokens.radii.lg,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm + 3,
  },
  bubbleUser: {
    backgroundColor: tokens.colors.surfaceElevated,
    borderTopRightRadius: 4,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  bubbleVito: {
    backgroundColor: tokens.colors.surfaceSubtle,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  messageText: {
    fontSize: tokens.typography.size.md,
    lineHeight: tokens.typography.lineHeight.md,
  },
  messageTextUser: {
    color: tokens.colors.textPrimary,
  },
  messageTextVito: {
    color: tokens.colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timestamp: {
    fontSize: 11,
  },
  timestampUser: {
    color: tokens.colors.textMuted,
  },
  timestampVito: {
    color: tokens.colors.textMuted,
  },
  checkDone: {
    fontSize: 10,
    color: tokens.colors.primary,
    fontWeight: '700',
  },

  // Stitch Executive Event Card
  eventCard: {
    marginTop: tokens.spacing.sm,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: tokens.colors.primaryContainer,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    gap: 8,
  },
  eventCardConflict: {
    borderLeftColor: tokens.colors.danger,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cardIconBox: {
    width: 28,
    height: 28,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconText: {
    fontSize: 13,
  },
  cardTitleCol: {
    flex: 1,
  },
  cardTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 11,
    color: tokens.colors.textSecondary,
    marginTop: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.successLight,
    gap: 4,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: tokens.colors.success,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.success,
  },
  detailsGrid: {
    backgroundColor: tokens.colors.surfaceSubtle,
    borderRadius: tokens.radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 11,
    color: tokens.colors.textMuted,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.colors.textPrimary,
  },
  conflictCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.colors.dangerLight,
    padding: 8,
    borderRadius: tokens.radii.sm,
  },
  conflictIcon: {
    fontSize: 12,
  },
  conflictText: {
    fontSize: 11,
    color: tokens.colors.danger,
    flex: 1,
    fontWeight: tokens.typography.weight.medium,
  },

  // Stitch Executive Todo Card
  todoCard: {
    marginTop: tokens.spacing.sm,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: tokens.colors.success,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  todoCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tokens.colors.successLight,
    borderWidth: 1,
    borderColor: tokens.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todoCheckMark: {
    fontSize: 12,
    color: tokens.colors.success,
    fontWeight: '700',
  },
  todoContent: {
    flex: 1,
  },
  todoTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.textPrimary,
  },
  todoMeta: {
    fontSize: 11,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  todoPriority: {
    color: tokens.colors.primary,
    fontWeight: tokens.typography.weight.semibold,
  },
});
