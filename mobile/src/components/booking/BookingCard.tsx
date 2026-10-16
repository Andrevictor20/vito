import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Share } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes, tabularNumbers } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { BookingType } from '../../types';

let ClipboardModule: any = null;
try {
  ClipboardModule = require('expo-clipboard');
} catch (e) {
  ClipboardModule = null;
}

interface BookingCardProps {
  type: BookingType;
  isCopied: boolean;
  onCopyLink: (bt: BookingType) => void;
  onToggleActive: (bt: BookingType) => void;
  onEdit: (bt: BookingType) => void;
  onDelete: (id: string) => void;
  username: string;
}

const sanitizeBookingUrl = (raw?: string, slug?: string): string => {
  const cleanSlug = slug ? slug.toLowerCase().replace(/[^a-z0-9-]/g, '-') : '';
  const canonicalFallback = cleanSlug ? `https://vito.rasppi.cloud/book/${cleanSlug}` : 'https://vito.rasppi.cloud/book';
  if (!raw || !raw.trim()) return canonicalFallback;
  return raw;
};

export const BookingCard: React.FC<BookingCardProps> = ({
  type: bt,
  isCopied,
  onCopyLink,
  onToggleActive,
  onEdit,
  onDelete,
  username,
}) => {
  const { colors } = useTheme();

  const handleShare = async () => {
    const rawUrl = bt.short_url || bt.public_url;
    const shareUrl = sanitizeBookingUrl(rawUrl, bt.slug);
    try {
      await Share.share({
        message: `Agende uma reunião comigo (${bt.title} - ${bt.duration_minutes} min):\n${shareUrl}`,
        url: shareUrl,
        title: bt.title,
      });
    } catch {}
  };

  return (
    <View
      style={[
        styles.linkCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.outlineVariant,
          opacity: bt.is_active ? 1 : 0.65,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
            {bt.title}
          </Text>
          <View style={styles.durationPill}>
            <MaterialIcons name="schedule" size={14} color={colors.primary} />
            <Text style={[styles.durationPillText, { color: colors.primary }, tabularNumbers]}>
              {bt.duration_minutes} min
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.statusPill,
            { backgroundColor: bt.is_active ? 'rgba(46, 125, 50, 0.12)' : 'rgba(211, 47, 47, 0.12)' },
          ]}
          onPress={() => onToggleActive(bt)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: bt.is_active ? '#2e7d32' : '#d32f2f' },
            ]}
          />
          <Text
            style={[
              styles.statusPillText,
              { color: bt.is_active ? '#2e7d32' : '#d32f2f' },
            ]}
          >
            {bt.is_active ? 'Ativo' : 'Pausado'}
          </Text>
        </TouchableOpacity>
      </View>

      {bt.description ? (
        <Text style={[styles.cardDescription, { color: colors.onSurfaceVariant }]}>
          {bt.description}
        </Text>
      ) : null}

      <View style={styles.cardMetaRow}>
        <View style={styles.metaItem}>
          <MaterialIcons name="access-time" size={14} color={colors.onSurfaceVariant} />
          <Text style={[styles.metaText, { color: colors.onSurfaceVariant }, tabularNumbers]}>
            {bt.start_hour} às {bt.end_hour}
          </Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}>
          <MaterialIcons name="more-time" size={14} color={colors.onSurfaceVariant} />
          <Text style={[styles.metaText, { color: colors.onSurfaceVariant }, tabularNumbers]}>
            +{bt.buffer_minutes}m buffer
          </Text>
        </View>
      </View>

      {bt.short_url ? (
        <View style={[styles.shortUrlContainer, { backgroundColor: colors.surfaceVariant }]}>
          <MaterialIcons name="bolt" size={14} color={colors.primary} />
          <Text style={[styles.shortUrlText, { color: colors.primary }]} numberOfLines={1}>
            {bt.short_url}
          </Text>
        </View>
      ) : (
        <View style={[styles.publicUrlContainer, { backgroundColor: colors.surfaceVariant }]}>
          <MaterialIcons name="public" size={14} color={colors.onSurfaceVariant} />
          <Text style={[styles.publicUrlText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
            vito.rasppi.cloud/book/{username}/{bt.slug}
          </Text>
        </View>
      )}

      <View style={styles.cardActionsRow}>
        <TouchableOpacity
          style={[styles.shareButton, { borderColor: colors.outlineVariant }]}
          onPress={handleShare}
          activeOpacity={0.7}
        >
          <MaterialIcons name="share" size={16} color={colors.onSurface} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.copyButton,
            { backgroundColor: isCopied ? '#2e7d32' : colors.primary },
          ]}
          onPress={() => onCopyLink(bt)}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name={isCopied ? 'check' : 'content-copy'}
            size={16}
            color="#FFFFFF"
          />
          <Text
            style={[
              styles.copyButtonText,
              { color: '#FFFFFF' },
            ]}
          >
            {isCopied ? 'Link Copiado!' : 'Copiar Link'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.editButton, { borderColor: colors.outlineVariant }]}
          onPress={() => onEdit(bt)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="edit" size={16} color={colors.onSurface} />
          <Text style={[styles.editButtonText, { color: colors.onSurface }]}>
            Editar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.deleteButton, { borderColor: colors.outlineVariant }]}
          onPress={() => onDelete(bt.id)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="delete-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  linkCard: {
    padding: 16,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(26, 115, 232, 0.08)',
  },
  durationPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
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
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  metaDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#888',
  },
  shortUrlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  shortUrlText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  publicUrlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  publicUrlText: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  shareButton: {
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
    paddingHorizontal: 12,
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
    paddingHorizontal: 12,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
