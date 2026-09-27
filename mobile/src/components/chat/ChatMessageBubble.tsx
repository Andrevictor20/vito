import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { ChatMessage } from '../../types';
import { EventInlineCard } from './cards/EventInlineCard';
import { ConflictInlineCard } from './cards/ConflictInlineCard';
import { TodoInlineCard } from './cards/TodoInlineCard';

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

        {/* Cards Estruturados Modulares */}
        {message.event && <EventInlineCard event={message.event} />}
        {message.conflict?.has_conflict && <ConflictInlineCard conflict={message.conflict} />}
        {message.todo && <TodoInlineCard todo={message.todo} />}

        <View style={styles.metaRow}>
          <Text style={[styles.timestamp, isUser ? styles.timestampUser : styles.timestampVito]}>
            {new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {isUser && (
            <MaterialIcons name="done-all" size={13} color={tokens.colors.primary} />
          )}
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
});
