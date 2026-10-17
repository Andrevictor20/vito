import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { DestructiveConfirmation } from '../../../types';

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
      <View
        style={[
          styles.resolvedBox,
          { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant },
        ]}
      >
        <MaterialIcons name="shield" size={16} color={colors.primary} />
        <Text style={[styles.resolvedText, { color: colors.onSurfaceVariant }]}>
          Exclusão cancelada — compromissos mantidos na agenda.
        </Text>
      </View>
    );
  }

  if (resolved === 'confirmed') {
    return (
      <View
        style={[
          styles.resolvedBox,
          { backgroundColor: colors.danger + '14', borderColor: colors.danger + '40' },
        ]}
      >
        <MaterialIcons name="check-circle" size={16} color={colors.danger} />
        <Text style={[styles.resolvedText, { color: colors.danger }]}>
          Confirmação enviada para exclusão de &ldquo;{confirmation.target_title}&rdquo;.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.danger + '10',
          borderColor: colors.danger + '45',
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconBadge, { backgroundColor: colors.danger + '20' }]}>
          <MaterialIcons name="warning-amber" size={18} color={colors.danger} />
        </View>
        <View style={styles.headerTextCol}>
          <Text style={[styles.title, { color: colors.onSurface }]}>
            Confirmação Humana Obrigatória
          </Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
            {confirmation.impact_count} compromissos correspondem a &ldquo;
            {confirmation.target_title}&rdquo;
          </Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[
            styles.keepBtn,
            { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant },
          ]}
          onPress={() => setResolved('cancelled')}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Manter compromissos na agenda"
        >
          <Text style={[styles.keepBtnText, { color: colors.onSurface }]}>Manter na Agenda</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.confirmBtn, { backgroundColor: colors.danger }]}
          onPress={() => {
            setResolved('confirmed');
            onConfirm?.(confirmation.confirm_prompt);
          }}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Confirmar exclusão em lote"
        >
          <MaterialIcons name="delete-forever" size={16} color="#FFFFFF" />
          <Text style={styles.confirmBtnText}>Confirmar Exclusão</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  keepBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  keepBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resolvedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  resolvedText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});
