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

const renderInlineFormatted = (raw: string, textColor: string) => {
  if (!raw) return null;

  // Remove caracteres markdown crus residuais como hashtags soltas
  const clean = raw.replace(/^#+\s*/, '');

  // Divide por delimitadores de negrito **
  const parts = clean.split(/(\*\*[^*]+?\*\*)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const boldText = part.slice(2, -2);
      return (
        <Text key={idx} style={{ fontWeight: '700', color: textColor }}>
          {boldText}
        </Text>
      );
    }
    // Remove asteriscos soltos indesejados da parte comum
    const sanitizedPart = part.replace(/\*/g, '');
    return (
      <Text key={idx} style={{ color: textColor }}>
        {sanitizedPart}
      </Text>
    );
  });
};

interface FormattedChatMessageTextProps {
  text: string;
  isUser: boolean;
  style?: any;
  textColor: string;
}

const FormattedChatMessageText: React.FC<FormattedChatMessageTextProps> = ({
  text,
  isUser,
  style,
  textColor,
}) => {
  if (!text) return null;

  if (isUser) {
    return <Text style={[style, { color: textColor }]}>{text}</Text>;
  }

  const lines = text.split('\n');

  return (
    <View style={styles.formattedContainer}>
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <View key={lineIdx} style={styles.paragraphSpacer} />;
        }

        // Títulos Markdown (# Título, ## Subtítulo)
        if (/^#{1,4}\s+/.test(trimmed)) {
          const headerClean = trimmed.replace(/^#{1,4}\s+/, '').trim();
          return (
            <Text key={lineIdx} style={[style, styles.headerLine, { color: textColor }]}>
              {renderInlineFormatted(headerClean, textColor)}
            </Text>
          );
        }

        // Marcadores de lista (* Item, - Item, + Item)
        if (/^[\*\-\+]\s+/.test(trimmed)) {
          const bulletClean = trimmed.replace(/^[\*\-\+]\s+/, '').trim();
          return (
            <View key={lineIdx} style={styles.bulletRow}>
              <Text style={[styles.bulletSymbol, { color: textColor }]}>•</Text>
              <Text style={[style, styles.bulletContent, { color: textColor }]}>
                {renderInlineFormatted(bulletClean, textColor)}
              </Text>
            </View>
          );
        }

        // Linha normal
        return (
          <Text key={lineIdx} style={[style, styles.normalLine, { color: textColor }]}>
            {renderInlineFormatted(line, textColor)}
          </Text>
        );
      })}
    </View>
  );
};

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
          <FormattedChatMessageText
            text={message.text}
            isUser={isUser}
            textColor={isUser ? (isDark ? '#FAFAFA' : '#FFFFFF') : colors.onSurface}
            style={[
              styles.messageText,
              message.id.includes('audio') && { flexShrink: 1 },
              isUser ? styles.messageTextUser : styles.messageTextVito,
            ]}
          />
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
                Radar Ativo no Vito
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
  formattedContainer: {
    gap: 3,
  },
  paragraphSpacer: {
    height: 8,
  },
  headerLine: {
    fontWeight: '700',
    fontSize: 15,
    marginTop: 4,
    marginBottom: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 2,
    marginVertical: 1.5,
  },
  bulletSymbol: {
    fontSize: 14,
    lineHeight: 20,
    marginRight: 6,
    fontWeight: '700',
  },
  bulletContent: {
    flex: 1,
    lineHeight: 20,
  },
  normalLine: {
    lineHeight: 20,
  },
});
