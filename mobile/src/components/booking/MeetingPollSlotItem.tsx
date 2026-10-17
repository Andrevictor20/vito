import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { MD3Shapes, tabularNumbers } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { MeetingSlot } from '../../types';
import {
  formatSlotBRTDisplay,
  computeSlotVotePercentage,
} from '../../utils/meetingPollUtils';

interface MeetingPollSlotItemProps {
  slot: MeetingSlot;
  meetingId: string;
  confirmedSlotId?: string | null;
  isConfirmed: boolean;
  totalParticipants: number;
  confirmingSlotId?: string | null;
  onConfirmSlot?: (meetingId: string, slotId: string) => Promise<void> | void;
}

export const MeetingPollSlotItem: React.FC<MeetingPollSlotItemProps> = ({
  slot,
  meetingId,
  confirmedSlotId,
  isConfirmed,
  totalParticipants,
  confirmingSlotId,
  onConfirmSlot,
}) => {
  const { colors } = useTheme();

  const formatted = formatSlotBRTDisplay(slot.start_at, slot.end_at);
  const isSlotConfirmed = confirmedSlotId === slot.id;
  const voters = Array.isArray(slot.voter_names) ? slot.voter_names : [];
  const votesCount = Math.max(slot.votes_count || 0, voters.length);
  const isWinner = Boolean(slot.is_winner && votesCount > 0);
  const isConfirmingThis = confirmingSlotId === slot.id;
  const percentage = computeSlotVotePercentage(votesCount, totalParticipants);

  return (
    <View
      style={[
        styles.slotDetailCard,
        {
          backgroundColor: isSlotConfirmed
            ? 'rgba(46, 125, 50, 0.10)'
            : colors.surfaceContainer,
          borderColor: isSlotConfirmed
            ? '#2e7d32'
            : isWinner
              ? colors.primary
              : colors.outlineVariant,
        },
      ]}
    >
      {/* Barra de progresso visual */}
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

      <View style={styles.slotMainRow}>
        <View style={styles.slotDateTimeCol}>
          <View style={styles.slotDateRow}>
            <MaterialIcons
              name={isSlotConfirmed ? 'check-circle' : isWinner ? 'star' : 'calendar-today'}
              size={16}
              color={isSlotConfirmed ? '#2e7d32' : isWinner ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.slotDateLabel, { color: colors.onSurface }, tabularNumbers]}>
              {formatted.dateLabel}
            </Text>
            {isWinner && !isSlotConfirmed && (
              <View style={[styles.winnerBadge, { backgroundColor: colors.surfaceContainerHighest }]}>
                <Text style={[styles.winnerBadgeText, { color: colors.primary }]}>
                  ★ Liderando
                </Text>
              </View>
            )}
            {isSlotConfirmed && (
              <View style={[styles.winnerBadge, { backgroundColor: 'rgba(46, 125, 50, 0.18)' }]}>
                <Text style={[styles.winnerBadgeText, { color: '#2e7d32' }]}>
                  ✓ Confirmado
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.slotTimeText, { color: colors.onSurface }, tabularNumbers]}>
            {formatted.timeRange}
          </Text>
        </View>

        <View style={styles.slotActionsCol}>
          <View
            style={[
              styles.voteBadge,
              {
                backgroundColor: votesCount > 0 ? colors.primary : colors.surfaceContainerHigh,
              },
            ]}
          >
            <Text
              style={[
                styles.voteBadgeText,
                {
                  color: votesCount > 0 ? colors.onPrimary : colors.onSurfaceVariant,
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
                styles.confirmBtn,
                {
                  backgroundColor: isWinner ? colors.primary : colors.surfaceContainerHigh,
                  borderColor: colors.outlineVariant,
                },
              ]}
              onPress={() => onConfirmSlot(meetingId, slot.id)}
              disabled={Boolean(confirmingSlotId)}
              activeOpacity={0.8}
            >
              {isConfirmingThis ? (
                <ActivityIndicator size="small" color={isWinner ? colors.onPrimary : colors.onSurface} />
              ) : (
                <>
                  <MaterialIcons
                    name="check"
                    size={14}
                    color={isWinner ? colors.onPrimary : colors.onSurface}
                  />
                  <Text
                    style={[
                      styles.confirmBtnText,
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

      {/* Votantes que escolheram este slot */}
      {voters.length > 0 && (
        <View style={[styles.votersContainer, { borderTopColor: colors.outlineVariant }]}>
          <Text style={[styles.votersLabel, { color: colors.textSecondary }]}>
            Votaram nesta opção ({voters.length}):
          </Text>
          <View style={styles.votersRow}>
            {voters.map((voterName, i) => (
              <View
                key={`${slot.id}-voter-${i}`}
                style={[
                  styles.voterChip,
                  {
                    backgroundColor: colors.surfaceContainerHigh,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <MaterialIcons name="person" size={13} color={colors.primary} />
                <Text style={[styles.voterChipName, { color: colors.onSurface }]}>
                  {voterName}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  slotDetailCard: {
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    overflow: 'hidden',
  },
  progressBarTrack: {
    height: 4,
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
  },
  slotMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    gap: 12,
  },
  slotDateTimeCol: {
    flex: 1,
    gap: 4,
  },
  slotDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  slotDateLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  winnerBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: MD3Shapes.large,
  },
  winnerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  slotTimeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  slotActionsCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  voteBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: MD3Shapes.large,
  },
  voteBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  votersContainer: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  votersLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  votersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  voterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
  },
  voterChipName: {
    fontSize: 12,
    fontWeight: '600',
  },
});
