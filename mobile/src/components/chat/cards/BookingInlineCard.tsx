import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { tokens, MD3Shapes } from '../../../theme/tokens';
import { useTheme } from '../../../context/ThemeContext';
import { ChatBooking } from '../../../types';
import { formatBookingWindow, bookingDisplayLink } from '../../../utils/chatCards';

interface BookingInlineCardProps {
  booking: ChatBooking;
}

export const BookingInlineCard: React.FC<BookingInlineCardProps> = ({ booking }) => {
  const { colors } = useTheme();
  const [copied, setCopied] = React.useState(false);
  const link = bookingDisplayLink(booking);

  const handleCopy = async () => {
    if (!link) return;
    try {
      await Clipboard.setStringAsync(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('[BookingInlineCard] Falha ao copiar link:', e);
    }
  };

  const handleOpen = () => {
    if (!link) return;
    Linking.openURL(link).catch((e) => {
      console.warn('[BookingInlineCard] Falha ao abrir link:', e);
    });
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}>
      <View style={[styles.accentBar, { backgroundColor: colors.primary }]} />

      <View style={styles.topRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceContainerHighest }]}>
            <MaterialIcons name="link" size={18} color={colors.primary} />
          </View>
          <View style={styles.titleCol}>
            <Text style={[styles.title, { color: colors.onSurface }]} numberOfLines={1}>
              {booking.title}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
              {formatBookingWindow(booking)}
            </Text>
          </View>
        </View>

        <View style={[styles.statusPill, { backgroundColor: colors.successLight }]}>
          <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.statusText, { color: colors.success }]}>Ativo</Text>
        </View>
      </View>

      {link ? (
        <View style={[styles.linkBox, { backgroundColor: colors.surfaceContainerLowest }]}>
          <MaterialIcons name="public" size={14} color={colors.onSurfaceVariant} />
          <Text style={[styles.linkText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
            {link}
          </Text>
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: copied ? colors.successLight : colors.surfaceContainerHighest },
          ]}
          onPress={handleCopy}
          disabled={!link}
          activeOpacity={0.8}
          accessibilityLabel="Copiar link de agendamento"
        >
          <MaterialIcons name={copied ? 'check' : 'content-copy'} size={14} color={copied ? colors.success : colors.onSurface} />
          <Text style={[styles.actionButtonText, { color: copied ? colors.success : colors.onSurface }]}>
            {copied ? 'Copiado' : 'Copiar link'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={handleOpen}
          disabled={!link}
          activeOpacity={0.8}
          accessibilityLabel="Abrir link de agendamento"
        >
          <MaterialIcons name="open-in-new" size={14} color={colors.onPrimary} />
          <Text style={[styles.actionButtonText, { color: colors.onPrimary }]}>Abrir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surfaceContainerHigh,
    borderRadius: MD3Shapes.large,
    padding: tokens.spacing.md,
    marginTop: tokens.spacing.xs,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
    gap: tokens.spacing.sm,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: tokens.colors.primary,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: MD3Shapes.small,
    backgroundColor: tokens.colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
  },
  title: {
    color: tokens.colors.onSurface,
    fontSize: tokens.typography.size.titleSmall,
    fontWeight: tokens.typography.weight.semibold,
  },
  subtitle: {
    color: tokens.colors.onSurfaceVariant,
    fontSize: tokens.typography.size.labelSmall,
    marginTop: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: MD3Shapes.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: MD3Shapes.full,
  },
  statusText: {
    fontSize: tokens.typography.size.labelSmall,
    fontWeight: tokens.typography.weight.semibold,
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: MD3Shapes.small,
  },
  linkText: {
    flex: 1,
    fontSize: tokens.typography.size.labelSmall,
    fontWeight: tokens.typography.weight.medium,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: MD3Shapes.full,
  },
  actionButtonText: {
    fontSize: tokens.typography.size.labelMedium,
    fontWeight: tokens.typography.weight.semibold,
  },
});
