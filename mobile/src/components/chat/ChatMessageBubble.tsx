import React from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { ChatMessage, TimeSlot } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { ChatStructuredCards } from './cards/ChatStructuredCards';
import { FormattedChatMessageText } from './FormattedChatMessageText';
import { ChatMessageActionBar } from './ChatMessageActionBar';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  onSelectSlot?: (slot: TimeSlot, message: ChatMessage) => void;
  onEditMessage?: (text: string) => void;
  onSaveEdit?: (messageId: string, newText: string) => void;
  onConfirmAction?: (confirmPrompt: string) => void;
  onPlayAudio?: () => void;
  disabled?: boolean;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  message,
  onSelectSlot,
  onEditMessage,
  onSaveEdit,
  onConfirmAction,
  onPlayAudio,
  disabled = false,
}) => {
  const { colors, isDark } = useTheme();
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

  return (
    <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowVito]}>
      {isUser ? (
        // BALÃO DO USUÁRIO: Pílula moderna discreta alinhada à direita
        <View
          style={[
            styles.bubbleUser,
            {
              backgroundColor: isDark ? colors.surfaceContainerHigh : '#F0F2F1',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            },
          ]}
        >
          {message.imageUri && (
            <Image source={{ uri: message.imageUri }} style={styles.imageAttachment} resizeMode="cover" />
          )}

          {isEditing ? (
            <View style={styles.inlineEditContainer}>
              <TextInput
                style={[
                  styles.inlineEditInput,
                  {
                    color: colors.onSurface,
                    borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
                  },
                ]}
                value={draftText}
                onChangeText={setDraftText}
                multiline
                autoFocus
                maxLength={1000}
                placeholderTextColor={colors.onSurfaceVariant}
              />
              <View style={styles.inlineEditActions}>
                <TouchableOpacity
                  style={[styles.inlineEditButton, styles.inlineEditCancelButton]}
                  onPress={handleCancelEdit}
                  activeOpacity={0.7}
                  accessibilityLabel="Cancelar edição"
                >
                  <MaterialIcons name="close" size={14} color={colors.onSurfaceVariant} />
                  <Text style={[styles.inlineEditButtonText, { color: colors.onSurfaceVariant }]}>
                    Cancelar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.inlineEditButton,
                    styles.inlineEditSaveButton,
                    { backgroundColor: isDark ? colors.primary : '#17191B' },
                  ]}
                  onPress={handleConfirmEdit}
                  activeOpacity={0.7}
                  accessibilityLabel="Salvar e reenviar mensagem"
                >
                  <MaterialIcons
                    name="send"
                    size={14}
                    color={isDark ? colors.onPrimary : '#FFFFFF'}
                  />
                  <Text
                    style={[
                      styles.inlineEditButtonText,
                      { color: isDark ? colors.onPrimary : '#FFFFFF', fontWeight: '700' },
                    ]}
                  >
                    Salvar
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
                  color={colors.onSurface}
                  style={{ marginRight: 6, marginTop: 2 }}
                />
              )}
              <FormattedChatMessageText
                text={message.text}
                isUser={isUser}
                textColor={colors.onSurface}
                isDark={isDark}
                style={[
                  styles.messageTextUser,
                  message.id.includes('audio') && { flexShrink: 1 },
                ]}
              />
            </View>
          )}

          {/* Metadados: Editar + Horário + Check */}
          <View style={styles.metaRow}>
            {(onSaveEdit || onEditMessage) && !isEditing && (
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
                  size={12}
                  color={colors.onSurfaceVariant}
                />
                <Text style={[styles.actionButtonText, { color: colors.onSurfaceVariant }]}>
                  Editar
                </Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.timestampUser, { color: colors.onSurfaceVariant }]}>
              {new Date(message.timestamp).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>

            <MaterialIcons
              name="done-all"
              size={13}
              color={colors.onSurfaceVariant}
            />
          </View>
        </View>
      ) : (
        // RESPOSTA DA IA (VITO): Borderless, largura 100%, texto corrido editorial estilo Claude / Gemini
        <View style={styles.vitoResponseContainer}>
          {message.imageUri && (
            <Image source={{ uri: message.imageUri }} style={styles.imageAttachment} resizeMode="cover" />
          )}

          <View style={message.id.includes('audio') ? styles.voiceTextRow : undefined}>
            {message.id.includes('audio') && (
              <MaterialIcons
                name="mic"
                size={16}
                color={colors.primary}
                style={{ marginRight: 6, marginTop: 2 }}
              />
            )}
            <FormattedChatMessageText
              text={message.text}
              isUser={isUser}
              textColor={colors.onSurface}
              isDark={isDark}
              style={[
                styles.messageTextVito,
                message.id.includes('audio') && { flexShrink: 1 },
              ]}
            />
          </View>

          {/* Cards Estruturados Modulares integrados na largura completa */}
          <ChatStructuredCards
            message={message}
            onSelectSlot={onSelectSlot}
            onConfirmAction={onConfirmAction}
            disabled={disabled}
          />

          {/* Barra de Ações Minimalista Estilo Claude / Gemini */}
          <ChatMessageActionBar
            messageText={message.text}
            timestamp={message.timestamp}
            onPlayAudio={onPlayAudio}
            disabled={disabled}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  messageRow: {
    width: '100%',
    marginBottom: 20,
  },
  messageRowUser: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  messageRowVito: {
    flexDirection: 'column',
    alignItems: 'stretch',
    alignSelf: 'stretch',
  },
  // Container de Vito: borderless, ocupa 100% da largura útil sem constrições laterais
  vitoResponseContainer: {
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: 0,
    paddingVertical: 2,
  },
  // Balão do usuário: pílula moderna e discreta
  bubbleUser: {
    maxWidth: '85%',
    alignSelf: 'flex-end',
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
  },
  messageTextUser: {
    fontSize: 15.5,
    lineHeight: 23,
    letterSpacing: -0.1,
  },
  messageTextVito: {
    fontSize: 16,
    lineHeight: 25,
    letterSpacing: -0.15,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 6,
    gap: 5,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 4,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timestampUser: {
    fontSize: 11,
    opacity: 0.7,
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
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
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
