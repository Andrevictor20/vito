import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import type { FinanceAlert } from '../../types/finance';
import { getAlertMessage, getAlertPrompt } from './financeHelpers';

interface FinanceAttentionSectionProps {
  alerts: FinanceAlert[];
  onPressAlertAction: (prompt: string) => void;
}

export const FinanceAttentionSection: React.FC<FinanceAttentionSectionProps> = ({
  alerts,
  onPressAlertAction,
}) => {
  const { colors } = useTheme();

  if (!alerts || alerts.length === 0) return null;

  const resolveChipTokens = (alert: FinanceAlert) => {
    const severity = (alert.severity || alert.urgency || '').toLowerCase();
    if (severity === 'critical' || severity === 'high' || alert.kind === 'DUPLICATE_CHARGE') {
      return { bg: colors.redBg, fg: colors.red, icon: 'repeat' as const };
    }
    if (severity === 'warning' || severity === 'medium' || alert.kind === 'BUDGET_CEILING') {
      return { bg: colors.orangeBg, fg: colors.orange, icon: 'local-offer' as const };
    }
    return { bg: colors.finBg, fg: colors.fin, icon: 'credit-card' as const };
  };

  return (
    <View style={styles.section}>
      <View style={styles.secHeader}>
        <Text style={[styles.secTitle, { color: colors.ink }]}>Atenção</Text>
        <View style={[styles.countPill, { backgroundColor: colors.surf }]}>
          <Text style={[styles.countText, { color: colors.muted }]}>{alerts.length}</Text>
        </View>
      </View>

      {alerts.map((alert, idx) => {
        const chip = resolveChipTokens(alert);
        const msg = getAlertMessage(alert);
        const actionLabel = alert.action_label || 'Perguntar ao Vito';

        return (
          <View
            key={alert.id || `alert_${idx}`}
            style={[styles.alertCard, { backgroundColor: colors.bg, borderColor: colors.line }]}
          >
            <View style={styles.alertTop}>
              <View style={[styles.chip, { backgroundColor: chip.bg }]}>
                <MaterialIcons name={chip.icon} size={20} color={chip.fg} />
              </View>
              <View style={styles.alertBody}>
                <Text style={[styles.alertTitle, { color: colors.ink }]}>{alert.title}</Text>
                {msg ? (
                  <Text style={[styles.alertDesc, { color: colors.muted }]}>{msg}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.optsRow}>
              <TouchableOpacity
                style={[styles.optBtn, { backgroundColor: colors.bg, borderColor: colors.line }]}
                onPress={() => {
                  hapticFeedback.selection();
                  onPressAlertAction(getAlertPrompt(alert));
                }}
                activeOpacity={0.75}
              >
                <Text style={[styles.optBtnText, { color: colors.ink }]}>{actionLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
    marginBottom: 8,
  },
  secHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  secTitle: {
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  countPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
  },
  alertCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  alertTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  chip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBody: {
    flex: 1,
    minWidth: 0,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  alertDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  optsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  optBtn: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optBtnText: {
    fontSize: 13.5,
    fontWeight: '500',
  },
});
