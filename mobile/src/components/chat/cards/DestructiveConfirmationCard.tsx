import React, { useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { ProtoUiIcon } from '../../../icons/ProtoUiIcons';
import { useTheme } from '../../../context/ThemeContext';
import { DestructiveConfirmation } from '../../../types';
import { PressableScale } from '../../../theme/vitoMotion';

interface DestructiveConfirmationCardProps {
  confirmation: DestructiveConfirmation;
  onConfirm?: (confirmPrompt: string) => void;
  disabled?: boolean;
}

export const DestructiveConfirmationCard: React.FC<DestructiveConfirmationCardProps> = ({
  confirmation,
  onConfirm,
  disabled = false,
}) => {
  const { colors } = useTheme();
  const [resolved, setResolved] = useState<'confirmed' | 'cancelled' | null>(null);

  if (resolved === 'cancelled') {
    return (
      <View style={[styles.resolvedBox, { backgroundColor: colors.surf }]}>
        <ProtoUiIcon name="shield" size={16} color={colors.blue} />
        <Text style={[styles.resolvedText, { color: colors.muted }]}>
          Exclusão cancelada — compromissos mantidos na agenda.
        </Text>
      </View>
    );
  }

  if (resolved === 'confirmed') {
    return (
      <View style={[styles.resolvedBox, { backgroundColor: colors.redBg }]}>
        <ProtoUiIcon name="check-circle" size={16} color={colors.red} />
        <Text style={[styles.resolvedText, { color: colors.red }]}>
          Confirmação enviada para exclusão de &ldquo;{confirmation.target_title}&rdquo;.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.redBg }]}>
      <View style={styles.headerRow}>
        <View style={[styles.iconBadge, { backgroundColor: colors.bg }]}>
          <ProtoUiIcon name="warning-amber" size={20} color={colors.red} />
        </View>
        <View style={styles.headerTextCol}>
          <Text style={[styles.title, { color: colors.ink }]}>
            Confirmação Humana Obrigatória
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            {confirmation.impact_count} compromissos correspondem a &ldquo;
            {confirmation.target_title}&rdquo;
          </Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <PressableScale
          style={[styles.keepBtn, { backgroundColor: colors.bg }]}
          onPress={() => setResolved('cancelled')}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Manter compromissos na agenda"
        >
          <Text style={[styles.keepBtnText, { color: colors.ink }]}>Manter na Agenda</Text>
        </PressableScale>

        <PressableScale
          style={[styles.confirmBtn, { backgroundColor: colors.red }]}
          onPress={() => {
            setResolved('confirmed');
            onConfirm?.(confirmation.confirm_prompt);
          }}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Confirmar exclusão em lote"
        >
          <ProtoUiIcon name="delete-forever" size={16} color="#FFFFFF" />
          <Text style={styles.confirmBtnText}>Confirmar Exclusão</Text>
        </PressableScale>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    padding: 14,
    borderRadius: 22,
    borderWidth: 0,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: 'Geist_500Medium',
    fontSize: 14.5,
    fontWeight: '500',
  },
  subtitle: {
    fontFamily: 'Geist',
    fontSize: 12.5,
    lineHeight: 17,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  keepBtn: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepBtnText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    fontWeight: '500',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
  },
  confirmBtnText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  resolvedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 0,
  },
  resolvedText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 12.5,
    fontWeight: '500',
    flex: 1,
  },
});
