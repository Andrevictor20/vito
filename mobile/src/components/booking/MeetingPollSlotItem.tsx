import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tabularNumbers } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { MeetingSlot } from '../../types';
import { computeSlotVotePercentage, formatSlotBRTDisplay } from '../../utils/meetingPollUtils';
import { getInitials, VOTER_AVATAR_COLORS, VotersListSheet } from './VotersListSheet';

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
  const [votersOpen, setVotersOpen] = useState(false);

  const formatted = formatSlotBRTDisplay(slot.start_at, slot.end_at);
  const isSlotConfirmed = confirmedSlotId === slot.id;
  const voters = Array.isArray(slot.voter_names) ? slot.voter_names : [];
  const votesCount = Math.max(slot.votes_count || 0, voters.length);
  const isWinner = Boolean(slot.is_winner && votesCount > 0);
  const isConfirmingThis = confirmingSlotId === slot.id;
  const percentage = computeSlotVotePercentage(votesCount, totalParticipants);

  const widthAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!mounted) return;
        if (reduced) {
          widthAnim.setValue(percentage);
          return;
        }
        Animated.timing(widthAnim, {
          toValue: percentage,
          duration: 720,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      })
      .catch(() => widthAnim.setValue(percentage));
    return () => {
      mounted = false;
    };
  }, [percentage, widthAnim]);

  const barWidth = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const shownVoters = voters.slice(0, 4);
  const extraVoters = Math.max(0, voters.length - 4);
  const summaryNames =
    voters.length === 1
      ? voters[0]
      : voters.length === 2
        ? `${voters[0].split(' ')[0]} e ${voters[1].split(' ')[0]}`
        : `${voters[0]?.split(' ')[0] || ''}, ${voters[1]?.split(' ')[0] || ''} e +${voters.length - 2} pessoas`;

  return (
    <>
      <View
        style={[
          styles.vopt,
          {
            backgroundColor: isSlotConfirmed ? colors.greenBg : colors.surf,
            borderColor: isSlotConfirmed ? colors.acc : isWinner ? colors.ink : 'transparent',
          },
        ]}
      >
        <View style={styles.r1}>
          <View style={styles.r1Left}>
            <View style={styles.r1Top}>
              <Text style={[styles.dateTitle, { color: isSlotConfirmed ? colors.acc : colors.ink }, tabularNumbers]}>
                {formatted.dateLabel}
              </Text>
              {isSlotConfirmed && (
                <View style={[styles.okPill, { backgroundColor: colors.bg }]}>
                  <MaterialIcons name="check" size={12} color={colors.acc} />
                  <Text style={[styles.okPillText, { color: colors.acc }]}>Confirmado</Text>
                </View>
              )}
              {!isSlotConfirmed && isWinner && (
                <View style={[styles.okPill, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.okPillText, { color: colors.ink }]}>★ Liderando</Text>
                </View>
              )}
            </View>
            <Text style={[styles.tmText, { color: colors.muted }, tabularNumbers]}>
              {formatted.timeRange}
            </Text>
          </View>

          <View style={styles.rightCol}>
            <View style={[styles.vtPill, isSlotConfirmed && { backgroundColor: colors.bg }]}>
              <Text
                style={[
                  styles.vtText,
                  { color: isSlotConfirmed ? colors.acc : colors.muted },
                  tabularNumbers,
                ]}
              >
                {votesCount} {votesCount === 1 ? 'voto' : 'votos'} · {percentage}%
              </Text>
            </View>

            {!isConfirmed && onConfirmSlot && (
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.ink }]}
                onPress={() => onConfirmSlot(meetingId, slot.id)}
                disabled={Boolean(confirmingSlotId)}
              >
                {isConfirmingThis ? (
                  <ActivityIndicator size="small" color={colors.bg} />
                ) : (
                  <Text style={[styles.confirmBtnText, { color: colors.bg }]}>Fechar</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Barra percentual animada .bar */}
        <View style={[styles.barTrack, { backgroundColor: colors.line }]}>
          <Animated.View
            style={[
              styles.barFill,
              {
                width: barWidth,
                backgroundColor: isSlotConfirmed ? colors.acc : colors.ink,
              },
            ]}
          />
        </View>

        {/* Avatar stack .vtr-row (4 + +N) */}
        {voters.length > 0 && (
          <TouchableOpacity
            style={[styles.vtrRow, { borderTopColor: colors.line }]}
            onPress={() => setVotersOpen(true)}
            activeOpacity={0.7}
            accessibilityLabel="Ver todos os votantes"
          >
            <View style={styles.vtrAvs}>
              {shownVoters.map((name, i) => (
                <View
                  key={`${slot.id}-av-${i}`}
                  style={[
                    styles.vtrAv,
                    {
                      backgroundColor: VOTER_AVATAR_COLORS[i % VOTER_AVATAR_COLORS.length],
                      borderColor: isSlotConfirmed ? colors.greenBg : colors.surf,
                      marginLeft: i === 0 ? 0 : -8,
                    },
                  ]}
                >
                  <Text style={styles.vtrAvText}>{getInitials(name)}</Text>
                </View>
              ))}
              {extraVoters > 0 && (
                <View
                  style={[
                    styles.vtrAv,
                    {
                      backgroundColor: colors.ink,
                      borderColor: isSlotConfirmed ? colors.greenBg : colors.surf,
                      marginLeft: -8,
                    },
                  ]}
                >
                  <Text style={[styles.vtrAvText, { color: colors.bg }]}>+{extraVoters}</Text>
                </View>
              )}
            </View>

            <Text style={[styles.vtrTxt, { color: colors.muted }]} numberOfLines={1}>
              {summaryNames}
            </Text>
            <MaterialIcons name="chevron-right" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      <VotersListSheet
        visible={votersOpen}
        onClose={() => setVotersOpen(false)}
        title={`${formatted.dateLabel} · ${formatted.timeRange}`}
        voters={voters}
      />
    </>
  );
};

const styles = StyleSheet.create({
  vopt: { borderRadius: 22, padding: 16, marginBottom: 10, borderWidth: 1 },
  r1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  r1Left: { flex: 1, minWidth: 0 },
  r1Top: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  dateTitle: { fontSize: 15.5, fontWeight: '600' },
  okPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  okPillText: { fontSize: 11.5, fontWeight: '600' },
  tmText: { fontSize: 13.5, marginTop: 4 },
  rightCol: { alignItems: 'flex-end', gap: 6 },
  vtPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  vtText: { fontSize: 12.5, fontWeight: '600' },
  confirmBtn: { paddingHorizontal: 12, height: 30, borderRadius: 999, justifyContent: 'center' },
  confirmBtnText: { fontSize: 12, fontWeight: '600' },
  barTrack: { height: 6, borderRadius: 3, marginTop: 12, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  vtrRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
  },
  vtrAvs: { flexDirection: 'row', alignItems: 'center' },
  vtrAv: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vtrAvText: { color: '#ffffff', fontSize: 10.5, fontWeight: '600' },
  vtrTxt: { flex: 1, fontSize: 13 },
});
