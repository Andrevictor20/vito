import React, { useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { ProtoUiIcon } from '../../../icons/ProtoUiIcons';
import { copyToClipboard } from '../../../utils/clipboard';
import { useTheme } from '../../../context/ThemeContext';
import { ChatBooking } from '../../../types';
import { bookingDisplayLink } from '../../../utils/chatCards';
import { tabNavigationBus } from '../../../services/dataSync';
import { hapticFeedback } from '../../../theme/motion';
import { PressableScale } from '../../../theme/vitoMotion';

interface BookingInlineCardProps {
  booking: ChatBooking;
}

/**
 * Card in-chat de link de agendamento alinhado ao protótipo `vito-telas.html`:
 * - Card arredondado com chip azul 44x44px e ícone de link.
 * - Título em Inter 600 SemiBold e subtítulo com URL curta / status.
 * - Botões de ação em pílula abaixo do card: "Copiar link" (outline) e "Ver booking" (solid ink).
 */
export const BookingInlineCard: React.FC<BookingInlineCardProps> = ({ booking }) => {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const link = bookingDisplayLink(booking);

  const handleCopy = async () => {
    if (!link) return;
    const ok = await copyToClipboard(link);
    if (ok) {
      hapticFeedback.success();
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleViewBooking = () => {
    hapticFeedback.selection();
    tabNavigationBus.notify('booking');
  };

  const displayUrl = link ? link.replace(/^https?:\/\//, '') : 'Link de agendamento';
  const subtitleText = `${displayUrl} · Ativo`;

  return (
    <View style={styles.wrapper}>
      {/* Card Principal */}
      <View style={[styles.card, { backgroundColor: colors.surf }]}>
        {/* Chip Azul 40x40 com Ícone de Link */}
        <View style={[styles.chip, { backgroundColor: colors.blueBg }]}>
          <ProtoUiIcon name="link" size={20} color={colors.blue} />
        </View>

        {/* Informações do Booking */}
        <View style={styles.titleCol}>
          <Text
            style={[styles.title, { color: colors.ink }]}
            numberOfLines={1}
          >
            {booking.title}
          </Text>
          <Text
            style={[styles.subtitle, { color: colors.muted }]}
            numberOfLines={1}
          >
            {subtitleText}
          </Text>
        </View>
      </View>

      {/* Botões de Ação Abaixo do Card */}
      <View style={styles.actionsRow}>
        <PressableScale
          style={[styles.btnOutline, { backgroundColor: colors.surf }]}
          onPress={handleCopy}
          accessibilityRole="button"
          accessibilityLabel="Copiar link"
        >
          <Text style={[styles.btnOutlineText, { color: colors.ink }]}>
            {copied ? 'Copiado!' : 'Copiar link'}
          </Text>
        </PressableScale>

        <PressableScale
          style={[styles.btnFill, { backgroundColor: colors.ink }]}
          onPress={handleViewBooking}
          accessibilityRole="button"
          accessibilityLabel="Ver booking"
        >
          <Text style={[styles.btnFillText, { color: colors.bg }]}>
            Ver booking
          </Text>
        </PressableScale>
      </View>
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
