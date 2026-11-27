import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../../context/ThemeContext';
import { ChatWhatsAppMessage } from '../../../../types';
import { WhatsAppGlyph } from '../../../../icons/AppGlyphs';
import { getContactInitials, formatRecipientPreview } from '../../utils/chatCards';
import { chatPromptBus } from '../../../../services/dataSync';
import { hapticFeedback } from '../../../../theme/motion';
import { MessagePreviewCardShell } from './MessagePreviewCardShell';

export interface WhatsAppMessageInlineCardProps {
  messageData: ChatWhatsAppMessage;
  pendingConfirmationId?: string;
  confirmationStatus?: 'pending' | 'confirmed' | 'cancelled';
  onResolveConfirmation?: (pendingId: string, reject: boolean) => Promise<void> | void;
  onConfirmSend?: (updatedMessage: ChatWhatsAppMessage) => void;
  onEdit?: (updatedMessage: ChatWhatsAppMessage) => void;
  disabled?: boolean;
}

export const WhatsAppMessageInlineCard: React.FC<WhatsAppMessageInlineCardProps> = ({
  messageData,
  pendingConfirmationId,
  confirmationStatus,
  onResolveConfirmation,
  onConfirmSend,
  onEdit,
  disabled = false,
}) => {
  const { colors } = useTheme();
  const [photoError, setPhotoError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasEditedDraft, setHasEditedDraft] = useState(false);
  const [draftText, setDraftText] = useState(messageData.message);
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
  const initials = getContactInitials(messageData.recipient_name);
  const recipientSubtitle = formatRecipientPreview(undefined, messageData.recipient_phone || 'WhatsApp');
  const hasPhoto = Boolean(messageData.recipient_photo && !photoError);

  const handleConfirmSend = async () => {
    if (disabled || sending || isSent || isCancelled) return;
    const updated: ChatWhatsAppMessage = {
      ...messageData,
      message: draftText,
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
        Alert.alert('Erro', 'Não foi possível confirmar o envio da mensagem.');
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
      chatPromptBus.notify(`Enviar mensagem WhatsApp para ${messageData.recipient_name}: "${draftText}"`);
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
        <View style={styles.avatarWrapper}>
          {hasPhoto ? (
            <Image
              source={{ uri: messageData.recipient_photo }}
              style={styles.avatarImage}
              onError={() => setPhotoError(true)}
              accessibilityRole="image"
              accessibilityLabel={`Foto de ${messageData.recipient_name}`}
            />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: colors.greenBg }]}>
              <Text style={[styles.avatarInitials, { color: colors.acc }]}>{initials}</Text>
            </View>
          )}
          <View style={[styles.appBadge, { backgroundColor: '#25D366', borderColor: colors.bg }]}>
            <WhatsAppGlyph color="#ffffff" size={11} />
          </View>
        </View>
      }
      title={messageData.recipient_name || 'Contato'}
      subtitle={recipientSubtitle}
      tagLabel={isSent ? 'Enviado' : 'WhatsApp'}
      tagBg={isSent ? colors.greenBg : colors.bg}
      tagColor={isSent ? colors.acc : colors.muted}
      messageLabel={isEditing ? 'Editar mensagem' : 'Prévia da mensagem'}
      draftText={draftText}
      onChangeDraftText={setDraftText}
      inputPlaceholder="Digite a mensagem..."
      inputA11yLabel="Campo de edição da mensagem do WhatsApp"
      autoFocusInput
      isEditing={isEditing}
      isSent={isSent}
      isCancelled={isCancelled}
      sending={sending}
      disabled={disabled}
      sentBannerText="Mensagem enviada com sucesso para o WhatsApp"
      cancelledBannerText="Envio de mensagem cancelado."
      confirmButtonBg={colors.acc}
      confirmButtonColor="#ffffff"
      confirmA11yLabel="Confirmar envio da mensagem via WhatsApp"
      editA11yLabel="Editar texto da mensagem"
      cancelA11yLabel="Cancelar edição da mensagem"
      saveA11yLabel="Salvar texto da mensagem"
      onStartEdit={() => {
        if (disabled || sending || isSent || isCancelled) return;
        hapticFeedback.selection();
        setIsEditing(true);
      }}
      onCancelEdit={() => {
        hapticFeedback.light();
        setDraftText(messageData.message);
        setIsEditing(false);
      }}
      onSaveEdit={() => {
        hapticFeedback.success();
        setIsEditing(false);
        setHasEditedDraft(draftText !== messageData.message);
        onEdit?.({ ...messageData, message: draftText });
      }}
      onConfirmSend={() => void handleConfirmSend()}
      onRejectSend={
        pendingConfirmationId && onResolveConfirmation ? () => void handleRejectSend() : undefined
      }
    />
  );
};

const styles = StyleSheet.create({
  avatarWrapper: { width: 44, height: 44, position: 'relative', flexShrink: 0 },
  avatarImage: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e2e8f0' },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontFamily: 'Geist_600SemiBold', fontSize: 16, fontWeight: '600' },
  appBadge: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
