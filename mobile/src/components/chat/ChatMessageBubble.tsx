import React from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { ChatMessage } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { EventInlineCard } from './cards/EventInlineCard';
import { ConflictInlineCard } from './cards/ConflictInlineCard';
import { TodoInlineCard } from './cards/TodoInlineCard';
import { PendingInlineCard } from './cards/PendingInlineCard';
import { TriggerInlineCard } from './cards/TriggerInlineCard';
import { BookingInlineCard } from './cards/BookingInlineCard';
import { MeetingInlineCard } from './cards/MeetingInlineCard';
import { VitoMascot } from '../common/VitoMascot';
import { preparePlainTextForCopy } from '../../utils/chatActions';

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
  onEditMessage?: (text: string) => void;
  onSaveEdit?: (messageId: string, newText: string) => void;
  disabled?: boolean;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  message,
  onSelectSlot,
  onEditMessage,
  onSaveEdit,
  disabled = false,
}) => {
  const { colors, isDark } = useTheme();
  const [copied, setCopied] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [draftText, setDraftText] = React.useState(message.text);
  const isUser = message.sender === 'user';

  React.useEffect(() => {
    setDraftText(message.text);
  }, [message.text]);

  const handleStartEdit = () => {
    if (disabled) return;
    setDraftText(message.text);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setDraftText(message.text);
    setIsEditing(false);
  };

  const handleConfirmEdit = () => {
    const trimmed = draftText.trim();
    if (!trimmed) return;
    setIsEditing(false);
    if (onSaveEdit) {
      onSaveEdit(message.id, trimmed);
    } else if (onEditMessage) {
      onEditMessage(trimmed);
    }
  };

  const handleCopy = async () => {
    try {
      const textToCopy = preparePlainTextForCopy(message.text);
      await Clipboard.setStringAsync(textToCopy);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (e) {
      console.warn('[ChatMessageBubble] Falha ao copiar texto:', e);
    }
  };

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
        {isUser && isEditing ? (
          <View style={styles.inlineEditContainer}>
            <TextInput
              style={[
                styles.inlineEditInput,
                {
                  color: isDark ? '#FAFAFA' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.4)',
                },
              ]}
              value={draftText}
              onChangeText={setDraftText}
              multiline
              autoFocus
              maxLength={1000}
              placeholderTextColor={isDark ? '#A1A1AA' : '#E0E7FF'}
            />
            <View style={styles.inlineEditActions}>
              <TouchableOpacity
                style={[styles.inlineEditButton, styles.inlineEditCancelButton]}
                onPress={handleCancelEdit}
                activeOpacity={0.7}
                accessibilityLabel="Cancelar edição"
              >
                <MaterialIcons name="close" size={14} color={isDark ? '#A1A1AA' : '#E0E7FF'} />
                <Text style={[styles.inlineEditButtonText, { color: isDark ? '#A1A1AA' : '#E0E7FF' }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.inlineEditButton,
                  styles.inlineEditSaveButton,
                  { backgroundColor: isDark ? colors.primary : '#FFFFFF' },
                ]}
                onPress={handleConfirmEdit}
                activeOpacity={0.7}
                accessibilityLabel="Salvar e reenviar mensagem"
              >
                <MaterialIcons
                  name="send"
                  size={14}
                  color={isDark ? colors.onPrimary : colors.primary}
                />
                <Text
                  style={[
                    styles.inlineEditButtonText,
                    { color: isDark ? colors.onPrimary : colors.primary, fontWeight: '700' },
                  ]}
                >
                  Salvar e Enviar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
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
        )}

        {/* Cards Estruturados Modulares */}
        {message.event && <EventInlineCard event={message.event} />}
        {message.conflict?.has_conflict && (
          <ConflictInlineCard
            conflict={message.conflict}
            onSelectSlot={(slot) => onSelectSlot?.(slot, message)}
          />
        )}
        {message.todo && <TodoInlineCard todo={message.todo} />}
        {message.pending && <PendingInlineCard pending={message.pending} />}
        {message.trigger && <TriggerInlineCard trigger={message.trigger} />}
        {message.booking && <BookingInlineCard booking={message.booking} />}
        {message.meeting && <MeetingInlineCard meeting={message.meeting} />}

        <View style={styles.metaRow}>
          {/* Botão Copiar Resposta do Vito */}
          {!isUser && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                copied && { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5' },
              ]}
              onPress={handleCopy}
              hitSlop={tokens.hitSlop.sm}
              activeOpacity={0.7}
              accessibilityLabel="Copiar resposta do Vito"
            >
              <MaterialIcons
                name={copied ? 'check' : 'content-copy'}
                size={13}
                color={copied ? '#10B981' : colors.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.actionButtonText,
                  { color: copied ? '#10B981' : colors.onSurfaceVariant },
                ]}
              >
                {copied ? 'Copiado' : 'Copiar'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Botão Editar Mensagem do Usuário */}
          {isUser && (onSaveEdit || onEditMessage) && !isEditing && (
            <TouchableOpacity
              style={[styles.actionButton, disabled && { opacity: 0.5 }]}
              onPress={handleStartEdit}
              disabled={disabled}
              hitSlop={tokens.hitSlop.sm}
              activeOpacity={0.7}
              accessibilityLabel="Editar e reenviar mensagem"
            >
              <MaterialIcons
                name="edit"
                size={13}
                color={isDark ? '#A1A1AA' : 'rgba(255,255,255,0.75)'}
              />
              <Text
                style={[
                  styles.actionButtonText,
                  { color: isDark ? '#A1A1AA' : 'rgba(255,255,255,0.75)' },
                ]}
              >
                Editar
              </Text>
            </TouchableOpacity>
          )}

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
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 4,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '600',
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
  inlineEditContainer: {
    width: '100%',
    minWidth: 220,
    marginTop: 2,
    marginBottom: 4,
  },
  inlineEditInput: {
    borderWidth: 1,
    borderRadius: MD3Shapes.medium,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
    minHeight: 56,
  },
  inlineEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  inlineEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: MD3Shapes.full,
    gap: 4,
  },
  inlineEditCancelButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  inlineEditSaveButton: {
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  inlineEditButtonText: {
    fontSize: 12,
  },
});
