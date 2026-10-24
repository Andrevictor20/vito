import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { MD3Shapes, tabularNumbers } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { Meeting } from '../../types';
import { hapticFeedback } from '../../theme/motion';
import { copyToClipboard } from '../../utils/clipboard';

interface MeetingPollHeroCardProps {
  meeting: Meeting;
  isConfirmed: boolean;
  totalParticipants: number;
  link?: string;
}

export const MeetingPollHeroCard: React.FC<MeetingPollHeroCardProps> = ({
  meeting,
  isConfirmed,
  totalParticipants,
  link,
}) => {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    if (!link) return;
    const ok = await copyToClipboard(link);
    if (ok) {
      hapticFeedback.success();
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <View style={[styles.heroCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
      <View style={styles.heroTopRow}>
        <View style={[styles.tagPill, { backgroundColor: colors.surfaceContainerHigh }]}>
          <MaterialIcons name="groups" size={14} color={colors.primary} />
          <Text style={[styles.tagText, { color: colors.primary }]}>Reunião em Grupo</Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: isConfirmed ? 'rgba(46, 125, 50, 0.15)' : 'rgba(52, 211, 153, 0.12)',
              borderColor: isConfirmed ? '#2e7d32' : colors.primary,
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
              styles.statusText,
              { color: isConfirmed ? '#2e7d32' : colors.onSurface },
            ]}
          >
            {isConfirmed ? 'Definitiva' : 'Votação Ao Vivo'}
          </Text>
        </View>
      </View>

      <Text style={[styles.heroTitle, { color: colors.onSurface }]}>
        {meeting.title}
      </Text>

      {meeting.description ? (
        <Text style={[styles.heroDesc, { color: colors.onSurfaceVariant }]}>
          {meeting.description}
        </Text>
      ) : null}

      <View style={styles.metaRow}>
        <View style={[styles.metaChip, { backgroundColor: colors.surfaceContainerHigh }]}>
          <MaterialIcons name="schedule" size={14} color={colors.onSurfaceVariant} />
          <Text style={[styles.metaChipText, { color: colors.onSurface }, tabularNumbers]}>
            {meeting.duration_minutes} min de duração
          </Text>
        </View>

        <View style={[styles.metaChip, { backgroundColor: colors.surfaceContainerHigh }]}>
          <MaterialIcons name="how-to-vote" size={14} color={colors.primary} />
          <Text style={[styles.metaChipText, { color: colors.onSurface }, tabularNumbers]}>
            {totalParticipants} {totalParticipants === 1 ? 'voto recebido' : 'votos recebidos'}
          </Text>
        </View>
      </View>

      {link ? (
        <View style={[styles.linkBox, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}>
          <View style={styles.linkTextCol}>
            <Text style={[styles.linkLabel, { color: colors.textSecondary }]}>LINK PÚBLICO DE VOTAÇÃO</Text>
            <Text style={[styles.linkValue, { color: colors.onSurface }]} numberOfLines={1}>
              {link}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.copyBtn, { backgroundColor: copied ? '#2e7d32' : colors.primary }]}
            onPress={handleCopyLink}
            activeOpacity={0.8}
          >
            <MaterialIcons name={copied ? 'check' : 'content-copy'} size={15} color={colors.onPrimary} />
            <Text style={[styles.copyBtnText, { color: colors.onPrimary }]}>
              {copied ? 'Copiado!' : 'Copiar'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  heroCard: {
    padding: 18,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    gap: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: MD3Shapes.large,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
  heroDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: MD3Shapes.large,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    gap: 10,
    marginTop: 4,
  },
  linkTextCol: {
    flex: 1,
    gap: 2,
  },
  linkLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  linkValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: MD3Shapes.large,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
