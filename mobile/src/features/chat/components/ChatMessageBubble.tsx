import React from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity, TextInput } from 'react-native';
import { ProtoUiIcon } from '../../../icons/ProtoUiIcons';
import { tokens, MD3Shapes } from '../../../theme/tokens';
import { ChatMessage, TimeSlot } from '../../../types';
import { useTheme } from '../../../context/ThemeContext';
import { ChatStructuredCards } from './cards/ChatStructuredCards';
import { FormattedChatMessageText } from './FormattedChatMessageText';
import { ChatMessageActionBar } from './ChatMessageActionBar';
import { ThinkingProcessAccordion } from './ThinkingProcessAccordion';
import { navigateToAiProviders } from '../../../navigation/navigationRef';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  onSelectSlot?: (slot: TimeSlot, message: ChatMessage) => void;
  onEditMessage?: (text: string) => void;
  onSaveEdit?: (messageId: string, newText: string) => void;
  onConfirmAction?: (confirmPrompt: string) => void;
  onResolveConfirmation?: (messageId: string, pendingId: string, reject: boolean) => Promise<void> | void;
  onPlayAudio?: () => void;
  disabled?: boolean;
}

const ChatMessageBubbleComponent: React.FC<ChatMessageBubbleProps> = ({
  message,
  onSelectSlot,
  onEditMessage,
  onSaveEdit,
  onConfirmAction,
  onResolveConfirmation,
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

  const displayText = React.useMemo(() => {
    if (!message.whatsapp_message && !message.gmail_message) {
      return message.text;
    }
    const lines = message.text.split('\n').filter((l) => l.trim().length > 0);
    const firstLine = lines[0] || '';
    if (message.text.includes('Posso enviar?') && lines.length > 1) {
      return `${firstLine}\n\nPosso enviar?`;
    }
    return firstLine;
  }, [message.text, message.whatsapp_message, message.gmail_message]);

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
        // BALÃO DO USUÁRIO (.cu): pílula v5 ink/bg alinhada à direita
        <View
          style={[
            styles.bubbleUser,
            {
              backgroundColor: colors.ink,
              borderColor: colors.hairline,
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
                      color: colors.bg,
                      borderColor: colors.hairline,
                    },
                  ]}
                  value={draftText}
                  onChangeText={setDraftText}
                  multiline
                  autoFocus
                  maxLength={1000}
                  placeholderTextColor={colors.muted}
                />
                <View style={styles.inlineEditActions}>
                  <TouchableOpacity
                    style={[styles.inlineEditButton, styles.inlineEditCancelButton]}
                    onPress={handleCancelEdit}
                    hitSlop={tokens.hitSlop.sm}
                    activeOpacity={0.7}
                    accessibilityLabel="Cancelar edição"
                  >
                    <ProtoUiIcon name="close" size={14} color={colors.bg} />
                    <Text style={[styles.inlineEditButtonText, { color: colors.bg }]}>
                      Cancelar
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.inlineEditButton,
                      styles.inlineEditSaveButton,
                      { backgroundColor: colors.bg },
                    ]}
                    onPress={handleConfirmEdit}
                    hitSlop={tokens.hitSlop.sm}
                    activeOpacity={0.7}
                    accessibilityLabel="Salvar e reenviar mensagem"
                  >
                    <ProtoUiIcon name="send" size={14} color={colors.ink} />
                    <Text
                      style={[
                        styles.inlineEditButtonText,
                        { color: colors.ink, fontWeight: '600' },
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
                  <View style={{ marginRight: 6, marginTop: 2 }}>
                    <ProtoUiIcon name="mic" size={16} color={colors.bg} />
                  </View>
                )}
                <FormattedChatMessageText
                  text={message.text}
                  isUser={isUser}
                  textColor={colors.bg}
                  isDark={isDark}
                  style={[
                    styles.messageTextUser,
                    message.id.includes('audio') && { flexShrink: 1 },
                  ]}
                />
              </View>
            )}

            <View style={styles.metaRow}>
              {(onSaveEdit || onEditMessage) && !isEditing && (
                <TouchableOpacity
                  style={[styles.actionButton, disabled && { opacity: 0.5 }]}
                  onPress={handleStartEdit}
                  disabled={disabled}
                  hitSlop={tokens.hitSlop.md}
                  activeOpacity={0.7}
                  accessibilityLabel="Editar e reenviar mensagem"
                >
                  <View style={{ opacity: 0.75 }}>
                    <ProtoUiIcon name="edit" size={12} color={colors.bg} />
                  </View>
                  <Text style={[styles.actionButtonText, { color: colors.bg, opacity: 0.8 }]}>
                    Editar
                  </Text>
                </TouchableOpacity>
              )}

              <Text style={[styles.timestampUser, { color: colors.bg }]}>
                {new Date(message.timestamp).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>

              <View style={{ opacity: 0.75 }}>
                <ProtoUiIcon name="done-all" size={13} color={colors.bg} />
              </View>
            </View>
        </View>
      ) : (
        // RESPOSTA DA IA (VITO): Borderless, largura 100%, texto corrido editorial estilo Claude / Gemini
        <View style={styles.vitoResponseContainer}>
          {message.thinkingSteps && message.thinkingSteps.length > 0 && (
            <ThinkingProcessAccordion steps={message.thinkingSteps} isStreaming={false} />
          )}

          {message.imageUri && (
            <Image source={{ uri: message.imageUri }} style={styles.imageAttachment} resizeMode="cover" />
          )}

          <View style={message.id.includes('audio') ? styles.voiceTextRow : undefined}>
            {message.id.includes('audio') && (
              <View style={{ marginRight: 6, marginTop: 2 }}>
                <ProtoUiIcon name="mic" size={16} color={colors.primary} />
              </View>
            )}
            <FormattedChatMessageText
              text={displayText}
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
            onResolveConfirmation={onResolveConfirmation}
            disabled={disabled}
          />

          {!!message.byokWarning && (
            <View
              style={[
                styles.byokWarnBox,
                { backgroundColor: colors.redBg, borderColor: colors.red },
              ]}
            >
              <Text style={[styles.byokWarnText, { color: colors.ink }]}>
                {message.byokWarning}
              </Text>
              <TouchableOpacity
                style={styles.byokWarnBtn}
                onPress={navigateToAiProviders}
                hitSlop={tokens.hitSlop.sm}
              >
                <Text style={[styles.byokWarnLink, { color: colors.red }]}>
                  Gerenciar provedores
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Barra de Ações Minimalista Estilo Claude / Gemini */}
          <ChatMessageActionBar
            messageText={message.text}
            timestamp={message.timestamp}
            modelUsed={message.modelUsed}
            onPlayAudio={onPlayAudio}
            disabled={disabled}
          />
        </View>
      )}
    </View>
  );
};

export const ChatMessageBubble = React.memo(ChatMessageBubbleComponent);

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
    maxWidth: '84%',
    alignSelf: 'flex-end',
    borderRadius: 22,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  messageTextUser: {
    fontFamily: 'Geist',
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.08,
  },
  messageTextVito: {
    fontFamily: 'Geist',
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.08,
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
    justifyContent: 'center',
    minHeight: 32,
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 14,
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
  byokWarnBox: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  byokWarnText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  byokWarnBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  byokWarnLink: {
    fontSize: 12,
    fontWeight: '700',
  },
});
