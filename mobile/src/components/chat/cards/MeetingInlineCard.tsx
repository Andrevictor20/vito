import React, { useState } from 'react';
import { StyleSheet, View, Text, Share } from 'react-native';
import { ProtoUiIcon } from '../../../icons/ProtoUiIcons';
import { copyToClipboard } from '../../../utils/clipboard';
import { useTheme } from '../../../context/ThemeContext';
import { ChatMeeting } from '../../../types';
import { formatMeetingMode, meetingDisplayLink } from '../../../utils/chatCards';
import { tabNavigationBus } from '../../../services/dataSync';
import { hapticFeedback } from '../../../theme/motion';
import { PressableScale } from '../../../theme/vitoMotion';

interface MeetingInlineCardProps {
  meeting: ChatMeeting;
}

/**
 * Card in-chat de reunião P2P / consenso alinhado ao protótipo `vito-telas.html`:
 * - Card arredondado com chip verde 44x44px e ícone de reunião/consenso.
 * - Título em Inter 600 SemiBold e subtítulo com modo de agendamento.
 * - Botões de ação em pílula abaixo do card: "Copiar link" (outline) e "Ver reuniões" (solid ink).
 */
export const MeetingInlineCard: React.FC<MeetingInlineCardProps> = ({ meeting }) => {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const link = meetingDisplayLink(meeting);

  const handleCopy = async () => {
    if (!link) return;
    const ok = await copyToClipboard(link);
    if (ok) {
      hapticFeedback.success();
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleShare = async () => {
    if (!link) return;
    try {
      await Share.share({
        message: `Olá! Escolha ou vote no melhor horário para nossa reunião "${meeting.title}":\n${link}`,
        url: link,
        title: meeting.title,
      });
    } catch (e) {
      console.warn('[MeetingInlineCard] Falha ao compartilhar:', e);
    }
  };

  const handleViewMeetings = () => {
    hapticFeedback.selection();
    tabNavigationBus.notify('booking');
  };

  const subtitleText = `${formatMeetingMode(meeting.mode)} · Link ativo`;

  return (
    <View style={styles.wrapper}>
      {/* Card Principal */}
      <View style={[styles.card, { backgroundColor: colors.surf }]}>
        {/* Chip Verde 40x40 com Ícone de Grupos */}
        <View style={[styles.chip, { backgroundColor: colors.greenBg }]}>
          <ProtoUiIcon name="groups" size={20} color={colors.acc} />
        </View>

        {/* Informações da Reunião */}
        <View style={styles.titleCol}>
          <Text
            style={[styles.title, { color: colors.ink }]}
            numberOfLines={1}
          >
            {meeting.title}
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
          accessibilityLabel="Copiar link da reunião"
        >
          <Text style={[styles.btnOutlineText, { color: colors.ink }]}>
            {copied ? 'Copiado!' : 'Copiar link'}
          </Text>
        </PressableScale>

        <PressableScale
          style={[styles.btnFill, { backgroundColor: colors.ink }]}
          onPress={handleViewMeetings}
          accessibilityRole="button"
          accessibilityLabel="Ver reuniões"
        >
          <Text style={[styles.btnFillText, { color: colors.bg }]}>
            Ver reuniões
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
