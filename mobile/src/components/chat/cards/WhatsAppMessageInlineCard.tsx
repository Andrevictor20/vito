import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { ChatWhatsAppMessage } from '../../../types';
import { WhatsAppGlyph } from '../../login/DemoIcons';
import { getContactInitials, formatRecipientPreview } from '../../../utils/chatCards';
import { chatPromptBus } from '../../../services/dataSync';
import { hapticFeedback } from '../../../theme/motion';

export interface WhatsAppMessageInlineCardProps {
  messageData: ChatWhatsAppMessage;
  onConfirmSend?: (updatedMessage: ChatWhatsAppMessage) => void;
  onEdit?: (updatedMessage: ChatWhatsAppMessage) => void;
  disabled?: boolean;
}

/**
 * Card in-chat para confirmação e envio de mensagem WhatsApp.
 * Alinhado ao padrão de design do Vito (vito-telas.html):
 * - Exibe foto do contato com fallback para iniciais e badge do WhatsApp.
 * - Caixa de preview da mensagem com suporte a edição inline.
 * - Botão de confirmação de envio (solid ink / acc) e botão de edição (outline).
 * - Feedback tátil (haptics) e estado de envio concluído com acessibilidade WCAG.
 */
export const WhatsAppMessageInlineCard: React.FC<WhatsAppMessageInlineCardProps> = ({
  messageData,
  onConfirmSend,
  onEdit,
  disabled = false,
}) => {
  const { colors } = useTheme();
  const [photoError, setPhotoError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(messageData.message);
  const [status, setStatus] = useState<'draft' | 'ready' | 'sent' | 'cancelled'>(messageData.status || 'ready');

  const initials = getContactInitials(messageData.recipient_name);
  const recipientSubtitle = formatRecipientPreview(undefined, messageData.recipient_phone || 'WhatsApp');
  const hasPhoto = Boolean(messageData.recipient_photo && !photoError);

  const handleStartEdit = () => {
    if (disabled || status === 'sent') return;
    hapticFeedback.selection();
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    hapticFeedback.light();
    setDraftText(messageData.message);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    hapticFeedback.success();
    setIsEditing(false);
    const updated = { ...messageData, message: draftText };
    onEdit?.(updated);
  };

  const handleConfirmSend = () => {
    if (disabled || status === 'sent') return;
    hapticFeedback.success();
    setStatus('sent');
    const updated = {
      ...messageData,
      message: draftText,
      status: 'sent' as const,
      sent_at: new Date().toISOString(),
    };
    if (onConfirmSend) {
      onConfirmSend(updated);
    } else {
      chatPromptBus.notify(`Enviar mensagem WhatsApp para ${messageData.recipient_name}: "${draftText}"`);
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
        {/* Cabeçalho: Foto / Avatar do Contato + Destinatário + Badge WhatsApp */}
        <View style={styles.headerRow}>
          {/* Avatar com foto da pessoa ou fallback de iniciais */}
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
                <Text style={[styles.avatarInitials, { color: colors.acc }]}>
                  {initials}
                </Text>
              </View>
            )}

            {/* Micro Badge do WhatsApp no canto do Avatar */}
            <View style={[styles.appBadge, { backgroundColor: '#25D366', borderColor: colors.bg }]}>
              <WhatsAppGlyph color="#ffffff" size={11} />
            </View>
          </View>

          {/* Coluna com Nome do Contato e Telefone */}
          <View style={styles.titleCol}>
            <View style={styles.nameRow}>
              <Text
                style={[styles.title, { color: colors.ink }]}
                numberOfLines={1}
              >
                {messageData.recipient_name || 'Contato'}
              </Text>
              <View style={[styles.tag, { backgroundColor: isSent ? colors.greenBg : colors.surf }]}>
                <Text style={[styles.tagText, { color: isSent ? colors.acc : colors.muted }]}>
                  {isSent ? 'Enviado' : 'WhatsApp'}
                </Text>
              </View>
            </View>
            <Text
              style={[styles.subtitle, { color: colors.muted }]}
              numberOfLines={1}
            >
              {recipientSubtitle}
            </Text>
          </View>
        </View>

        {/* Caixa de Mensagem / Edição */}
        <View style={[styles.messageBox, { backgroundColor: colors.surf, borderColor: colors.line }]}>
          <View style={styles.messageLabelRow}>
            <Text style={[styles.messageLabel, { color: colors.muted }]}>
              {isEditing ? 'Editar mensagem' : 'Prévia da mensagem'}
            </Text>
            {isEditing && (
              <Text style={[styles.charCounter, { color: colors.muted }]}>
                {draftText.length} carac.
              </Text>
            )}
          </View>

          {isEditing ? (
            <TextInput
              style={[styles.input, { color: colors.ink, borderColor: colors.line }]}
              value={draftText}
              onChangeText={setDraftText}
              multiline
              autoFocus
              placeholder="Digite a mensagem..."
              placeholderTextColor={colors.muted}
              accessibilityLabel="Campo de edição da mensagem do WhatsApp"
            />
          ) : (
            <Text style={[styles.messageContent, { color: colors.ink }]} numberOfLines={isSent ? 3 : 6}>
              {draftText}
            </Text>
          )}
        </View>

        {/* Feedback visual de Mensagem Enviada */}
        {isSent && (
          <View style={[styles.sentBanner, { backgroundColor: colors.greenBg }]}>
            <MaterialIcons name="check-circle" size={16} color={colors.acc} />
            <Text style={[styles.sentBannerText, { color: colors.acc }]}>
              Mensagem enviada com sucesso para o WhatsApp
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
                accessibilityLabel="Cancelar edição da mensagem"
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
                accessibilityLabel="Salvar texto da mensagem"
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
                accessibilityLabel="Editar texto da mensagem"
              >
                <MaterialIcons name="edit" size={15} color={colors.ink} />
                <Text style={[styles.btnOutlineText, { color: colors.ink }]}>
                  Editar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnFill, { backgroundColor: colors.acc }]}
                onPress={handleConfirmSend}
                disabled={disabled}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Confirmar envio da mensagem via WhatsApp"
              >
                <MaterialIcons name="send" size={15} color="#ffffff" />
                <Text style={[styles.btnFillText, { color: '#ffffff' }]}>
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
  avatarWrapper: {
    width: 44,
    height: 44,
    position: 'relative',
    flexShrink: 0,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e2e8f0',
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
  },
  appBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
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
  messageBox: {
    marginTop: 10,
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
