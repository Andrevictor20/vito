import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { copyToClipboard } from '../../../utils/clipboard';
import { useTheme } from '../../../context/ThemeContext';
import { ChatBooking } from '../../../types';
import { bookingDisplayLink } from '../../../utils/chatCards';
import { tabNavigationBus } from '../../../services/dataSync';
import { hapticFeedback } from '../../../theme/motion';

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
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.bg,
            borderColor: colors.line,
          },
        ]}
      >
        {/* Chip Azul 44x44 com Ícone de Link */}
        <View style={[styles.chip, { backgroundColor: colors.blueBg }]}>
          <MaterialIcons name="link" size={24} color={colors.blue} />
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
        <TouchableOpacity
          style={[styles.btnOutline, { borderColor: colors.ink }]}
          onPress={handleCopy}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Copiar link"
        >
          <Text style={[styles.btnOutlineText, { color: colors.ink }]}>
            {copied ? 'Copiado!' : 'Copiar link'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnFill, { backgroundColor: colors.ink }]}
          onPress={handleViewBooking}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Ver booking"
        >
          <Text style={[styles.btnFillText, { color: colors.bg }]}>
            Ver booking
          </Text>
        </TouchableOpacity>
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
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#141916',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  chip: {
    width: 44,
    height: 44,
    borderRadius: 14,
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
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15.5,
    fontWeight: '600',
    lineHeight: 20,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 3,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  btnOutline: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  btnOutlineText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13.5,
    fontWeight: '600',
  },
  btnFill: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13.5,
    fontWeight: '600',
  },
});
