import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../../context/ThemeContext';
import { PressableScale } from '../../../../theme/vitoMotion';

export interface InlineCardAction {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}

export interface BaseInlineCardProps {
  icon: React.ReactNode;
  chipBg: string;
  title: string;
  titleLines?: number;
  subtitle: string;
  dimmed?: boolean;
  secondaryAction?: InlineCardAction;
  primaryAction?: InlineCardAction;
  hideActions?: boolean;
}

/** Shell compartilhado pelos cards inline de ação no chat (Booking, Evento, Reunião, Pendência, Tarefa, Bot). */
export const BaseInlineCard: React.FC<BaseInlineCardProps> = ({
  icon,
  chipBg,
  title,
  titleLines = 1,
  subtitle,
  dimmed = false,
  secondaryAction,
  primaryAction,
  hideActions = false,
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surf },
          dimmed && { opacity: 0.5 },
        ]}
      >
        <View style={[styles.chip, { backgroundColor: chipBg }]}>{icon}</View>
        <View style={styles.titleCol}>
          <Text style={[styles.title, { color: colors.ink }]} numberOfLines={titleLines}>
            {title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>

      {!hideActions && (secondaryAction || primaryAction) && (
        <View style={styles.actionsRow}>
          {secondaryAction && (
            <PressableScale
              style={[styles.btnOutline, { backgroundColor: colors.surf }]}
              onPress={secondaryAction.onPress}
              accessibilityRole="button"
              accessibilityLabel={secondaryAction.accessibilityLabel}
            >
              <Text style={[styles.btnOutlineText, { color: colors.ink }]}>
                {secondaryAction.label}
              </Text>
            </PressableScale>
          )}
          {primaryAction && (
            <PressableScale
              style={[styles.btnFill, { backgroundColor: colors.ink }]}
              onPress={primaryAction.onPress}
              accessibilityRole="button"
              accessibilityLabel={primaryAction.accessibilityLabel}
            >
              <Text style={[styles.btnFillText, { color: colors.bg }]}>
                {primaryAction.label}
              </Text>
            </PressableScale>
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
    borderRadius: 22,
    borderWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Geist_500Medium',
    fontSize: 14.5,
    fontWeight: '500',
    lineHeight: 19,
  },
  subtitle: {
    fontFamily: 'Geist',
    fontSize: 12.5,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  btnOutline: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    fontWeight: '500',
  },
  btnFill: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFillText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    fontWeight: '500',
  },
});
