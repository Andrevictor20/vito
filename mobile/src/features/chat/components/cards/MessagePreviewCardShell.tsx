import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ProtoUiIcon } from '../../../../icons/ProtoUiIcons';
import { useTheme } from '../../../../context/ThemeContext';

export interface MessagePreviewCardShellProps {
  leadingSlot: React.ReactNode;
  title: string;
  subtitle: string;
  tagLabel: string;
  tagBg: string;
  tagColor: string;
  extraHeaderSection?: React.ReactNode;
  messageLabel: string;
  messageBoxTightTop?: boolean;
  draftText: string;
  onChangeDraftText: (text: string) => void;
  inputPlaceholder: string;
  inputA11yLabel: string;
  autoFocusInput?: boolean;
  isEditing: boolean;
  isSent: boolean;
  isCancelled?: boolean;
  sending?: boolean;
  disabled?: boolean;
  sentBannerText: string;
  cancelledBannerText?: string;
  confirmButtonBg?: string;
  confirmButtonColor?: string;
  confirmA11yLabel: string;
  editA11yLabel: string;
  cancelA11yLabel: string;
  saveA11yLabel: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onConfirmSend: () => void;
  onRejectSend?: () => void;
}

/** Shell compartilhado pelos cards inline de confirmação de envio (Gmail e WhatsApp). */
export const MessagePreviewCardShell: React.FC<MessagePreviewCardShellProps> = ({
  leadingSlot,
  title,
  subtitle,
  tagLabel,
  tagBg,
  tagColor,
  extraHeaderSection,
  messageLabel,
  messageBoxTightTop = false,
  draftText,
  onChangeDraftText,
  inputPlaceholder,
  inputA11yLabel,
  autoFocusInput = false,
  isEditing,
  isSent,
  isCancelled = false,
  sending = false,
  disabled = false,
  sentBannerText,
  cancelledBannerText = 'Envio cancelado.',
  confirmButtonBg,
  confirmButtonColor,
  confirmA11yLabel,
  editA11yLabel,
  cancelA11yLabel,
  saveA11yLabel,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onConfirmSend,
  onRejectSend,
}) => {
  const { colors } = useTheme();
  const fillBg = confirmButtonBg ?? colors.ink;
  const fillInk = confirmButtonColor ?? colors.bg;
  const actionsDisabled = disabled || sending;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.card, { backgroundColor: colors.surf }]}>
        <View style={styles.headerRow}>
          {leadingSlot}
          <View style={styles.titleCol}>
            <View style={styles.nameRow}>
              <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
                {title}
              </Text>
              <View style={[styles.tag, { backgroundColor: tagBg }]}>
                <Text style={[styles.tagText, { color: tagColor }]}>{tagLabel}</Text>
              </View>
            </View>
            <Text style={[styles.subtitle, { color: colors.muted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </View>

        {extraHeaderSection}

        <View
          style={[
            styles.messageBox,
            { backgroundColor: colors.bg, marginTop: messageBoxTightTop ? 8 : 10 },
          ]}
        >
          <View style={styles.messageLabelRow}>
            <Text style={[styles.messageLabel, { color: colors.muted }]}>{messageLabel}</Text>
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
              onChangeText={onChangeDraftText}
              multiline
              autoFocus={autoFocusInput}
              placeholder={inputPlaceholder}
              placeholderTextColor={colors.muted}
              accessibilityLabel={inputA11yLabel}
            />
          ) : (
            <Text style={[styles.messageContent, { color: colors.ink }]} numberOfLines={isSent ? 3 : 6}>
              {draftText}
            </Text>
          )}
        </View>

        {isSent && (
          <View style={[styles.sentBanner, { backgroundColor: colors.greenBg }]}>
            <ProtoUiIcon name="check-circle" size={16} color={colors.acc} />
            <Text style={[styles.sentBannerText, { color: colors.acc }]}>{sentBannerText}</Text>
          </View>
        )}
        {isCancelled && (
          <View style={[styles.sentBanner, { backgroundColor: colors.surf }]}>
            <ProtoUiIcon name="close" size={16} color={colors.muted} />
            <Text style={[styles.sentBannerText, { color: colors.muted }]}>{cancelledBannerText}</Text>
          </View>
        )}
      </View>

      {!isSent && !isCancelled && (
        <View style={styles.actionsRow}>
          {isEditing ? (
            <>
              <TouchableOpacity
                style={[styles.btnOutline, { backgroundColor: colors.surf }]}
                onPress={onCancelEdit}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={cancelA11yLabel}
              >
                <Text style={[styles.btnOutlineText, { color: colors.muted }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnFill, { backgroundColor: colors.ink }]}
                onPress={onSaveEdit}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={saveA11yLabel}
              >
                <ProtoUiIcon name="done" size={16} color={colors.bg} />
                <Text style={[styles.btnFillText, { color: colors.bg }]}>Salvar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {onRejectSend && (
                <TouchableOpacity
                  style={[styles.btnOutline, { backgroundColor: colors.surf }]}
                  onPress={onRejectSend}
                  disabled={actionsDisabled}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Cancelar envio"
                >
                  <Text style={[styles.btnOutlineText, { color: colors.muted }]}>Cancelar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.btnOutline, { backgroundColor: colors.surf }]}
                onPress={onStartEdit}
                disabled={actionsDisabled}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={editA11yLabel}
              >
                <ProtoUiIcon name="edit" size={15} color={colors.ink} />
                <Text style={[styles.btnOutlineText, { color: colors.ink }]}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnFill, { backgroundColor: fillBg, opacity: actionsDisabled ? 0.6 : 1 }]}
                onPress={onConfirmSend}
                disabled={actionsDisabled}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={confirmA11yLabel}
              >
                <ProtoUiIcon name="send" size={15} color={fillInk} />
                <Text style={[styles.btnFillText, { color: fillInk }]}>
                  {sending ? 'Enviando...' : 'Confirmar envio'}
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
  wrapper: { marginTop: 8, width: '100%' },
  card: { borderRadius: 22, borderWidth: 0, paddingVertical: 14, paddingHorizontal: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleCol: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontFamily: 'Geist_600SemiBold', fontSize: 14.5, fontWeight: '600', flex: 1 },
  subtitle: { fontFamily: 'Geist_400Regular', fontSize: 12.5, marginTop: 2 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, flexShrink: 0 },
  tagText: { fontFamily: 'Geist_600SemiBold', fontSize: 11, fontWeight: '600' },
  messageBox: { padding: 12, borderRadius: 14, borderWidth: 0 },
  messageLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  messageLabel: { fontFamily: 'Geist_600SemiBold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  charCounter: { fontFamily: 'Geist_400Regular', fontSize: 11 },
  messageContent: { fontFamily: 'Geist_400Regular', fontSize: 13.5, lineHeight: 19 },
  input: {
    fontFamily: 'Geist_400Regular',
    fontSize: 13.5,
    lineHeight: 19,
    minHeight: 64,
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    textAlignVertical: 'top',
  },
  sentBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, marginTop: 10 },
  sentBannerText: { fontFamily: 'Geist_600SemiBold', fontSize: 12.5, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btnFill: { height: 36, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  btnFillText: { fontFamily: 'Geist_500Medium', fontSize: 13, fontWeight: '500' },
  btnOutline: { height: 36, paddingHorizontal: 16, borderRadius: 999, borderWidth: 0, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  btnOutlineText: { fontFamily: 'Geist_600SemiBold', fontSize: 13, fontWeight: '600' },
});
