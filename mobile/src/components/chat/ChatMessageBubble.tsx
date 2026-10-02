import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
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
            <MaterialIcons name="done-all" size={13} color={tokens.colors.onPrimaryContainer} />
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
    borderRadius: MD3Shapes.full,
    backgroundColor: tokens.colors.secondaryContainer,
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.xs,
    marginBottom: 4,
  },
  vitoAvatarText: {
    fontSize: tokens.typography.size.labelSmall,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.colors.onSecondaryContainer,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: MD3Shapes.large,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm + 2,
  },
  // Balão do Usuário: M3 Primary Container com texto On-Primary-Container
  bubbleUser: {
    backgroundColor: tokens.colors.primaryContainer,
    borderBottomRightRadius: MD3Shapes.extraSmall,
  },
  // Balão do Vito: M3 Surface Container com texto On-Surface
  bubbleVito: {
    backgroundColor: tokens.colors.surfaceContainer,
    borderBottomLeftRadius: MD3Shapes.extraSmall,
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
  },
  messageText: {
    fontSize: tokens.typography.size.bodyLarge,
    lineHeight: tokens.typography.lineHeight.bodyLarge,
  },
  messageTextUser: {
    color: tokens.colors.onPrimaryContainer,
  },
  messageTextVito: {
    color: tokens.colors.onSurface,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: tokens.spacing.xs,
    gap: 4,
  },
  timestamp: {
    fontSize: tokens.typography.size.labelSmall,
  },
  timestampUser: {
    color: tokens.colors.onPrimaryContainer,
    opacity: 0.8,
  },
  timestampVito: {
    color: tokens.colors.onSurfaceVariant,
  },
});
