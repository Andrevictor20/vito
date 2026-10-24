import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { ChatGmailMessage } from '../../../types';
import { MailIcon } from '../../login/DemoIcons';
import { formatRecipientPreview } from '../../../utils/chatCards';
import { chatPromptBus } from '../../../services/dataSync';
import { hapticFeedback } from '../../../theme/motion';

export interface GmailMessageInlineCardProps {
  messageData: ChatGmailMessage;
  onConfirmSend?: (updatedMessage: ChatGmailMessage) => void;
  onEdit?: (updatedMessage: ChatGmailMessage) => void;
  disabled?: boolean;
}

/**
 * Card in-chat para confirmação e envio de e-mail via Gmail.
 * Alinhado ao padrão de design do Vito (vito-telas.html):
 * - Chip vermelho característico do Gmail com ícone de e-mail.
 * - Destinatário, assunto em destaque e corpo do e-mail.
 * - Modo de edição inline para ajuste rápido de assunto e corpo.
 * - Botão de confirmação de envio (solid ink / red) e botão de edição (outline).
 */
export const GmailMessageInlineCard: React.FC<GmailMessageInlineCardProps> = ({
  messageData,
  onConfirmSend,
  onEdit,
  disabled = false,
}) => {
  const { colors } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftSubject, setDraftSubject] = useState(messageData.subject);
  const [draftBody, setDraftBody] = useState(messageData.body);
  const [status, setStatus] = useState<'draft' | 'ready' | 'sent' | 'cancelled'>(messageData.status || 'ready');

  const recipientLabel = formatRecipientPreview(messageData.recipient_name, messageData.recipient_email);

  const handleStartEdit = () => {
    if (disabled || status === 'sent') return;
    hapticFeedback.selection();
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    hapticFeedback.light();
    setDraftSubject(messageData.subject);
    setDraftBody(messageData.body);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    hapticFeedback.success();
    setIsEditing(false);
    const updated = {
      ...messageData,
      subject: draftSubject,
      body: draftBody,
    };
    onEdit?.(updated);
  };

  const handleConfirmSend = () => {
    if (disabled || status === 'sent') return;
    hapticFeedback.success();
    setStatus('sent');
    const updated = {
      ...messageData,
      subject: draftSubject,
      body: draftBody,
      status: 'sent' as const,
      sent_at: new Date().toISOString(),
    };
    if (onConfirmSend) {
      onConfirmSend(updated);
    } else {
      chatPromptBus.notify(`Enviar e-mail para ${messageData.recipient_email} com assunto "${draftSubject}"`);
    }
  };

  const isSent = status === 'sent';

  return (
    <View style={styles.wrapper}>
      {/* Card Principal */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.bg,
            borderColor: isSent ? colors.acc + '40' : colors.line,
          },
        ]}
      >
        {/* Cabeçalho: Chip Vermelho Gmail + Destinatário + Badge */}
        <View style={styles.headerRow}>
          <View style={[styles.chip, { backgroundColor: colors.redBg }]}>
            <MailIcon color={colors.red} size={22} />
          </View>

          <View style={styles.titleCol}>
            <View style={styles.nameRow}>
              <Text
                style={[styles.title, { color: colors.ink }]}
                numberOfLines={1}
              >
                {messageData.recipient_name || messageData.recipient_email}
              </Text>
              <View style={[styles.tag, { backgroundColor: isSent ? colors.greenBg : colors.redBg }]}>
                <Text style={[styles.tagText, { color: isSent ? colors.acc : colors.red }]}>
                  {isSent ? 'Enviado' : 'Gmail'}
                </Text>
              </View>
            </View>
            <Text
              style={[styles.subtitle, { color: colors.muted }]}
              numberOfLines={1}
            >
              {recipientLabel}
            </Text>
          </View>
        </View>

        {/* Linha de Assunto */}
        <View style={styles.subjectRow}>
          <Text style={[styles.subjectLabel, { color: colors.muted }]}>Assunto:</Text>
          {isEditing ? (
            <TextInput
              style={[styles.subjectInput, { color: colors.ink, borderColor: colors.line }]}
              value={draftSubject}
              onChangeText={setDraftSubject}
              placeholder="Assunto do e-mail"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Campo de assunto do e-mail"
            />
          ) : (
            <Text
              style={[styles.subjectText, { color: colors.ink }]}
              numberOfLines={1}
            >
              {draftSubject}
            </Text>
          )}
        </View>

        {/* Caixa de Conteúdo do E-mail */}
        <View style={[styles.messageBox, { backgroundColor: colors.surf, borderColor: colors.line }]}>
          <View style={styles.messageLabelRow}>
            <Text style={[styles.messageLabel, { color: colors.muted }]}>
              {isEditing ? 'Editar mensagem do e-mail' : 'Mensagem'}
            </Text>
            {isEditing && (
              <Text style={[styles.charCounter, { color: colors.muted }]}>
                {draftBody.length} carac.
              </Text>
            )}
          </View>

          {isEditing ? (
            <TextInput
              style={[styles.input, { color: colors.ink, borderColor: colors.line }]}
              value={draftBody}
              onChangeText={setDraftBody}
              multiline
              placeholder="Digite o conteúdo do e-mail..."
              placeholderTextColor={colors.muted}
              accessibilityLabel="Campo de conteúdo do e-mail"
            />
          ) : (
            <Text style={[styles.messageContent, { color: colors.ink }]} numberOfLines={isSent ? 3 : 6}>
              {draftBody}
            </Text>
          )}
        </View>

        {/* Feedback visual de E-mail Enviado */}
        {isSent && (
          <View style={[styles.sentBanner, { backgroundColor: colors.greenBg }]}>
            <MaterialIcons name="check-circle" size={16} color={colors.acc} />
            <Text style={[styles.sentBannerText, { color: colors.acc }]}>
              E-mail enviado com sucesso via Gmail
            </Text>
          </View>
        )}
      </View>

      {/* Botões de Ação Abaixo do Card */}
      {!isSent && (
        <View style={styles.actionsRow}>
          {isEditing ? (
            <>
              <TouchableOpacity
                style={[styles.btnOutline, { borderColor: colors.line }]}
                onPress={handleCancelEdit}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Cancelar edição do e-mail"
              >
                <Text style={[styles.btnOutlineText, { color: colors.muted }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnFill, { backgroundColor: colors.ink }]}
                onPress={handleSaveEdit}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Salvar alterações do e-mail"
              >
                <MaterialIcons name="done" size={16} color={colors.bg} />
                <Text style={[styles.btnFillText, { color: colors.bg }]}>
                  Salvar
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.btnOutline, { borderColor: colors.ink }]}
                onPress={handleStartEdit}
                disabled={disabled}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Editar e-mail"
              >
                <MaterialIcons name="edit" size={15} color={colors.ink} />
                <Text style={[styles.btnOutlineText, { color: colors.ink }]}>
                  Editar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnFill, { backgroundColor: colors.ink }]}
                onPress={handleConfirmSend}
                disabled={disabled}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Confirmar envio do e-mail via Gmail"
              >
                <MaterialIcons name="send" size={15} color={colors.bg} />
                <Text style={[styles.btnFillText, { color: colors.bg }]}>
                  Confirmar envio
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 8,
    width: '100%',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#141916',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14.5,
    fontWeight: '600',
    flex: 1,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    marginTop: 2,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    flexShrink: 0,
  },
  tagText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    fontWeight: '600',
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  subjectLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  subjectText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    flex: 1,
  },
  subjectInput: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  messageBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  messageLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  charCounter: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  messageContent: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13.5,
    lineHeight: 19,
  },
  input: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13.5,
    lineHeight: 19,
    minHeight: 64,
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    textAlignVertical: 'top',
  },
  sentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  sentBannerText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  btnFill: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  btnFillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    fontWeight: '600',
  },
  btnOutline: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  btnOutlineText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    fontWeight: '600',
  },
});
