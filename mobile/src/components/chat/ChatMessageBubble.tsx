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

        {/* Card Inline de Evento Criado */}
        {message.event && (
          <View style={styles.actionCard}>
            <View style={styles.actionCardHeader}>
              <Text style={styles.actionCardTag}>📅 Compromisso Criado</Text>
            </View>
            <Text style={styles.actionCardTitle}>{message.event.title}</Text>
            <Text style={styles.actionCardTime}>
              {new Date(message.event.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              {' - '}
              {new Date(message.event.end_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {message.conflict?.has_conflict && (
              <View style={styles.conflictBadge}>
                <Text style={styles.conflictBadgeText}>⚠️ {message.conflict.message}</Text>
              </View>
            )}
          </View>
        )}

        {/* Card Inline de Tarefa Criada */}
        {message.todo && (
          <View style={styles.actionCard}>
            <View style={styles.actionCardHeader}>
              <Text style={styles.actionCardTag}>✅ Tarefa Adicionada</Text>
            </View>
            <Text style={styles.actionCardTitle}>{message.todo.title}</Text>
            <Text style={styles.actionCardTime}>Prioridade: {message.todo.priority.toUpperCase()}</Text>
          </View>
        )}

        <Text style={[styles.timestamp, isUser ? styles.timestampUser : styles.timestampVito]}>
          {new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
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
    maxWidth: '82%',
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm + 2,
  },
  bubbleUser: {
    backgroundColor: tokens.colors.surfaceElevated,
    borderBottomRightRadius: 2,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  bubbleVito: {
    backgroundColor: tokens.colors.surface,
    borderBottomLeftRadius: 2,
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
  timestamp: {
    fontSize: tokens.typography.size.xs - 2,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  timestampUser: {
    color: tokens.colors.textMuted,
  },
  timestampVito: {
    color: tokens.colors.textMuted,
  },
  actionCard: {
    marginTop: tokens.spacing.sm,
    backgroundColor: tokens.colors.surfaceSubtle,
    borderRadius: tokens.radii.sm,
    padding: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  actionCardHeader: {
    marginBottom: 2,
  },
  actionCardTag: {
    fontSize: tokens.typography.size.xs - 1,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.primary,
    textTransform: 'uppercase',
  },
  actionCardTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.textPrimary,
  },
  actionCardTime: {
    fontSize: tokens.typography.size.xs,
    color: tokens.colors.textSecondary,
    marginTop: 2,
  },
  conflictBadge: {
    marginTop: tokens.spacing.xs,
    backgroundColor: tokens.colors.warningLight,
    padding: tokens.spacing.xs,
    borderRadius: tokens.radii.xs,
  },
  conflictBadgeText: {
    fontSize: tokens.typography.size.xs,
    color: tokens.colors.warning,
  },
});
