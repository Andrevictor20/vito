import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../../../context/ThemeContext';
import { ChatGmailMessage } from '../../../../types';
import { MailIcon } from '../../../../icons/AppGlyphs';
import { formatRecipientPreview } from '../../utils/chatCards';
import { chatPromptBus } from '../../../../services/dataSync';
import { hapticFeedback } from '../../../../theme/motion';
import { MessagePreviewCardShell } from './MessagePreviewCardShell';

export interface GmailMessageInlineCardProps {
  messageData: ChatGmailMessage;
  pendingConfirmationId?: string;
  confirmationStatus?: 'pending' | 'confirmed' | 'cancelled';
  onResolveConfirmation?: (pendingId: string, reject: boolean) => Promise<void> | void;
  onConfirmSend?: (updatedMessage: ChatGmailMessage) => void;
  onEdit?: (updatedMessage: ChatGmailMessage) => void;
  disabled?: boolean;
}

export const GmailMessageInlineCard: React.FC<GmailMessageInlineCardProps> = ({
  messageData,
  pendingConfirmationId,
  confirmationStatus,
  onResolveConfirmation,
  onConfirmSend,
  onEdit,
  disabled = false,
}) => {
  const { colors } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [hasEditedDraft, setHasEditedDraft] = useState(false);
  const [draftSubject, setDraftSubject] = useState(messageData.subject);
  const [draftBody, setDraftBody] = useState(messageData.body);
  const [sending, setSending] = useState(false);
  const [localStatus, setLocalStatus] = useState<'draft' | 'ready' | 'sent' | 'cancelled' | null>(null);

  const status =
    localStatus ??
    (confirmationStatus === 'confirmed'
      ? 'sent'
      : confirmationStatus === 'cancelled'
        ? 'cancelled'
        : messageData.status || 'ready');
  const isSent = status === 'sent';
  const isCancelled = status === 'cancelled';
  const recipientLabel = formatRecipientPreview(messageData.recipient_name, messageData.recipient_email);

  const handleConfirmSend = async () => {
    if (disabled || sending || isSent || isCancelled) return;
    const updated: ChatGmailMessage = {
      ...messageData,
      subject: draftSubject,
      body: draftBody,
      status: 'sent',
      sent_at: new Date().toISOString(),
    };
    if (pendingConfirmationId && onResolveConfirmation && !hasEditedDraft) {
      setSending(true);
      try {
        await onResolveConfirmation(pendingConfirmationId, false);
        hapticFeedback.success();
        setLocalStatus('sent');
        onConfirmSend?.(updated);
      } catch {
        Alert.alert('Erro', 'Não foi possível confirmar o envio do e-mail.');
      } finally {
        setSending(false);
      }
      return;
    }
    if (pendingConfirmationId && onResolveConfirmation && hasEditedDraft) {
      void Promise.resolve(onResolveConfirmation(pendingConfirmationId, true)).catch(() => {});
    }
    hapticFeedback.success();
    setLocalStatus('sent');
    if (onConfirmSend) {
      onConfirmSend(updated);
    } else {
      chatPromptBus.notify(
        `Enviar e-mail para ${messageData.recipient_email} com assunto "${draftSubject}" e corpo:\n${draftBody}`,
      );
    }
  };

  const handleRejectSend = async () => {
    if (disabled || sending || isSent || isCancelled || !pendingConfirmationId || !onResolveConfirmation) return;
    setSending(true);
    try {
      await onResolveConfirmation(pendingConfirmationId, true);
      setLocalStatus('cancelled');
    } catch {
      Alert.alert('Erro', 'Não foi possível cancelar o envio.');
    } finally {
      setSending(false);
    }
  };

  return (
    <MessagePreviewCardShell
      leadingSlot={
        <View style={[styles.chip, { backgroundColor: colors.redBg }]}>
          <MailIcon color={colors.red} size={22} />
        </View>
      }
      title={messageData.recipient_name || messageData.recipient_email}
      subtitle={recipientLabel}
      tagLabel={isSent ? 'Enviado' : 'Gmail'}
      tagBg={isSent ? colors.greenBg : colors.redBg}
      tagColor={isSent ? colors.acc : colors.red}
      extraHeaderSection={
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
            <Text style={[styles.subjectText, { color: colors.ink }]} numberOfLines={1}>
              {draftSubject}
            </Text>
          )}
        </View>
      }
      messageLabel={isEditing ? 'Editar mensagem do e-mail' : 'Mensagem'}
      messageBoxTightTop
      draftText={draftBody}
      onChangeDraftText={setDraftBody}
      inputPlaceholder="Digite o conteúdo do e-mail..."
      inputA11yLabel="Campo de conteúdo do e-mail"
      isEditing={isEditing}
      isSent={isSent}
      isCancelled={isCancelled}
      sending={sending}
      disabled={disabled}
      sentBannerText="E-mail enviado com sucesso via Gmail"
      cancelledBannerText="Envio de e-mail cancelado."
      confirmA11yLabel="Confirmar envio do e-mail via Gmail"
      editA11yLabel="Editar e-mail"
      cancelA11yLabel="Cancelar edição do e-mail"
      saveA11yLabel="Salvar alterações do e-mail"
      onStartEdit={() => {
        if (disabled || sending || isSent || isCancelled) return;
        hapticFeedback.selection();
        setIsEditing(true);
      }}
      onCancelEdit={() => {
        hapticFeedback.light();
        setDraftSubject(messageData.subject);
        setDraftBody(messageData.body);
        setIsEditing(false);
      }}
      onSaveEdit={() => {
        hapticFeedback.success();
        setIsEditing(false);
        setHasEditedDraft(
          draftSubject !== messageData.subject || draftBody !== messageData.body,
        );
        onEdit?.({ ...messageData, subject: draftSubject, body: draftBody });
      }}
      onConfirmSend={() => void handleConfirmSend()}
      onRejectSend={
        pendingConfirmationId && onResolveConfirmation ? () => void handleRejectSend() : undefined
      }
    />
  );
};

const styles = StyleSheet.create({
  chip: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  subjectLabel: { fontFamily: 'Geist_600SemiBold', fontSize: 12 },
  subjectText: { fontFamily: 'Geist_600SemiBold', fontSize: 13, flex: 1 },
  subjectInput: { fontFamily: 'Geist_600SemiBold', fontSize: 13, flex: 1, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1 },
});
