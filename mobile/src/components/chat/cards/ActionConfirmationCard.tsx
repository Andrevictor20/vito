import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { ProtoUiIcon } from '../../../icons/ProtoUiIcons';
import { PressableScale } from '../../../theme/vitoMotion';
import type { ChatCardPayload } from '../../../types';

export interface ActionConfirmationCardProps {
  pendingId: string;
  card?: ChatCardPayload;
  status?: 'pending' | 'confirmed' | 'cancelled';
  disabled?: boolean;
  onResolve?: (pendingId: string, reject: boolean) => Promise<void> | void;
}

export const ActionConfirmationCard: React.FC<ActionConfirmationCardProps> = ({
  pendingId,
  card,
  status = 'pending',
  disabled = false,
  onResolve,
}) => {
  const { colors } = useTheme();
  const [submitting, setSubmitting] = useState<'confirm' | 'cancel' | null>(null);
  const [localStatus, setLocalStatus] = useState<'pending' | 'confirmed' | 'cancelled'>(status);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const effectiveStatus = status !== 'pending' ? status : localStatus;

  const handlePress = async (reject: boolean) => {
    if (disabled || submitting || effectiveStatus !== 'pending' || !pendingId) return;
    setErrorMsg(null);
    setSubmitting(reject ? 'cancel' : 'confirm');
    try {
      await onResolve?.(pendingId, reject);
      setLocalStatus(reject ? 'cancelled' : 'confirmed');
    } catch {
      setErrorMsg('Não foi possível processar. Tente novamente.');
    } finally {
      setSubmitting(null);
    }
  };

  if (effectiveStatus === 'confirmed') {
    return (
      <View style={[styles.resolvedBox, { backgroundColor: colors.surf, borderColor: colors.hairline }]}>
        <ProtoUiIcon name="check-circle" size={16} color={colors.accents.emerald} />
        <Text style={[styles.resolvedText, { color: colors.ink }]}>Ação confirmada</Text>
      </View>
    );
  }

  if (effectiveStatus === 'cancelled') {
    return (
      <View style={[styles.resolvedBox, { backgroundColor: colors.surf, borderColor: colors.hairline }]}>
        <ProtoUiIcon name="close" size={16} color={colors.muted} />
        <Text style={[styles.resolvedText, { color: colors.muted }]}>Ação cancelada</Text>
      </View>
    );
  }

  const title = card?.title || 'Confirmar ação';
  const subtitle = card?.subtitle;
  const confirmLabel = card?.action_label || 'Confirmar';

  return (
    <View style={[styles.card, { backgroundColor: colors.surf, borderColor: colors.hairline }]}>
      <View style={styles.headerRow}>
        <View style={[styles.iconBadge, { backgroundColor: colors.bg, borderColor: colors.hairline }]}>
          <ProtoUiIcon name="verified-user" size={18} color={colors.ink} />
        </View>
        <View style={styles.headerTextCol}>
          <Text style={[styles.title, { color: colors.ink }]} numberOfLines={2}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={[styles.subtitle, { color: colors.muted }]} numberOfLines={3}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.actionsRow}>
        <PressableScale
          style={[styles.cancelBtn, { backgroundColor: colors.bg, borderColor: colors.hairline }]}
          onPress={() => void handlePress(true)}
          disabled={disabled || submitting !== null}
          accessibilityRole="button"
          accessibilityLabel="Cancelar ação"
        >
          {submitting === 'cancel' ? (
            <ActivityIndicator size="small" color={colors.ink} />
          ) : (
            <Text style={[styles.cancelBtnText, { color: colors.ink }]}>Cancelar</Text>
          )}
        </PressableScale>

        <PressableScale
          style={[styles.confirmBtn, { backgroundColor: colors.ink }]}
          onPress={() => void handlePress(false)}
          disabled={disabled || submitting !== null}
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
        >
          {submitting === 'confirm' ? (
            <ActivityIndicator size="small" color={colors.bg} />
          ) : (
            <>
              <ProtoUiIcon name="check" size={15} color={colors.bg} />
              <Text style={[styles.confirmBtnText, { color: colors.bg }]}>{confirmLabel}</Text>
            </>
          )}
        </PressableScale>
      </View>

      {!!errorMsg && (
        <Text style={[styles.subtitle, { color: colors.red }]}>{errorMsg}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { marginTop: 10, padding: 14, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBadge: { width: 38, height: 38, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  headerTextCol: { flex: 1, gap: 2 },
  title: { fontFamily: 'Geist_500Medium', fontSize: 14.5, fontWeight: '500' },
  subtitle: { fontFamily: 'Geist', fontSize: 13, lineHeight: 18 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  cancelBtn: { flex: 1, minHeight: 44, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  cancelBtnText: { fontFamily: 'Geist_500Medium', fontSize: 13.5, fontWeight: '500' },
  confirmBtn: { flex: 1.3, minHeight: 44, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14 },
  confirmBtnText: { fontFamily: 'Geist_500Medium', fontSize: 13.5, fontWeight: '500' },
  resolvedBox: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 8 },
  resolvedText: { fontFamily: 'Geist', fontSize: 13 },
});
