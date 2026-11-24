import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { ProtoUiIcon } from '../../../../icons/ProtoUiIcons';
import { useTheme } from '../../../../context/ThemeContext';
import { hapticFeedback } from '../../../../theme/motion';
import type { FinanceAlert } from '../../types/finance';
import { getAlertMessage, getAlertPrompt } from '../shared/financeHelpers';

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

  const topAlert = alerts[0];
  const severity = (topAlert.severity || topAlert.urgency || '').toLowerCase();
  const chip =
    severity === 'critical' || severity === 'high' || topAlert.kind === 'DUPLICATE_CHARGE'
      ? { bg: colors.redBg, fg: colors.red, icon: 'repeat' as const }
      : severity === 'warning' || severity === 'medium' || topAlert.kind === 'BUDGET_CEILING'
        ? { bg: colors.orangeBg, fg: colors.orange, icon: 'local-offer' as const }
        : { bg: colors.finBg, fg: colors.fin, icon: 'credit-card' as const };

  const msg = getAlertMessage(topAlert);
  const actionLabel = topAlert.action_label || 'Perguntar ao Vito';

  return (
    <View style={[styles.alertCard, { backgroundColor: colors.bg, borderColor: colors.line }]}>
      <View style={styles.alertTop}>
        <View style={[styles.chip, { backgroundColor: chip.bg }]}>
          <ProtoUiIcon name={chip.icon} size={20} color={chip.fg} />
        </View>
        <View style={styles.alertBody}>
          <Text style={[styles.alertTitle, { color: colors.ink }]}>{topAlert.title}</Text>
          {msg ? (
            <Text style={[styles.alertDesc, { color: colors.muted }]}>{msg}</Text>
          ) : null}
        </View>
        {alerts.length > 1 && (
          <View style={[styles.countPill, { backgroundColor: colors.surf }]}>
            <Text style={[styles.countText, { color: colors.muted }]}>1 de {alerts.length}</Text>
          </View>
        )}
      </View>

      <View style={styles.optsRow}>
        <TouchableOpacity
          style={[styles.optBtn, { backgroundColor: colors.bg, borderColor: colors.line }]}
          onPress={() => {
            hapticFeedback.selection();
            onPressAlertAction(getAlertPrompt(topAlert));
          }}
          activeOpacity={0.75}
        >
          <Text style={[styles.optBtnText, { color: colors.ink }]}>{actionLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  alertCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginTop: 18,
  },
  alertTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  chip: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBody: {
    flex: 1,
    minWidth: 0,
  },
  alertTitle: {
    fontFamily: 'Geist_500Medium',
    fontSize: 15,
    lineHeight: 20,
  },
  alertDesc: {
    fontFamily: 'Geist',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  countPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 11.5,
  },
  optsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  optBtn: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optBtnText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
  },
});
