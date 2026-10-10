import React from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { ChatMessage } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { EventInlineCard } from './cards/EventInlineCard';
import { ConflictInlineCard } from './cards/ConflictInlineCard';
import { TodoInlineCard } from './cards/TodoInlineCard';
import { VitoMascot } from '../common/VitoMascot';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  onSelectSlot?: (slot: import('../../types').TimeSlot, message: ChatMessage) => void;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({ message, onSelectSlot }) => {
  const { colors, isDark } = useTheme();
  const isUser = message.sender === 'user';

  return (
    <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowVito]}>
      {!isUser && (
        <View style={[styles.vitoAvatar, { backgroundColor: colors.surfaceContainerHigh, borderWidth: 1, borderColor: colors.outlineVariant }]}>
          <VitoMascot size={26} animated={false} />
        </View>
      )}

      <View
        style={[
          styles.bubble,
          isUser
            ? [
                styles.bubbleUser,
                {
                  backgroundColor: isDark ? colors.surfaceContainerHigh : colors.primary,
                  borderWidth: 1,
                  borderColor: isDark ? colors.outlineVariant : colors.primary,
                },
              ]
            : [
                styles.bubbleVito,
                {
                  backgroundColor: colors.surfaceContainer,
                  borderColor: colors.outlineVariant,
                  borderWidth: 1,
                },
              ],
        ]}
      >
        {message.imageUri && (
          <Image source={{ uri: message.imageUri }} style={styles.imageAttachment} resizeMode="cover" />
        )}
        <View style={message.id.includes('audio') ? styles.voiceTextRow : undefined}>
          {message.id.includes('audio') && (
            <MaterialIcons
              name="mic"
              size={16}
              color={isUser ? (isDark ? '#FAFAFA' : '#FFFFFF') : colors.primary}
              style={{ marginRight: 6, marginTop: 2 }}
            />
          )}
          <Text
            style={[
              styles.messageText,
              message.id.includes('audio') && { flexShrink: 1 },
              isUser
                ? [styles.messageTextUser, { color: isDark ? '#FAFAFA' : '#FFFFFF' }]
                : [styles.messageTextVito, { color: colors.onSurface }],
            ]}
          >
            {message.text}
          </Text>
        </View>

        {/* Cards Estruturados Modulares */}
        {message.event && <EventInlineCard event={message.event} />}
        {message.conflict?.has_conflict && (
          <ConflictInlineCard
            conflict={message.conflict}
            onSelectSlot={(slot) => onSelectSlot?.(slot, message)}
          />
        )}
        {message.todo && <TodoInlineCard todo={message.todo} />}
        {message.trigger && (
          <View
            style={{
              marginTop: 8,
              padding: 10,
              borderRadius: 12,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderWidth: 1,
              borderColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.08)',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <MaterialIcons name="track-changes" size={16} color="#10B981" style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.onSurface, flex: 1 }}>
                {message.trigger.title}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }} numberOfLines={2}>
              {message.trigger.query}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <MaterialIcons name="radar" size={13} color="#10B981" style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#10B981' }}>
                Vigília Ativa em Disparadores
              </Text>
            </View>
          </View>
        )}

        <View style={styles.metaRow}>
          <Text
            style={[
              styles.timestamp,
              { color: isUser ? (isDark ? '#A1A1AA' : 'rgba(255,255,255,0.7)') : colors.textMuted },
            ]}
          >
            {new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {isUser && (
            <MaterialIcons
              name="done-all"
              size={13}
              color={isDark ? '#FAFAFA' : 'rgba(255,255,255,0.85)'}
            />
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
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: tokens.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.xs + 2,
    marginBottom: 4,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 20,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm + 4,
  },
  // Balão do Usuário: M3 Primary Container com texto On-Primary-Container
  bubbleUser: {
    backgroundColor: tokens.colors.primaryContainer,
    borderBottomRightRadius: 4,
  },
  // Balão do Vito: M3 Surface Container High
  bubbleVito: {
    backgroundColor: tokens.colors.surfaceContainerHigh,
    borderTopLeftRadius: 4,
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
  voiceTextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  imageAttachment: {
    width: '100%',
    height: 180,
    borderRadius: MD3Shapes.medium,
    marginBottom: tokens.spacing.sm,
  },
});
