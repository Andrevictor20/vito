import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Share,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { MD3Shapes, tabularNumbers } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { Meeting, MeetingSlot } from '../../types';
import { meetingDisplayLink } from '../../utils/chatCards';
import { formatSlotBRTDisplay, computeSlotVotePercentage } from '../../utils/meetingPollUtils';

interface MeetingCardProps {
  meeting: Meeting;
  isCopied: boolean;
  onCopyLink: (m: Meeting) => void;
  onEdit?: (m: Meeting) => void;
  onConfirmSlot?: (meetingId: string, slotId: string) => void;
  onDelete: (id: string) => void;
  confirmingSlotId?: string | null;
}

export const MeetingCard: React.FC<MeetingCardProps> = ({
  meeting,
  isCopied,
  onCopyLink,
  onEdit,
  onConfirmSlot,
  onDelete,
  confirmingSlotId,
}) => {
  const { colors } = useTheme();
  const link = meetingDisplayLink(meeting as any);
  const isConfirmed = meeting.status === 'confirmed';
  const slots: MeetingSlot[] = Array.isArray(meeting.slots) ? meeting.slots : [];
  const participants = Array.isArray(meeting.participants) ? meeting.participants : [];

  const handleWhatsApp = () => {
    if (!link) return;
    const msg = `Olá! Vote nos horários que funcionam para você na nossa reunião "${meeting.title}":\n${link}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    Linking.openURL(waUrl).catch(() => {});
  };

  const handleShare = async () => {
    if (!link) return;
    try {
      await Share.share({
        message: `Vote no melhor horário para "${meeting.title}":\n${link}`,
        url: link,
        title: meeting.title,
      });
    } catch {}
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
              : participants.length > 0
                ? `${participants.length} ${participants.length === 1 ? 'voto' : 'votos'}`
                : 'Aberta'}
          </Text>
        </View>
      </View>

      {meeting.description ? (
        <Text style={[styles.cardDescription, { color: colors.onSurfaceVariant }]} numberOfLines={2}>
          {meeting.description}
        </Text>
      ) : null}

      {slots.length > 0 && (
        <View style={styles.slotsSection}>
          <View style={[styles.pollSummaryBar, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}>
            <View style={styles.pollSummaryLeft}>
              <MaterialIcons name="poll" size={16} color={colors.primary} />
              <Text style={[styles.pollSummaryTitle, { color: colors.onSurface }]}>
                {isConfirmed ? 'Resultado Final' : 'Placar da Votação'}
              </Text>
              <Text style={[styles.pollSummaryCount, { color: colors.onSurfaceVariant }, tabularNumbers]}>
                • {participants.length} {participants.length === 1 ? 'participante' : 'participantes'}
              </Text>
            </View>
            <View
              style={[
                styles.pollLiveBadge,
                {
                  backgroundColor: isConfirmed ? 'rgba(46, 125, 50, 0.14)' : 'rgba(52, 211, 153, 0.12)',
                  borderColor: isConfirmed ? '#2e7d32' : colors.primary,
                },
              ]}
            >
              <View
                style={[
                  styles.pollLiveDot,
                  { backgroundColor: isConfirmed ? '#2e7d32' : colors.primary },
                ]}
              />
              <Text
                style={[
                  styles.pollLiveText,
                  { color: isConfirmed ? '#2e7d32' : colors.onSurface },
                ]}
              >
                {isConfirmed ? 'Definitivo' : 'Ao vivo'}
              </Text>
            </View>
          </View>

          <View style={styles.slotsList}>
            {slots.map((slot) => {
              const formatted = formatSlotBRTDisplay(slot.start_at, slot.end_at);
              const isSlotConfirmed = meeting.confirmed_slot_id === slot.id;
              const voters = Array.isArray(slot.voter_names) ? slot.voter_names : [];
              const votesCount = Math.max(slot.votes_count || 0, voters.length);
              const isWinner = Boolean(slot.is_winner && votesCount > 0);
              const isConfirmingThis = confirmingSlotId === slot.id;
              const totalParticipants = participants.length;
              const percentage = computeSlotVotePercentage(votesCount, totalParticipants);

              return (
                <View
                  key={slot.id}
                  style={[
                    styles.slotRow,
                    {
                      backgroundColor: isSlotConfirmed
                        ? 'rgba(46, 125, 50, 0.10)'
                        : colors.surfaceContainerHigh,
                      borderColor: isSlotConfirmed
                        ? '#2e7d32'
                        : isWinner
                          ? colors.primary
                          : colors.outlineVariant,
                    },
                  ]}
                >
                  {/* Barra de progresso visual de votos */}
                  <View style={[styles.progressBarTrack, { backgroundColor: colors.surfaceContainerHighest }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${percentage}%`,
                          backgroundColor: isSlotConfirmed
                            ? '#2e7d32'
                            : isWinner
                              ? colors.primary
                              : colors.onSurfaceVariant,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.slotTopLine}>
                    <View style={styles.slotTimeBlock}>
                      <MaterialIcons
                        name={isSlotConfirmed ? 'check-circle' : isWinner ? 'star' : 'event'}
                        size={15}
                        color={isSlotConfirmed ? '#2e7d32' : colors.primary}
                      />
                      <Text style={[styles.slotDateText, { color: colors.onSurface }, tabularNumbers]}>
                        {formatted.dateLabel}
                      </Text>
                      <Text style={[styles.slotTimeText, { color: colors.onSurface }, tabularNumbers]}>
                        {formatted.timeRange}
                      </Text>
                      {isWinner && !isSlotConfirmed && (
                        <View style={[styles.winnerPill, { backgroundColor: colors.surfaceContainerHighest }]}>
                          <Text style={[styles.winnerPillText, { color: colors.primary }]}>
                            ★ Liderando
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.slotRightBlock}>
                      <View
                        style={[
                          styles.voteCountBadge,
                          {
                            backgroundColor:
                              votesCount > 0 ? colors.primary : colors.surface,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.voteCountText,
                            {
                              color:
                                votesCount > 0 ? colors.onPrimary : colors.onSurfaceVariant,
                            },
                            tabularNumbers,
                          ]}
                        >
                          {votesCount} {votesCount === 1 ? 'voto' : 'votos'} ({percentage}%)
                        </Text>
                      </View>

                      {!isConfirmed && onConfirmSlot && (
                        <TouchableOpacity
                          style={[
                            styles.confirmSlotBtn,
                            {
                              backgroundColor: isWinner ? colors.primary : colors.surface,
                              borderColor: colors.outlineVariant,
                            },
                          ]}
                          onPress={() => onConfirmSlot(meeting.id, slot.id)}
                          disabled={Boolean(confirmingSlotId)}
                          activeOpacity={0.75}
                        >
                          {isConfirmingThis ? (
                            <ActivityIndicator size="small" color={isWinner ? colors.onPrimary : colors.onSurface} />
                          ) : (
                            <>
                              <MaterialIcons
                                name="check"
                                size={13}
                                color={isWinner ? colors.onPrimary : colors.onSurface}
                              />
                              <Text
                                style={[
                                  styles.confirmSlotBtnText,
                                  { color: isWinner ? colors.onPrimary : colors.onSurface },
                                ]}
                              >
                                Fechar
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {voters.length > 0 && (
                    <View style={styles.votersChipsRow}>
                      <Text style={[styles.votersPrefix, { color: colors.onSurfaceVariant }]}>
                        Votaram:
                      </Text>
                      {voters.map((voterName, i) => (
                        <View
                          key={`${slot.id}-voter-${i}`}
                          style={[
                            styles.voterChip,
                            {
                              backgroundColor: colors.surface,
                              borderColor: colors.outlineVariant,
                            },
                          ]}
                        >
                          <MaterialIcons name="person" size={11} color={colors.onSurfaceVariant} />
                          <Text style={[styles.voterChipText, { color: colors.onSurface }]}>
                            {voterName}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {link ? (
        <View style={[styles.urlContainer, { backgroundColor: colors.surfaceVariant }]}>
          <MaterialIcons name="how-to-vote" size={14} color={colors.primary} />
          <Text style={[styles.urlText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
            {link.replace(/^https?:\/\//, '')}
          </Text>
        </View>
      ) : null}

      <View style={styles.cardActionsRow}>
        <TouchableOpacity
          style={[styles.iconButton, { borderColor: colors.outlineVariant }]}
          onPress={handleWhatsApp}
          activeOpacity={0.7}
          accessibilityLabel="Enviar no WhatsApp"
        >
          <MaterialIcons name="chat-bubble-outline" size={16} color={colors.onSurface} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconButton, { borderColor: colors.outlineVariant }]}
          onPress={handleShare}
          activeOpacity={0.7}
          accessibilityLabel="Compartilhar link"
        >
          <MaterialIcons name="share" size={16} color={colors.onSurface} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.copyButton,
            { backgroundColor: isCopied ? '#2e7d32' : colors.primary },
          ]}
          onPress={() => onCopyLink(meeting)}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name={isCopied ? 'check' : 'content-copy'}
            size={15}
            color={isCopied ? '#FFFFFF' : colors.onPrimary}
          />
          <Text
            style={[
              styles.copyButtonText,
              { color: isCopied ? '#FFFFFF' : colors.onPrimary },
            ]}
          >
            {isCopied ? 'Copiado!' : 'Copiar Link'}
          </Text>
        </TouchableOpacity>

        {onEdit && (
          <TouchableOpacity
            style={[styles.editButton, { borderColor: colors.outlineVariant }]}
            onPress={() => onEdit(meeting)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="edit" size={15} color={colors.onSurface} />
            <Text style={[styles.editButtonText, { color: colors.onSurface }]}>
              Editar
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.iconButton, { borderColor: colors.outlineVariant }]}
          onPress={() => onDelete(meeting.id)}
          activeOpacity={0.7}
          accessibilityLabel="Excluir reunião"
        >
          <MaterialIcons name="delete-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    gap: 12,
    marginBottom: 12,
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
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  durationPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
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
  slotsSection: {
    gap: 6,
  },
  pollSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 4,
  },
  pollSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  pollSummaryTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  pollSummaryCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  pollLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
    borderWidth: 1,
  },
  pollLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pollLiveText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  slotsList: {
    gap: 8,
  },
  slotRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    overflow: 'hidden',
  },
  progressBarTrack: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
    marginBottom: 2,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  slotTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  slotTimeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    flexWrap: 'wrap',
  },
  slotDateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  slotTimeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  slotRightBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  voteCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  voteCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  confirmSlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  confirmSlotBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  winnerPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  winnerPillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  votersChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 21,
  },
  votersPrefix: {
    fontSize: 11,
    fontWeight: '600',
  },
  voterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  voterChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  urlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  urlText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyButton: {
    flex: 1,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  copyButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  editButton: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

