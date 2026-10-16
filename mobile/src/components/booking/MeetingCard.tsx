import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Share, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { Meeting } from '../../types';
import { formatMeetingMode, meetingDisplayLink } from '../../utils/chatCards';

let ClipboardModule: any = null;
try {
  ClipboardModule = require('expo-clipboard');
} catch (e) {
  ClipboardModule = null;
}

interface MeetingCardProps {
  meeting: Meeting;
  isCopied: boolean;
  onCopyLink: (m: Meeting) => void;
  onDelete: (id: string) => void;
}

export const MeetingCard: React.FC<MeetingCardProps> = ({
  meeting,
  isCopied,
  onCopyLink,
  onDelete,
}) => {
  const { colors } = useTheme();
  const link = meetingDisplayLink(meeting as any);

  const handleWhatsApp = () => {
    if (!link) return;
    const msg = `Olá! Escolha ou vote no melhor horário para nossa reunião "${meeting.title}":\n${link}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    Linking.openURL(waUrl).catch(() => {});
  };

  const handleShare = async () => {
    if (!link) return;
    try {
      await Share.share({
        message: `Vote no horário para "${meeting.title}":\n${link}`,
        url: link,
        title: meeting.title,
      });
    } catch {}
  };

  const isConfirmed = meeting.status === 'confirmed';

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
      <View style={styles.topRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.badge, { backgroundColor: colors.surfaceContainerHighest }]}>
            <MaterialIcons
              name={meeting.mode === 'group_consensus' ? 'how-to-vote' : 'groups'}
              size={16}
              color={colors.primary}
            />
            <Text style={[styles.badgeText, { color: colors.primary }]}>
              {formatMeetingMode(meeting.mode)}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: isConfirmed ? colors.successLight : colors.surfaceContainerHigh },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isConfirmed ? colors.success : colors.primary },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: isConfirmed ? colors.success : colors.onSurfaceVariant },
              ]}
            >
              {isConfirmed ? 'Confirmada' : 'Aberta'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => onDelete(meeting.id)}
            activeOpacity={0.7}
            accessibilityLabel="Excluir reunião"
          >
            <MaterialIcons name="delete-outline" size={18} color={colors.error || '#EF4444'} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.title, { color: colors.onSurface }]}>{meeting.title}</Text>
      {meeting.description ? (
        <Text style={[styles.desc, { color: colors.textSecondary }]} numberOfLines={2}>
          {meeting.description}
        </Text>
      ) : null}

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <MaterialIcons name="schedule" size={14} color={colors.textSecondary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {meeting.duration_minutes} min
          </Text>
        </View>
        {link ? (
          <View style={styles.metaItem}>
            <MaterialIcons name="public" size={14} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
              {link.replace(/^https?:\/\//, '')}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: isCopied ? colors.successLight : colors.surfaceContainerHigh }]}
          onPress={() => onCopyLink(meeting)}
          activeOpacity={0.7}
          accessibilityLabel="Copiar link"
        >
          <MaterialIcons
            name={isCopied ? 'check' : 'content-copy'}
            size={16}
            color={isCopied ? colors.success : colors.onSurface}
          />
          <Text style={[styles.actionBtnText, { color: isCopied ? colors.success : colors.onSurface }]}>
            {isCopied ? 'Copiado' : 'Copiar'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#25D366' }]}
          onPress={handleWhatsApp}
          activeOpacity={0.8}
          accessibilityLabel="Compartilhar no WhatsApp"
        >
          <MaterialIcons name="share" size={16} color="#FFFFFF" />
          <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>WhatsApp</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.surfaceContainerHigh }]}
          onPress={handleShare}
          activeOpacity={0.7}
          accessibilityLabel="Compartilhar link"
        >
          <MaterialIcons name="share" size={16} color={colors.onSurface} />
          <Text style={[styles.actionBtnText, { color: colors.onSurface }]}>Outro</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: MD3Shapes.extraSmall,
    borderWidth: 1,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm + 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  iconBtn: {
    padding: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: tokens.typography.family.medium,
    marginBottom: 4,
  },
  desc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
    fontFamily: tokens.typography.family.regular,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: tokens.typography.family.regular,
  },
  divider: {
    height: 1,
    marginBottom: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
