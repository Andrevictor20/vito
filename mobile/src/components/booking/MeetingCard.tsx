import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Share,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { MD3Shapes, tabularNumbers } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { Meeting, MeetingSlot } from '../../types';
import { meetingDisplayLink } from '../../utils/chatCards';
import { formatSlotBRTDisplay, getLeadingSlot, buildMeetingShareMessage } from '../../utils/meetingPollUtils';
import { hapticFeedback } from '../../theme/motion';

interface MeetingCardProps {
  meeting: Meeting;
  isCopied: boolean;
  onCopyLink: (m: Meeting) => void;
  onEdit?: (m: Meeting) => void;
  onOpenDetail?: (m: Meeting) => void;
  onConfirmSlot?: (meetingId: string, slotId: string) => void;
  onDelete: (id: string) => void;
  confirmingSlotId?: string | null;
}

export const MeetingCard: React.FC<MeetingCardProps> = ({
  meeting,
  isCopied,
  onCopyLink,
  onEdit,
  onOpenDetail,
  onDelete,
}) => {
  const { colors } = useTheme();
  const link = meetingDisplayLink(meeting as any);
  const isConfirmed = meeting.status === 'confirmed';
  const slots: MeetingSlot[] = Array.isArray(meeting.slots) ? meeting.slots : [];
  const participants = Array.isArray(meeting.participants) ? meeting.participants : [];
  const totalParticipants = participants.length;
  const leading = getLeadingSlot(slots, totalParticipants);

  // Slot confirmado (se houver)
  const confirmedSlot = isConfirmed
    ? slots.find((s) => s.id === meeting.confirmed_slot_id)
    : undefined;
  const confirmedFormatted = confirmedSlot
    ? formatSlotBRTDisplay(confirmedSlot.start_at, confirmedSlot.end_at)
    : undefined;

  const handleShare = async () => {
    if (!link) return;
    try {
      await Share.share({
        message: buildMeetingShareMessage(meeting, link),
        url: link,
        title: meeting.title,
      });
    } catch {}
  };

  const handlePressDetail = () => {
    hapticFeedback.light();
    onOpenDetail?.(meeting);
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.outlineVariant,
        },
      ]}
    >
      {/* Cabeçalho do Card */}
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
            {meeting.title}
          </Text>
          <View style={[styles.durationPill, { backgroundColor: colors.surfaceContainerHigh }]}>
            <MaterialIcons name="schedule" size={13} color={colors.primary} />
            <Text style={[styles.durationPillText, { color: colors.onSurface }, tabularNumbers]}>
              {meeting.duration_minutes} min
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: isConfirmed
                ? 'rgba(46, 125, 50, 0.14)'
                : colors.surfaceContainerHigh,
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isConfirmed ? '#2e7d32' : colors.primary },
            ]}
          />
          <Text
            style={[
              styles.statusPillText,
              { color: isConfirmed ? '#2e7d32' : colors.onSurface },
            ]}
          >
            {isConfirmed
              ? 'Confirmada'
              : totalParticipants > 0
                ? `${totalParticipants} ${totalParticipants === 1 ? 'voto' : 'votos'}`
                : 'Aberta'}
          </Text>
        </View>
      </View>

      {meeting.description ? (
        <Text style={[styles.cardDescription, { color: colors.onSurfaceVariant }]} numberOfLines={2}>
          {meeting.description}
        </Text>
      ) : null}

      {/* Card Resumido da Votação (Clicável para ir à página dedicada) */}
      <TouchableOpacity
        style={[
          styles.summaryPollBox,
          {
            backgroundColor: colors.surfaceContainerHigh,
            borderColor: isConfirmed ? 'rgba(46, 125, 50, 0.4)' : colors.outlineVariant,
          },
        ]}
        onPress={handlePressDetail}
        activeOpacity={0.75}
        accessibilityLabel="Ver detalhes completos da votação"
      >
        <View style={styles.summaryTopRow}>
          <View style={styles.summaryTitleRow}>
            <MaterialIcons name="poll" size={16} color={colors.primary} />
            <Text style={[styles.summaryPollTitle, { color: colors.onSurface }]}>
              {isConfirmed ? 'Resultado da Votação' : 'Placar da Votação'}
            </Text>
            <Text style={[styles.summaryPollSubtitle, { color: colors.onSurfaceVariant }, tabularNumbers]}>
              • {totalParticipants} {totalParticipants === 1 ? 'participante' : 'participantes'}
            </Text>
          </View>

          <View
            style={[
              styles.liveBadge,
              {
                backgroundColor: isConfirmed ? 'rgba(46, 125, 50, 0.14)' : 'rgba(52, 211, 153, 0.12)',
              },
            ]}
          >
            <View
              style={[
                styles.liveDot,
                { backgroundColor: isConfirmed ? '#2e7d32' : colors.primary },
              ]}
            />
            <Text
              style={[
                styles.liveText,
                { color: isConfirmed ? '#2e7d32' : colors.onSurface },
              ]}
            >
              {isConfirmed ? 'Definitivo' : 'Ao vivo'}
            </Text>
          </View>
        </View>

        {/* Linha do Resultado / Liderança */}
        {isConfirmed && confirmedFormatted ? (
          <View style={styles.leadingSlotRow}>
            <MaterialIcons name="check-circle" size={15} color="#2e7d32" />
            <Text style={[styles.leadingSlotText, { color: '#2e7d32' }]} numberOfLines={1}>
              Confirmada para: <Text style={{ fontWeight: '700' }}>{confirmedFormatted.dateLabel} às {confirmedFormatted.timeRange}</Text>
            </Text>
          </View>
        ) : leading.votesCount > 0 && leading.formatted ? (
          <View style={styles.leadingSlotRow}>
            <MaterialIcons name="star" size={15} color={colors.primary} />
            <Text style={[styles.leadingSlotText, { color: colors.onSurface }]} numberOfLines={1}>
              Liderando: <Text style={{ fontWeight: '700' }}>{leading.formatted.dateLabel} às {leading.formatted.timeRange}</Text> ({leading.votesCount} {leading.votesCount === 1 ? 'voto' : 'votos'} • {leading.percentage}%)
            </Text>
          </View>
        ) : (
          <View style={styles.leadingSlotRow}>
            <MaterialIcons name="schedule" size={14} color={colors.textSecondary} />
            <Text style={[styles.emptySlotText, { color: colors.textSecondary }]}>
              Aguardando votos • {slots.length} {slots.length === 1 ? 'horário proposto' : 'horários propostos'}
            </Text>
          </View>
        )}

        {/* Rodapé do Bloco de Votação com Chamada para Detalhes */}
        <View style={styles.viewDetailLinkRow}>
          <Text style={[styles.viewDetailText, { color: colors.primary }]}>
            Ver Detalhes da Votação
          </Text>
          <MaterialIcons name="chevron-right" size={18} color={colors.primary} />
        </View>
      </TouchableOpacity>

      {/* Barra de Ações Rápidas */}
      <View style={styles.cardActionsRow}>
        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
          onPress={handlePressDetail}
          activeOpacity={0.8}
        >
          <MaterialIcons name="how-to-vote" size={15} color={colors.onPrimary} />
          <Text style={[styles.primaryActionText, { color: colors.onPrimary }]}>
            Ver Votação
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.copyButton,
            {
              backgroundColor: isCopied ? '#2e7d32' : colors.surfaceContainerHigh,
              borderColor: colors.outlineVariant,
            },
          ]}
          onPress={() => onCopyLink(meeting)}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name={isCopied ? 'check' : 'content-copy'}
            size={14}
            color={isCopied ? '#FFFFFF' : colors.onSurface}
          />
          <Text
            style={[
              styles.copyButtonText,
              { color: isCopied ? '#FFFFFF' : colors.onSurface },
            ]}
          >
            {isCopied ? 'Copiado' : 'Link'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconButton, { borderColor: colors.outlineVariant }]}
          onPress={handleShare}
          activeOpacity={0.7}
          accessibilityLabel="Compartilhar link"
        >
          <MaterialIcons name="share" size={15} color={colors.onSurface} />
        </TouchableOpacity>

        {onEdit && !isConfirmed && (
          <TouchableOpacity
            style={[styles.iconButton, { borderColor: colors.outlineVariant }]}
            onPress={() => onEdit(meeting)}
            activeOpacity={0.7}
            accessibilityLabel="Editar reunião"
          >
            <MaterialIcons name="edit" size={15} color={colors.onSurface} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.iconButton, { borderColor: colors.outlineVariant }]}
          onPress={() => onDelete(meeting.id)}
          activeOpacity={0.7}
          accessibilityLabel="Excluir reunião"
        >
          <MaterialIcons name="delete-outline" size={16} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    gap: 10,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: MD3Shapes.large,
  },
  durationPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: MD3Shapes.large,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  summaryPollBox: {
    padding: 12,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    gap: 8,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryPollTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryPollSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: MD3Shapes.large,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
  },
  leadingSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leadingSlotText: {
    fontSize: 12,
    flex: 1,
  },
  emptySlotText: {
    fontSize: 12,
  },
  viewDetailLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  viewDetailText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: MD3Shapes.large,
  },
  primaryActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
  },
  copyButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
